interface MessageBubbleProps {
  senderId: string;
  senderName?: string;
  senderKind: 'human' | 'agent' | 'system';
  content: string;
  timestamp: number;
  isOwn?: boolean;
}

export function MessageBubble({ senderId, senderName, senderKind, content, timestamp, isOwn }: MessageBubbleProps) {
  const time = new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  const displayName = senderName || senderId;

  if (senderKind === 'system') {
    return (
      <div className="text-center text-xs text-gray-500 py-2">
        {content}
      </div>
    );
  }

  const isAgent = senderKind === 'agent';

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3`}>
      {/* Avatar (left side for others) */}
      {!isOwn && (
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mr-2 text-sm ${
          isAgent ? 'bg-blue-600' : 'bg-green-600'
        }`}>
          {isAgent ? '🤖' : '👤'}
        </div>
      )}

      <div className={`max-w-[70%] ${isOwn ? 'order-2' : ''}`}>
        {/* Sender name */}
        <div className={`text-xs mb-1 ${isOwn ? 'text-right' : ''}`}>
          <span className={isAgent ? 'text-blue-400 font-medium' : 'text-green-400 font-medium'}>
            {displayName}
          </span>
          {isAgent && (
            <span className="ml-1.5 text-[10px] px-1 py-0.5 rounded bg-blue-900/50 text-blue-300">
              BOT
            </span>
          )}
        </div>

        {/* Message bubble */}
        <div
          className={`px-4 py-2 rounded-2xl ${
            isOwn
              ? 'bg-blue-600 text-white rounded-br-md'
              : isAgent
              ? 'bg-gray-700 text-white rounded-bl-md border-l-2 border-blue-500'
              : 'bg-gray-600 text-white rounded-bl-md border-l-2 border-green-500'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap">{content}</p>
        </div>

        {/* Timestamp */}
        <div className={`text-xs text-gray-500 mt-1 ${isOwn ? 'text-right' : ''}`}>
          {time}
        </div>
      </div>

      {/* Avatar (right side for own) */}
      {isOwn && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center ml-2 text-sm">
          👤
        </div>
      )}
    </div>
  );
}
