import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemberList } from './MemberList';

describe('MemberList', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  it('renders members from API', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({
        members: [
          { memberId: 'u1', name: 'Alice', memberKind: 'human', joinedAt: 0 },
          { memberId: 'a1', name: 'Bot1', memberKind: 'agent', joinedAt: 0 },
        ],
      }),
    } as Response);

    render(<MemberList channelId="ch-1" />);

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeDefined();
      expect(screen.getByText('Bot1')).toBeDefined();
    });
  });

  it('shows member count in header', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({
        members: [{ memberId: 'u1', name: 'Alice', memberKind: 'human', joinedAt: 0 }],
      }),
    } as Response);

    render(<MemberList channelId="ch-1" />);

    await waitFor(() => {
      expect(screen.getByText(/Members — 1/)).toBeDefined();
    });
  });

  it('shows empty state', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ members: [] }),
    } as Response);

    render(<MemberList channelId="ch-1" />);

    await waitFor(() => {
      expect(screen.getByText('No members yet')).toBeDefined();
    });
  });

  it('shows HUMAN and BOT badges', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({
        members: [
          { memberId: 'u1', name: 'Alice', memberKind: 'human', joinedAt: 0 },
          { memberId: 'a1', name: 'Bot1', memberKind: 'agent', joinedAt: 0 },
        ],
      }),
    } as Response);

    render(<MemberList channelId="ch-1" />);

    await waitFor(() => {
      expect(screen.getByText('HUMAN')).toBeDefined();
      expect(screen.getByText('BOT')).toBeDefined();
    });
  });
});
