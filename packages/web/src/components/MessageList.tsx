import { useState, useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import type { WSMessage } from '@agent-chat-box/shared';

interface Message {
  id: string;
  channelId: string;
  senderId: string;
  senderName?: string;
  senderKind: 'human' | 'agent' | 'system';
  content: string;
  createdAt: number;
}

interface MessageListProps {
  channelId: string;
  wsMessages: WSMessage[];
  clientId?: string | null;
  onClear?: () => void;
}

export function MessageList({ channelId, wsMessages, clientId, onClear }: MessageListProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  // Load history
  useEffect(() => {
    fetch(`/api/channels/${channelId}/messages?limit=50`)
      .then(res => res.json())
      .then(data => {
        setMessages(data.messages || []);
        // Scroll to bottom after loading history
        requestAnimationFrame(() => {
          if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
          }
        });
      })
      .catch(console.error);
  }, [channelId]);

  // Append new messages from WebSocket
  useEffect(() => {
    const newMessages = wsMessages
      .filter(msg => msg.type === 'message.new' && (msg.data as { message?: Message })?.message?.channelId === channelId)
      .map(msg => (msg.data as { message: Message }).message);

    if (newMessages.length > 0) {
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const unique = newMessages.filter(m => !existingIds.has(m.id));
        return [...prev, ...unique];
      });
    }
  }, [wsMessages, channelId]);

  // Auto-scroll when new messages arrive (only if already at bottom)
  useEffect(() => {
    if (isAtBottomRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  // Track scroll position
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const threshold = 100;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header bar with clear button */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-800/50">
        <span className="text-xs text-gray-400">{messages.length} messages</span>
        {onClear && messages.length > 0 && (
          <button
            onClick={onClear}
            className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-700 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Scrollable message area */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 min-h-0"
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map(msg => (
            <MessageBubble
              key={msg.id}
              senderId={msg.senderId}
              senderName={msg.senderName}
              senderKind={msg.senderKind}
              content={msg.content}
              timestamp={msg.createdAt}
              isOwn={clientId ? msg.senderId === clientId : false}
            />
          ))
        )}
      </div>
    </div>
  );
}
