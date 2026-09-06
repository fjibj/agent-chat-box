import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskDetailModal } from './TaskDetailModal';

const baseTask = {
  id: 'task-1',
  channelId: 'ch-1',
  title: 'Group Task One',
  description: 'A cross-team task',
  priority: 'high' as const,
  mode: 'compete' as const,
  status: 'running',
  creatorId: 'user-1',
  assigneeId: 'agent-1',
  isGroupTask: true,
  sourceTeamId: 'team-1',
  groupId: 'group-1',
  authorizationStatus: 'approved' as const,
  output: 'Task output here',
  maxRetries: 3,
  retryCount: 0,
  createdAt: 1000,
  claimedAt: 2000,
  completedAt: 3000,
};

type FixtureTask = typeof baseTask & { parentTaskId?: string };

function mockFetchWith(data: {
  task?: FixtureTask;
  timeline?: Array<{ type: string; timestamp: number; data: Record<string, unknown> }>;
  agents?: Array<{ id: string; name: string; status: string }>;
  tree?: { task: FixtureTask; children: FixtureTask[] } | null;
  names?: Record<string, string>;
}) {
  (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((input: RequestInfo | URL) => {
    const url = input.toString();
    if (url === '/api/tasks/task-1/timeline') {
      return Promise.resolve({
        json: () =>
          Promise.resolve({
            task: data.task ?? baseTask,
            timeline: data.timeline ?? [],
          }),
      } as Response);
    }
    if (url === '/api/agents') {
      return Promise.resolve({
        json: () =>
          Promise.resolve({
            agents: data.agents ?? [{ id: 'agent-1', name: 'Agent One', status: 'awake' }],
          }),
      } as Response);
    }
    if (url === '/api/tasks/task-1/tree') {
      return Promise.resolve({
        json: () => Promise.resolve(data.tree ?? { task: baseTask, children: [] }),
      } as Response);
    }
    if (url.startsWith('/api/resolve-names')) {
      return Promise.resolve({
        json: () => Promise.resolve({ names: data.names ?? {} }),
      } as Response);
    }
    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });
}

describe('TaskDetailModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  it('renders group task metadata and resolves names (M9-03/04/05)', async () => {
    mockFetchWith({
      names: {
        'user-1': 'Alice',
        'agent-1': 'Agent One',
        'team-1': 'Team One',
        'group-1': 'Group One',
      },
    });

    render(<TaskDetailModal taskId="task-1" onClose={() => {}} onUpdated={() => {}} />);

    await waitFor(() => expect(screen.getByText('Group Task One')).toBeDefined());

    expect(screen.getByText('ID: task-1')).toBeDefined();
    expect(screen.getByText('Creator: Alice')).toBeDefined();
    expect(screen.getByText('Assignee: Agent One')).toBeDefined();
    expect(screen.getByText('Group: Group One')).toBeDefined();
    expect(screen.getByText('Source Team: Team One')).toBeDefined();
    expect(screen.getByText('Authorization: approved')).toBeDefined();
    expect(screen.getByText('Task output here')).toBeDefined();
  });

  it('shows Force Complete and Force Fail buttons for running tasks (M9-13)', async () => {
    mockFetchWith({});

    render(<TaskDetailModal taskId="task-1" onClose={() => {}} onUpdated={() => {}} />);

    await waitFor(() => expect(screen.getByText('Force Complete')).toBeDefined());
    expect(screen.getByText('Force Fail')).toBeDefined();
  });

  it('calls force-complete API when Force Complete clicked (M9-14)', async () => {
    mockFetchWith({});
    const user = userEvent.setup();

    render(<TaskDetailModal taskId="task-1" onClose={() => {}} onUpdated={() => {}} />);

    await waitFor(() => expect(screen.getByText('Force Complete')).toBeDefined());
    await user.click(screen.getByText('Force Complete'));

    await waitFor(() => {
      const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => c[0] === '/api/tasks/task-1/force-complete',
      );
      expect(call).toBeDefined();
      expect((call as unknown[])[1]).toMatchObject({ method: 'POST' });
    });
  });

  it('calls force-fail API when Force Fail clicked (M9-15)', async () => {
    mockFetchWith({});
    const user = userEvent.setup();

    render(<TaskDetailModal taskId="task-1" onClose={() => {}} onUpdated={() => {}} />);

    await waitFor(() => expect(screen.getByText('Force Fail')).toBeDefined());
    await user.click(screen.getByText('Force Fail'));

    await waitFor(() => {
      const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => c[0] === '/api/tasks/task-1/force-fail',
      );
      expect(call).toBeDefined();
      expect((call as unknown[])[1]).toMatchObject({ method: 'POST' });
    });
  });

  it('renders subtask tree with progress (M9-17)', async () => {
    mockFetchWith({
      tree: {
        task: { ...baseTask, status: 'verifying' as const },
        children: [
          {
            ...baseTask,
            id: 'sub-1',
            title: 'Subtask 1',
            status: 'completed',
            parentTaskId: 'task-1',
          },
          {
            ...baseTask,
            id: 'sub-2',
            title: 'Subtask 2',
            status: 'running',
            parentTaskId: 'task-1',
          },
        ],
      },
    });

    render(<TaskDetailModal taskId="task-1" onClose={() => {}} onUpdated={() => {}} />);

    await waitFor(() => expect(screen.getByText('Subtasks (1/2)')).toBeDefined());
    expect(screen.getByText('Subtask 1')).toBeDefined();
    expect(screen.getByText('Subtask 2')).toBeDefined();
  });

  it('opens recursive subtask detail modal (M9-18)', async () => {
    mockFetchWith({
      tree: {
        task: baseTask,
        children: [
          {
            ...baseTask,
            id: 'sub-1',
            title: 'Subtask 1',
            status: 'completed',
            parentTaskId: 'task-1',
          },
        ],
      },
    });
    const user = userEvent.setup();

    render(<TaskDetailModal taskId="task-1" onClose={() => {}} onUpdated={() => {}} />);

    await waitFor(() => expect(screen.getByText('Subtask 1')).toBeDefined());
    await user.click(screen.getAllByText('detail')[0]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/tasks/sub-1/timeline');
    });
  });
});
