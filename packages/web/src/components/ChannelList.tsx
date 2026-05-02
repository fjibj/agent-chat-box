import { useState, useEffect } from 'react';

interface Channel {
  id: string;
  name: string;
  description: string | null;
  type: string;
}

interface ChannelListProps {
  selectedChannelId: string | null;
  onSelectChannel: (channelId: string) => void;
}

export function ChannelList({ selectedChannelId, onSelectChannel }: ChannelListProps) {
  const [channels, setChannels] = useState<Channel[]>([]);

  useEffect(() => {
    fetch('/api/channels')
      .then(res => res.json())
      .then(data => setChannels(data.channels || []))
      .catch(console.error);
  }, []);

  return (
    <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
      <div className="p-3 border-b border-gray-700">
        <h2 className="text-sm font-semibold text-gray-400 uppercase">Channels</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {channels.map(channel => (
          <button
            key={channel.id}
            onClick={() => onSelectChannel(channel.id)}
            className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
              selectedChannelId === channel.id
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
            }`}
          >
            <span className="mr-2">#</span>
            {channel.name}
          </button>
        ))}
      </div>
    </div>
  );
}
