import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageBubble } from './MessageBubble';

describe('MessageBubble', () => {
  it('renders human message', () => {
    render(
      <MessageBubble
        senderId="user-1"
        senderName="Alice"
        senderKind="human"
        content="Hello world"
        timestamp={Date.now()}
        isOwn={false}
      />,
    );
    expect(screen.getByText('Alice')).toBeDefined();
    expect(screen.getByText('Hello world')).toBeDefined();
  });

  it('renders own message on the right', () => {
    const { container } = render(
      <MessageBubble
        senderId="user-1"
        senderName="Alice"
        senderKind="human"
        content="My message"
        timestamp={Date.now()}
        isOwn={true}
      />,
    );
    // Own message should have justify-end class
    expect(container.querySelector('.justify-end')).toBeDefined();
  });

  it('renders agent message with BOT tag', () => {
    render(
      <MessageBubble
        senderId="agent-1"
        senderName="TestBot"
        senderKind="agent"
        content="I am a bot"
        timestamp={Date.now()}
        isOwn={false}
      />,
    );
    expect(screen.getByText('TestBot')).toBeDefined();
    expect(screen.getByText('BOT')).toBeDefined();
  });

  it('renders system message centered', () => {
    const { container } = render(
      <MessageBubble
        senderId="system"
        senderKind="system"
        content="Task completed"
        timestamp={Date.now()}
      />,
    );
    expect(screen.getByText('Task completed')).toBeDefined();
    expect(container.querySelector('.text-center')).toBeDefined();
  });

  it('shows senderId when name is missing', () => {
    render(
      <MessageBubble
        senderId="uuid-123"
        senderKind="human"
        content="No name"
        timestamp={Date.now()}
      />,
    );
    expect(screen.getByText('uuid-123')).toBeDefined();
  });
});
