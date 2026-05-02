import { useState, useRef, useEffect, useCallback } from 'react';
import type { WSMessage } from '@agent-chat-box/shared';

interface Member {
  memberId: string;
  name: string;
  memberKind: 'human' | 'agent';
}

interface MessageInputProps {
  channelId: string;
  onSend: (msg: WSMessage) => void;
}

export function MessageInput({ channelId, onSend }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch members for @ mention
  useEffect(() => {
    fetch(`/api/channels/${channelId}/members`)
      .then(r => r.json())
      .then(data => setMembers(data.members || []))
      .catch(() => {});
  }, [channelId]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [message]);

  // Filter members for @ mention
  const filteredMembers = mentionQuery !== null
    ? members.filter(m => m.name.toLowerCase().includes(mentionQuery.toLowerCase()))
    : [];

  // Detect @ trigger
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setMessage(val);

    // Check if we're in a @ mention context
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@([\w-]*)$/);

    if (atMatch) {
      setMentionQuery(atMatch[1]);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  };

  // Insert selected mention
  const insertMention = useCallback((member: Member) => {
    const cursorPos = textareaRef.current?.selectionStart || message.length;
    const textBeforeCursor = message.slice(0, cursorPos);
    const textAfterCursor = message.slice(cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    const newText = textBeforeCursor.slice(0, atIndex) + `@${member.name} ` + textAfterCursor;
    setMessage(newText);
    setMentionQuery(null);
    textareaRef.current?.focus();
  }, [message]);

  const handleSend = () => {
    const content = message.trim();
    if (!content) return;

    // Extract @mentions
    const mentionRegex = /@([\w-]+)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push(match[1]);
    }

    onSend({
      v: 1,
      type: 'message.send',
      ts: Date.now(),
      data: {
        channel_id: channelId,
        content,
        mentions: mentions.length > 0 ? mentions : undefined,
      },
    });

    setMessage('');
    setMentionQuery(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle mention dropdown navigation
    if (mentionQuery !== null && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(i => (i + 1) % filteredMembers.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(i => (i - 1 + filteredMembers.length) % filteredMembers.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredMembers[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setMentionQuery(null);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="p-4 border-t border-gray-700 relative">
      {/* Mention dropdown */}
      {mentionQuery !== null && filteredMembers.length > 0 && (
        <div className="absolute bottom-full left-4 right-4 mb-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filteredMembers.map((member, i) => (
            <button
              key={member.memberId}
              onClick={() => insertMention(member)}
              className={`w-full text-left px-3 py-2 flex items-center space-x-2 ${
                i === mentionIndex ? 'bg-gray-700' : 'hover:bg-gray-700/50'
              }`}
            >
              <span>{member.memberKind === 'agent' ? '🤖' : '👤'}</span>
              <span className="text-sm text-white">{member.name}</span>
              <span className={`text-[10px] px-1 py-0.5 rounded-full ml-auto ${
                member.memberKind === 'agent'
                  ? 'bg-blue-900/50 text-blue-300'
                  : 'bg-green-900/50 text-green-300'
              }`}>
                {member.memberKind === 'agent' ? 'BOT' : 'HUMAN'}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="flex space-x-2">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (@ to mention)"
          className="flex-1 bg-gray-700 text-white rounded-lg px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
          rows={1}
        />
        <button
          onClick={handleSend}
          disabled={!message.trim()}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}
