import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageInput } from './MessageInput';

describe('MessageInput', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url === '/api/channels/ch-1/members') {
        return Promise.resolve({
          json: () =>
            Promise.resolve({
              members: [
                { memberId: 'u1', name: 'Alice', memberKind: 'human' },
                { memberId: 'a1', name: 'agent-b1', memberKind: 'agent' },
              ],
            }),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });
  });

  it('shows @mention dropdown for cross-team agents (M10-04)', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    render(<MessageInput channelId="ch-1" onSend={onSend} />);

    const textarea = screen.getByPlaceholderText('Type a message... (@ to mention)');
    await user.type(textarea, 'Hello @agent');

    await waitFor(() => {
      expect(screen.getByText('agent-b1')).toBeDefined();
      expect(screen.getByText('BOT')).toBeDefined();
    });
  });

  it('sends message with mentions array (M10-05)', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    render(<MessageInput channelId="ch-1" onSend={onSend} />);

    const textarea = screen.getByPlaceholderText('Type a message... (@ to mention)');
    await user.type(textarea, 'Hi @agent-b1 please help');
    await user.click(screen.getByText('Send'));

    await waitFor(() => {
      expect(onSend).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'message.send',
          data: expect.objectContaining({
            channel_id: 'ch-1',
            content: 'Hi @agent-b1 please help',
            mentions: ['agent-b1'],
          }),
        }),
      );
    });
  });
});
