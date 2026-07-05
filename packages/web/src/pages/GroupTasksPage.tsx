import { useState, useEffect, useCallback } from 'react';
import type { WSMessage } from '@agent-chat-box/shared';
import { TaskBoard } from '../components/TaskBoard';

interface Group {
  id: string;
  name: string;
  description?: string;
  owner_team_id: string;
}

interface GroupTasksPageProps {
  wsMessages?: WSMessage[];
}

export function GroupTasksPage({ wsMessages }: GroupTasksPageProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const teamId = localStorage.getItem('acb-teamId') || 'team-default';

  const fetchGroups = useCallback(() => {
    fetch(`/api/groups?team_id=${teamId}`)
      .then(r => {
        if (!r.ok) throw new Error('Failed to load groups');
        return r.json();
      })
      .then((data: Group[]) => {
        setGroups(data || []);
      })
      .catch(err => setError(err.message));
  }, [teamId]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-4 border-b border-gray-700 flex items-center gap-4">
        <h2 className="text-lg font-semibold">Group Tasks</h2>
        <select
          value={selectedGroupId || ''}
          onChange={e => setSelectedGroupId(e.target.value || null)}
          className="px-3 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select a group…</option>
          {groups.map(group => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
        <button
          onClick={fetchGroups}
          className="px-3 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-500 transition-colors"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-900/50 border-b border-red-700 text-red-200 text-sm">{error}</div>
      )}

      {selectedGroupId ? (
        <TaskBoard groupId={selectedGroupId} wsMessages={wsMessages} />
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          Select a group to view its tasks
        </div>
      )}
    </div>
  );
}
