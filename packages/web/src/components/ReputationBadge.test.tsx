import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReputationBadge } from './ReputationBadge';

describe('ReputationBadge', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.startsWith('/api/groups/group-1/reputation/team-1/events')) {
        return Promise.resolve({
          json: () =>
            Promise.resolve([
              {
                id: 'rep-1',
                event_type: 'task_completed',
                score_delta: 1,
                task_id: 't1',
                created_at: 1000,
              },
            ]),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });
  });

  it('renders the score badge', () => {
    render(<ReputationBadge score={3} />);
    expect(screen.getByText('3')).toBeDefined();
  });

  it('opens the events modal when clicked with group/team context', async () => {
    render(
      <ReputationBadge score={3} groupId="group-1" teamId="team-1" teamName="Team One" />,
    );

    fireEvent.click(screen.getByText('3'));

    await waitFor(() => {
      expect(screen.getByText('Reputation Events — Team One')).toBeDefined();
    });
    expect(screen.getByText('task_completed')).toBeDefined();
    expect(screen.getByText('+1')).toBeDefined();
  });

  it('does not open a modal when context is missing', () => {
    render(<ReputationBadge score={3} />);
    expect(screen.getByText('3').tagName.toLowerCase()).toBe('span');
  });
});
