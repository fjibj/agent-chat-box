import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { DomainsPage } from './DomainsPage';

// IDSD Slice 5: Domain UI (DomainsPage)

beforeEach(() => {
  vi.restoreAllMocks();
  global.fetch = vi.fn();
});

function mockFetchSequence(responses: unknown[]) {
  let idx = 0;
  (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(() => {
    const data = responses[idx++] ?? [];
    return Promise.resolve({
      json: () => Promise.resolve(data),
      ok: true,
    } as Response);
  });
}

function mockFetch(data: unknown) {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
    json: () => Promise.resolve(data),
    ok: true,
  } as Response);
}

async function renderPage() {
  await act(async () => {
    render(
      <MemoryRouter>
        <DomainsPage />
      </MemoryRouter>,
    );
  });
}

const groups = [
  { id: 'g1', name: 'Alpha', description: '', owner_team_id: 'team-default' },
  { id: 'g2', name: 'Beta', description: '', owner_team_id: 'team-default' },
];

const domain = {
  id: 'd1',
  name: 'Domain One',
  description: '',
  owner_group_id: 'g1',
  created_at: 1,
};

const domainDetail = {
  ...domain,
  members: [
    { group_id: 'g1', group_name: 'Alpha', role: 'owner' },
    { group_id: 'g2', group_name: 'Beta', role: 'member' },
  ],
};

