import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TaskCard, type TaskCardProps } from './TaskCard';

describe('TaskCard', () => {
  const baseProps = {
    id: 'task-1',
    title: 'Test task',
    priority: 'normal' as const,
    status: 'pending',
  };

  it('renders pending_authorization without fallback styling', () => {
    const { container } = render(<TaskCard {...baseProps} status="pending_authorization" />);

    expect(screen.getByText('Awaiting Auth')).toBeDefined();
    const badge = screen.getByText('Awaiting Auth');
    expect(badge.className).toContain('bg-amber-500');
    expect(badge.className).not.toContain('bg-gray-500');
    expect(container.textContent).not.toContain('pending_authorization');
  });

  it('renders group task metadata', () => {
    render(
      <TaskCard
        {...baseProps}
        isGroupTask
        groupId="group-1"
        sourceTeamId="team-1"
        authorizationStatus="pending"
        names={{ 'group-1': 'Group One', 'team-1': 'Team One' }}
      />,
    );

    expect(screen.getByText('Group')).toBeDefined();
    expect(screen.getByText('Auth: pending')).toBeDefined();
    expect(screen.getByText('Group: Group One')).toBeDefined();
    expect(screen.getByText('Source: Team One')).toBeDefined();
  });

  it('maps all 8 task statuses to non-fallback labels and colors (M9-12)', () => {
    const statuses = [
      { status: 'pending', label: 'Pending', color: 'bg-yellow-500' },
      { status: 'pending_authorization', label: 'Awaiting Auth', color: 'bg-amber-500' },
      { status: 'claimed', label: 'Claimed', color: 'bg-blue-500' },
      { status: 'running', label: 'Running', color: 'bg-blue-400' },
      { status: 'decomposing', label: 'Decomposing', color: 'bg-purple-500' },
      { status: 'verifying', label: 'Verifying', color: 'bg-cyan-500' },
      { status: 'completed', label: 'Done', color: 'bg-green-500' },
      { status: 'failed', label: 'Failed', color: 'bg-red-500' },
    ];

    for (const s of statuses) {
      const { container } = render(
        <TaskCard {...baseProps} status={s.status as TaskCardProps['status']} />,
      );
      const badge = screen.getByText(s.label);
      expect(badge.className).toContain(s.color);
      expect(container.textContent).not.toContain('bg-gray-500');
    }
  });
});
