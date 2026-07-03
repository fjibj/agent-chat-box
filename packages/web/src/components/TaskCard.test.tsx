import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TaskCard } from './TaskCard';

describe('TaskCard', () => {
  const baseProps = {
    id: 'task-1',
    title: 'Test task',
    priority: 'normal' as const,
    status: 'pending',
  };

  it('renders pending_authorization without fallback styling', () => {
    const { container } = render(
      <TaskCard
        {...baseProps}
        status="pending_authorization"
      />,
    );

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
});
