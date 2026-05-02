import { useState, useEffect } from 'react';

interface Member {
  memberId: string;
  name?: string;
  memberKind: 'human' | 'agent';
  joinedAt: number;
}

interface MemberListProps {
  channelId: string;
}

export function MemberList({ channelId }: MemberListProps) {
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    fetch(`/api/channels/${channelId}/members`)
      .then(r => r.json())
      .then(data => setMembers(data.members || []))
      .catch(console.error);
  }, [channelId]);

  return (
    <div className="w-56 bg-gray-800 border-l border-gray-700 flex flex-col">
      <div className="p-3 border-b border-gray-700">
        <h2 className="text-sm font-semibold text-gray-400 uppercase">
          Members — {members.length}
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {members.length === 0 ? (
          <div className="text-xs text-gray-500 p-2">No members yet</div>
        ) : (
          members.map(member => (
            <div
              key={member.memberId}
              className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-700/50"
            >
              {/* Icon */}
              <span className="text-base">
                {member.memberKind === 'agent' ? '🤖' : '👤'}
              </span>
              {/* Name */}
              <span className="text-sm text-gray-300 truncate">
                {member.name || member.memberId}
              </span>
              {/* Kind badge */}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ml-auto ${
                member.memberKind === 'agent'
                  ? 'bg-blue-900/50 text-blue-300'
                  : 'bg-green-900/50 text-green-300'
              }`}>
                {member.memberKind === 'agent' ? 'BOT' : 'HUMAN'}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
