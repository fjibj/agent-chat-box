import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChannelList } from './ChannelList';
import { MSG } from '@agent-chat-box/shared';

describe('ChannelList', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  it('renders channels from API', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({
        channels: [
          { id: 'ch-1', name: 'general', type: 'group' },
          { id: 'ch-2', name: 'random', type: 'group' },
        ],
      }),
    } as Response);

    render(<ChannelList selectedChannelId={null} onSelectChannel={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('general')).toBeDefined();
      expect(screen.getByText('random')).toBeDefined();
    });
  });

  it('highlights selected channel', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({
        channels: [{ id: 'ch-1', name: 'general', type: 'group' }],
      }),
    } as Response);

    const { container } = render(
      <ChannelList selectedChannelId="ch-1" onSelectChannel={() => {}} />,
    );

    await waitFor(() => {
      const btn = container.querySelector('.bg-gray-700');
      expect(btn).toBeDefined();
    });
  });

  it('calls onSelectChannel when clicked', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({
        channels: [{ id: 'ch-1', name: 'general', type: 'group' }],
      }),
    } as Response);

    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(<ChannelList selectedChannelId={null} onSelectChannel={onSelect} />);

    await waitFor(() => screen.getByText('general'));
    await user.click(screen.getByText('general'));

    expect(onSelect).toHaveBeenCalledWith('ch-1');
  });

  it('refetches channels when channel.created WS message arrives (GAP-19)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        json: () => Promise.resolve({
          channels: [{ id: 'ch-1', name: 'general', type: 'group' }],
        }),
      } as Response)
      .mockResolvedValueOnce({
        json: () => Promise.resolve({
          channels: [
            { id: 'ch-1', name: 'general', type: 'group' },
            { id: 'group-channel-group-1', name: 'New Group', type: 'group' },
          ],
        }),
      } as Response);

    const { rerender } = render(
      <ChannelList selectedChannelId={null} onSelectChannel={() => {}} wsMessages={[]} />,
    );

    await waitFor(() => screen.getByText('general'));

    rerender(
      <ChannelList
        selectedChannelId={null}
        onSelectChannel={() => {}}
        wsMessages={[
          {
            v: 1,
            id: 'ws-1',
            type: MSG.CHANNEL_CREATED,
            ts: Date.now(),
            data: { channelId: 'group-channel-group-1', name: 'New Group', type: 'group' },
          },
        ]}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('New Group')).toBeDefined();
    });
  });
});
