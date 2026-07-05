import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { TaskBoard } from './TaskBoard';

describe('TaskBoard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.startsWith('/api/tasks')) {
        return Promise.resolve({
          json: () =>
            Promise.resolve({
              tasks: [
                {
                  id: 'task-auth-1',
                  channelId: 'ch-1',
                  title: 'Needs authorization',
                  description: 'Cross-team task',
                  priority: 'high',
                  mode: 'compete',
                  status: 'pending_authorization',
                  creatorId: 'user-1',
                  isGroupTask: true,
                  sourceTeamId: 'team-1',
                  groupId: 'group-1',
                  authorizationStatus: 'pending',
                  createdAt: 1000,
                },
              ],
            }),
        } as Response);
      }
      if (url.startsWith('/api/resolve-names')) {
        return Promise.resolve({
          json: () =>
            Promise.resolve({
              names: {
                'user-1': 'Alice',
                'team-1': 'Team One',
                'group-1': 'Group One',
              },
            }),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });
  });

  it('keeps pending_authorization tasks visible in the Authorization column', async () => {
    render(<TaskBoard />);

    await waitFor(() => expect(screen.getByText('Needs authorization')).toBeDefined());

    const authorizationColumn = screen.getByText('Authorization').closest('div')?.parentElement;
    expect(authorizationColumn).toBeDefined();
    expect(within(authorizationColumn!).getByText('Needs authorization')).toBeDefined();
    expect(within(authorizationColumn!).getByText('Awaiting Auth')).toBeDefined();
    expect(within(authorizationColumn!).getByText('Group')).toBeDefined();
    expect(within(authorizationColumn!).getByText('Auth: pending')).toBeDefined();
    expect(within(authorizationColumn!).getByText('Group: Group One')).toBeDefined();
    expect(within(authorizationColumn!).getByText('Source: Team One')).toBeDefined();
  });

  it('fetches group tasks when groupId prop is provided', async () => {
    const fetchedUrls: string[] = [];
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((input: RequestInfo | URL) => {
      const url = input.toString();
      fetchedUrls.push(url);
      if (url.startsWith('/api/groups/group-1/tasks')) {
        return Promise.resolve({
          json: () =>
            Promise.resolve([
              {
                id: 'group-task-1',
                channelId: 'ch-1',
                title: 'Group Only Task',
                priority: 'normal',
                mode: 'compete',
                status: 'pending',
                creatorId: 'user-1',
                isGroupTask: true,
                groupId: 'group-1',
                createdAt: 1000,
              },
            ]),
        } as Response);
      }
      if (url.startsWith('/api/resolve-names')) {
        return Promise.resolve({ json: () => Promise.resolve({ names: {} }) } as Response);
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    render(<TaskBoard groupId="group-1" />);

    await waitFor(() => expect(screen.getByText('Group Only Task')).toBeDefined());
    expect(fetchedUrls.some(u => u.startsWith('/api/groups/group-1/tasks'))).toBe(true);
  });

  it('places tasks in correct columns by status (M9-06/07/08/09/11)', async () => {
    const statuses = [
      { status: 'pending', title: 'Pending Task', column: 'Pending' },
      { status: 'pending_authorization', title: 'Auth Task', column: 'Authorization' },
      { status: 'claimed', title: 'Claimed Task', column: 'In Progress' },
      { status: 'running', title: 'Running Task', column: 'In Progress' },
      { status: 'decomposing', title: 'Decomposing Task', column: 'In Progress' },
      { status: 'verifying', title: 'Verifying Task', column: 'In Progress' },
      { status: 'completed', title: 'Completed Task', column: 'Completed' },
      { status: 'failed', title: 'Failed Task', column: 'Completed' },
    ];

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.startsWith('/api/tasks')) {
        return Promise.resolve({
          json: () =>
            Promise.resolve({
              tasks: statuses.map((s, i) => ({
                id: `task-${i}`,
                channelId: 'ch-1',
                title: s.title,
                priority: 'normal',
                mode: 'compete',
                status: s.status,
                creatorId: 'user-1',
                createdAt: 1000 + i,
              })),
            }),
        } as Response);
      }
      if (url.startsWith('/api/resolve-names')) {
        return Promise.resolve({ json: () => Promise.resolve({ names: {} }) } as Response);
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    render(<TaskBoard />);

    await waitFor(() => expect(screen.getByText('Pending Task')).toBeDefined());

    for (const s of statuses) {
      const columnHeaders = screen.getAllByText(s.column);
      const columnHeader = columnHeaders[0].closest('div')?.parentElement;
      expect(columnHeader).toBeDefined();
      expect(within(columnHeader!).getByText(s.title)).toBeDefined();
    }
  });
});
