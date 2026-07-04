import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GroupsPage } from './GroupsPage';
import { TaskBoard } from '../components/TaskBoard';
import { AuthorizationsPage } from './AuthorizationsPage';
import { ReputationBadge } from '../components/ReputationBadge';

// ATDD: EPIC-006 Group Management UI
// Stories: G023-G026

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

describe('G023: Group Management Page', () => {
  it('TC-G023-001: renders group list and detail view', async () => {
    mockFetch([]);
    await act(async () => {
      render(<GroupsPage />);
    });
    expect(screen.getByText('Groups')).toBeDefined();
    expect(screen.getByText('Select a group to view details')).toBeDefined();
  });

  it('TC-G023-002: creates a new group', async () => {
    mockFetchSequence([
      [], // initial groups list
      { id: 'g-new', name: 'New Group', description: 'Desc', owner_team_id: 'team-default' }, // POST /api/groups
      [], // refetch after create
    ]);
    const user = userEvent.setup();

    await act(async () => {
      render(<GroupsPage />);
    });

    await user.click(screen.getByText('+ New'));
    await user.type(screen.getByPlaceholderText('Group name'), 'New Group');
    await user.type(screen.getByPlaceholderText('Description'), 'Desc');
    await user.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/groups',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('New Group'),
        }),
      );
    });
  });

  it('TC-G023-003: joins group with invite code', async () => {
    mockFetchSequence([
      [], // initial groups
      { success: true }, // POST /api/groups/join
      [], // refetch after join
    ]);
    const user = userEvent.setup();

    await act(async () => {
      render(<GroupsPage />);
    });

    const inviteInput = screen.getByPlaceholderText('Invite code');
    await user.type(inviteInput, 'ABC123');
    await user.click(screen.getByText('Join'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/groups/join',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('ABC123'),
        }),
      );
    });
  });

  it('TC-G023-004: selects group and generates invite', async () => {
    mockFetchSequence([
      [
        {
          id: 'g-1',
          name: 'Alpha',
          description: 'Alpha group',
          owner_team_id: 'team-default',
          members: [{ team_id: 'team-default', team_name: 'My Team', role: 'owner' }],
        },
      ], // initial groups
      {
        id: 'g-1',
        name: 'Alpha',
        description: 'Alpha group',
        owner_team_id: 'team-default',
        members: [{ team_id: 'team-default', team_name: 'My Team', role: 'owner' }],
      }, // GET /api/groups/g-1 (full details)
      { contract: { authorization: 'manual', trust_threshold: 0.5 } }, // GET contract
      [], // GET reputation
      { invite_code: 'XYZ789' }, // POST invite
    ]);
    const user = userEvent.setup();

    await act(async () => {
      render(<GroupsPage />);
    });

    await waitFor(() => screen.getByText('Alpha'));
    await user.click(screen.getByText('Alpha'));

    await waitFor(() => screen.getByText('Invite Code'));
    await user.click(screen.getByText('Invite Code'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/groups/g-1/invite',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(screen.getByText('XYZ789')).toBeDefined();
    });
  });

  it('TC-G023-005: updates contract', async () => {
    mockFetchSequence([
      [
        {
          id: 'g-1',
          name: 'Alpha',
          description: 'Alpha group',
          owner_team_id: 'team-default',
          members: [],
        },
      ], // initial groups
      {
        id: 'g-1',
        name: 'Alpha',
        description: 'Alpha group',
        owner_team_id: 'team-default',
        members: [],
      }, // GET /api/groups/g-1 (full details)
      { contract: { authorization: 'manual', trust_threshold: 0.5 } }, // GET contract
      [], // GET reputation
      { success: true }, // PATCH contract
    ]);
    const user = userEvent.setup();

    await act(async () => {
      render(<GroupsPage />);
    });

    await waitFor(() => screen.getByText('Alpha'));
    await user.click(screen.getByText('Alpha'));

    await waitFor(() => screen.getByText('Save Contract'));

    // Change authorization mode
    const select = screen.getByRole('combobox');
    await user.selectOptions(select, 'auto');

    await user.click(screen.getByText('Save Contract'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/groups/g-1/contract',
        expect.objectContaining({
          method: 'PATCH',
          body: expect.stringContaining('auto'),
        }),
      );
    });
  });

  it('TC-G023-006: delete group requires confirmation', async () => {
    mockFetchSequence([
      [
        {
          id: 'g-1',
          name: 'Alpha',
          description: 'Alpha group',
          owner_team_id: 'team-default',
          members: [{ team_id: 'team-default', team_name: 'My Team', role: 'owner' }],
        },
      ], // initial groups
      {
        id: 'g-1',
        name: 'Alpha',
        description: 'Alpha group',
        owner_team_id: 'team-default',
        members: [{ team_id: 'team-default', team_name: 'My Team', role: 'owner' }],
      }, // GET /api/groups/g-1 (full details)
      { contract: { authorization: 'manual', trust_threshold: 0.5 } }, // GET contract
      [], // GET reputation
      { success: true }, // DELETE /api/groups/g-1
      [], // refetch after delete
    ]);
    const user = userEvent.setup();

    await act(async () => {
      render(<GroupsPage />);
    });

    await waitFor(() => screen.getByText('Alpha'));
    await user.click(screen.getByText('Alpha'));

    await waitFor(() => screen.getByText('Delete Group'));
    await user.click(screen.getByText('Delete Group'));

    // Confirmation dialog should appear
    await waitFor(() => {
      expect(screen.getByText('Delete Group?')).toBeDefined();
      expect(screen.getByText(/This action cannot be undone/)).toBeDefined();
    });

    await user.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/groups/g-1',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  it('TC-G023-007: switches team context', async () => {
    mockFetchSequence([
      [], // initial groups for team-default
      [], // groups for team-b after switch
    ]);
    const user = userEvent.setup();

    await act(async () => {
      render(<GroupsPage />);
    });

    const teamInput = screen.getByPlaceholderText('Team ID');
    await user.clear(teamInput);
    await user.type(teamInput, 'team-b');
    await user.click(screen.getByText('Switch'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenLastCalledWith('/api/groups?team_id=team-b');
    });
  });

  it('TC-G023-008: shows error banner when create group fails', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url === '/api/groups') {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: 'Failed to create group' }),
        } as Response);
      }
      return Promise.resolve({ json: () => Promise.resolve([]), ok: true } as Response);
    });
    const user = userEvent.setup();

    await act(async () => {
      render(<GroupsPage />);
    });

    await user.click(screen.getByText('+ New'));
    await user.type(screen.getByPlaceholderText('Group name'), 'Bad Group');
    await user.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(screen.getByText('Failed to create group')).toBeDefined();
    });
  });
});

