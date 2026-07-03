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
          json: () => Promise.resolve({
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
          json: () => Promise.resolve({
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
});