describe('Slice 5: DomainsPage', () => {
  it('switches acting group and refreshes the domain list', async () => {
    mockFetchSequence([
      groups, // GET /api/groups
      [domain], // GET /api/domains?group_id=g2
    ]);
    const user = userEvent.setup();

    await renderPage();

    await waitFor(() => screen.getByText('Alpha'));
    await user.selectOptions(screen.getByRole('combobox'), 'g2');

    await waitFor(() => {
      expect(global.fetch).toHaveBeenLastCalledWith('/api/domains?group_id=g2');
    });
    await waitFor(() => screen.getByText('Domain One'));
  });

  it('creates a domain that appears in the list', async () => {
    mockFetchSequence([
      [groups[0]], // GET /api/groups
      [], // GET /api/domains?group_id=g1 (initial)
      { id: 'd-new', name: 'New Domain', description: '', owner_group_id: 'g1', created_at: 2 }, // POST /api/domains
      [{ id: 'd-new', name: 'New Domain', description: '', owner_group_id: 'g1', created_at: 2 }], // refetch after create
    ]);
    const user = userEvent.setup();

    await renderPage();

    await waitFor(() => screen.getByText('Alpha'));
    await user.selectOptions(screen.getByRole('combobox'), 'g1');
    await user.click(screen.getByText('+ New'));
    await user.type(screen.getByPlaceholderText('Domain name'), 'New Domain');
    await user.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/domains',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('New Domain'),
        }),
      );
    });
    await waitFor(() => screen.getByText('New Domain'));
  });

  it('joins a domain with an invite code', async () => {
    mockFetchSequence([
      [groups[0]], // GET /api/groups
      [], // GET /api/domains?group_id=g1 (initial)
      { success: true, domain_id: 'd1' }, // POST /api/domains/join
      [{ id: 'd1', name: 'Joined Domain', description: '', owner_group_id: 'g2', created_at: 3 }], // refetch after join
    ]);
    const user = userEvent.setup();

    await renderPage();

    await waitFor(() => screen.getByText('Alpha'));
    await user.selectOptions(screen.getByRole('combobox'), 'g1');
    await user.type(screen.getByPlaceholderText('Invite code'), 'INV123');
    await user.click(screen.getByText('Join'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/domains/join',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('INV123'),
        }),
      );
    });
    await waitFor(() => screen.getByText('Joined Domain'));
  });

  it('updates the member capability list after declaring capabilities', async () => {
    mockFetchSequence([
      [groups[0]], // GET /api/groups
      [domain], // GET /api/domains?group_id=g1
      domainDetail, // GET /api/domains/d1
      [], // GET /api/domains/d1/capabilities (initial)
      [], // GET /api/domains/d1/tasks?group_id=g1
      [], // GET /api/domains/d1/reputation?group_id=g1
      { success: true }, // POST /api/domains/d1/capabilities
      [{ group_id: 'g1', group_name: 'Alpha', capabilities: ['code', 'test'] }], // refetch capabilities
    ]);
    const user = userEvent.setup();

    await renderPage();

    await waitFor(() => screen.getByText('Alpha'));
    await user.selectOptions(screen.getByRole('combobox'), 'g1');
    await waitFor(() => screen.getByText('Domain One'));
    await user.click(screen.getByText('Domain One'));

    await waitFor(() => screen.getByText('Declare'));
    await user.type(screen.getByPlaceholderText('code, review, test'), 'code, test');
    await user.click(screen.getByText('Declare'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/domains/d1/capabilities',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('code'),
        }),
      );
    });
    await waitFor(() => screen.getByText('code'));
    await waitFor(() => screen.getByText('test'));
  });

  it('shows reputation scores and flagged marks in discovery results', async () => {
    mockFetchSequence([
      [groups[0]], // GET /api/groups
      [domain], // GET /api/domains?group_id=g1
      domainDetail, // GET /api/domains/d1
      [], // GET /api/domains/d1/capabilities
      [], // GET /api/domains/d1/tasks?group_id=g1
      [], // GET /api/domains/d1/reputation?group_id=g1
      [
        {
          group_id: 'g2',
          group_name: 'Beta',
          capabilities: ['code'],
          reputation: 4,
          flagged: true,
        },
      ], // GET /api/domains/d1/discover?capabilities=code&group_id=g1
    ]);
    const user = userEvent.setup();

    await renderPage();

    await waitFor(() => screen.getByText('Alpha'));
    await user.selectOptions(screen.getByRole('combobox'), 'g1');
    await waitFor(() => screen.getByText('Domain One'));
    await user.click(screen.getByText('Domain One'));

    await waitFor(() => screen.getByText('Search'));
    await user.type(screen.getByPlaceholderText('Required capabilities (e.g. code, test)'), 'code');
    await user.click(screen.getByText('Search'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/domains/d1/discover?capabilities=code&group_id=g1',
      );
    });
    await waitFor(() => screen.getByText('code'));
    await waitFor(() => screen.getByText('4'));
    await waitFor(() => screen.getByText('flagged'));
  });

  it('shows an initiated collaboration task in the task list', async () => {
    mockFetchSequence([
      [groups[0]], // GET /api/groups
      [domain], // GET /api/domains?group_id=g1
      domainDetail, // GET /api/domains/d1
      [], // GET /api/domains/d1/capabilities
      [], // GET /api/domains/d1/tasks?group_id=g1 (initial)
      [], // GET /api/domains/d1/reputation?group_id=g1
      { task_id: 't1', target_group_id: 'g2', target_group_name: 'Beta', status: 'pending' }, // POST /api/domains/d1/tasks
      [
        {
          task_id: 't1',
          requester_group_id: 'g1',
          target_group_id: 'g2',
          status: 'pending',
          title: 'Build API',
          created_at: 4,
        },
      ], // refetch tasks after initiate
    ]);
    const user = userEvent.setup();

    await renderPage();

    await waitFor(() => screen.getByText('Alpha'));
    await user.selectOptions(screen.getByRole('combobox'), 'g1');
    await waitFor(() => screen.getByText('Domain One'));
    await user.click(screen.getByText('Domain One'));

    await waitFor(() => screen.getByText('Initiate'));
    await user.type(screen.getByPlaceholderText('Task title'), 'Build API');
    await user.type(screen.getByPlaceholderText('Required capabilities (e.g. code)'), 'code');
    await user.click(screen.getByText('Initiate'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/domains/d1/tasks',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Build API'),
        }),
      );
    });
    await waitFor(() => screen.getByText('Build API'));
  });

  it('rejects owner leave with a dissolve-domain hint', async () => {
    mockFetchSequence([
      [groups[0]], // GET /api/groups
      [domain], // GET /api/domains?group_id=g1
      domainDetail, // GET /api/domains/d1 (owner_group_id === g1)
      [], // GET /api/domains/d1/capabilities
      [], // GET /api/domains/d1/tasks?group_id=g1
      [], // GET /api/domains/d1/reputation?group_id=g1
    ]);
    const user = userEvent.setup();

    await renderPage();

    await waitFor(() => screen.getByText('Alpha'));
    await user.selectOptions(screen.getByRole('combobox'), 'g1');
    await waitFor(() => screen.getByText('Domain One'));
    await user.click(screen.getByText('Domain One'));

    await waitFor(() => screen.getByText('Leave Domain'));
    await user.click(screen.getByText('Leave Domain'));

    await waitFor(() => {
      expect(screen.getByText(/请解散域/)).toBeDefined();
    });
    expect(global.fetch).not.toHaveBeenCalledWith('/api/domains/d1/leave', expect.anything());
  });

  it('shows a 403 error hint for non-member access without crashing', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url === '/api/groups?team_id=team-default') {
        return Promise.resolve({
          json: () => Promise.resolve([groups[0]]),
          ok: true,
        } as Response);
      }
      if (url === '/api/domains?group_id=g1') {
        return Promise.resolve({
          json: () => Promise.resolve([domain]),
          ok: true,
        } as Response);
      }
      if (url === '/api/domains/d1') {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: 'Group is not a member of this domain' }),
        } as Response);
      }
      return Promise.resolve({
        json: () => Promise.resolve([]),
        ok: true,
      } as Response);
    });
    const user = userEvent.setup();

    await renderPage();

    await waitFor(() => screen.getByText('Alpha'));
    await user.selectOptions(screen.getByRole('combobox'), 'g1');
    await waitFor(() => screen.getByText('Domain One'));
    await user.click(screen.getByText('Domain One'));

    await waitFor(() => {
      expect(screen.getByText('Group is not a member of this domain')).toBeDefined();
    });
    expect(screen.getByText('Select a domain to view details')).toBeDefined();
  });

  it('shows empty-state guidance when the team has no groups', async () => {
    mockFetch([]);

    await renderPage();

    await waitFor(() => {
      expect(screen.getByText(/No groups found for team/)).toBeDefined();
      expect(screen.getByText('Go to Groups')).toBeDefined();
    });
  });
});