describe('G024: Cross-Team Task Board', () => {
  it('TC-G024-001: task board shows columns', async () => {
    mockFetch({ tasks: [] });
    render(<TaskBoard />);
    await waitFor(() => {
      expect(screen.getByText('Pending')).toBeDefined();
      expect(screen.getByText('In Progress')).toBeDefined();
      expect(screen.getByText('Completed')).toBeDefined();
    });
  });
});

describe('G025: Authorization Approval UI', () => {
  it('TC-G025-001: shows countdown in red under 1min', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    mockFetch([
      {
        id: 'auth-1',
        task_title: 'Urgent Task',
        task_description: 'Desc',
        agent_name: 'A1',
        agent_runtime: 'claude',
        requesting_team_id: 'team-b',
        status: 'pending',
        created_at: nowSec - 120,
        expires_at: nowSec + 30, // 30s left = under 1min
      },
    ]);
    render(<AuthorizationsPage />);
    await waitFor(() => {
      const countdown = screen.getByText(/0:\d{2}/);
      expect(countdown).toBeDefined();
      expect(countdown.className).toContain('text-red-400');
    });
  });
});

describe('G026: Reputation Display', () => {
  it('TC-G026-001: reputation badge color mapping', () => {
    const { container: high } = render(<ReputationBadge score={5} />);
    expect(high.textContent).toBe('5');
    expect(high.querySelector('span')?.className).toContain('bg-green-600');

    const { container: mid } = render(<ReputationBadge score={2} />);
    expect(mid.querySelector('span')?.className).toContain('bg-yellow-600');

    const { container: four } = render(<ReputationBadge score={4} />);
    expect(four.querySelector('span')?.className).toContain('bg-yellow-600');

    const { container: low } = render(<ReputationBadge score={-1} />);
    expect(low.querySelector('span')?.className).toContain('bg-red-600');

    const { container: neutral } = render(<ReputationBadge score={0} />);
    expect(neutral.querySelector('span')?.className).toContain('bg-red-600');
  });
});
