import { useState, useEffect, useCallback } from 'react';
import { ReputationBadge } from '../components/ReputationBadge';

interface Group {
  id: string;
  name: string;
  description: string;
  owner_team_id: string;
  created_at: number;
  members?: Array<{
    team_id: string;
    team_name: string;
    role: string;
  }>;
}

interface Contract {
  shared_capabilities?: string[];
  resource_quota?: { max_tasks_per_hour?: number; max_retry_per_task?: number };
  authorization?: string;
  trust_threshold?: number;
  visibility?: { task_input?: boolean; task_output?: boolean; internal_log?: boolean };
}

export function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [reputation, setReputation] = useState<Record<string, number>>({});
  const [inviteCode, setInviteCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [teamId, setTeamId] = useState(localStorage.getItem('acb-teamId') || 'team-default');
  const [teamIdInput, setTeamIdInput] = useState(teamId);
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const fetchGroups = useCallback(() => {
    fetch(`/api/groups?team_id=${teamId}`)
      .then(r => r.json())
      .then(setGroups)
      .catch(console.error);
  }, [teamId]);

  const switchTeam = () => {
    const trimmed = teamIdInput.trim();
    if (!trimmed) return;
    localStorage.setItem('acb-teamId', trimmed);
    setTeamId(trimmed);
    setSelectedGroup(null);
  };

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  useEffect(() => {
    if (!selectedGroup) return;
    // Fetch full group details (including members) since the list endpoint omits them.
    fetch(`/api/groups/${selectedGroup.id}`)
      .then(r => r.json())
      .then((full: Group) => setSelectedGroup(prev => prev ? { ...prev, members: full.members } : prev))
      .catch(console.error);
    fetch(`/api/groups/${selectedGroup.id}/contract`)
      .then(r => r.json())
      .then(data => setContract(data.contract))
      .catch(console.error);
    fetch(`/api/groups/${selectedGroup.id}/reputation`)
      .then(r => r.json())
      .then((rows: Array<{ team_id: string; total_score: number }>) => {
        setReputation(Object.fromEntries(rows.map(row => [row.team_id, row.total_score])));
      })
      .catch(() => setReputation({}));
  }, [selectedGroup?.id]);

  const createGroup = () => {
    if (!newGroupName.trim()) return;
    fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newGroupName, description: newGroupDesc, owner_team_id: teamId }),
    })
      .then(r => {
        if (!r.ok) throw new Error('Failed to create group');
        return r.json();
      })
      .then(() => {
        setShowCreate(false);
        setNewGroupName('');
        setNewGroupDesc('');
        fetchGroups();
      })
      .catch(err => setError(err.message));
  };

  const generateInvite = (groupId: string) => {
    fetch(`/api/groups/${groupId}/invite`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      .then(r => r.json())
      .then(data => setInviteCode(data.invite_code))
      .catch(console.error);
  };

  const joinGroup = () => {
    if (!joinCode.trim()) return;
    fetch('/api/groups/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_code: joinCode, team_id: teamId }),
    })
      .then(r => {
        if (!r.ok) throw new Error('Failed to join group');
        return r.json();
      })
      .then(() => {
        setJoinCode('');
        fetchGroups();
      })
      .catch(err => setError(err.message));
  };

  const updateContract = () => {
    if (!selectedGroup || !contract) return;
    fetch(`/api/groups/${selectedGroup.id}/contract`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contract }),
    })
      .then(r => {
        if (!r.ok) throw new Error('Failed to update contract');
        setError('');
      })
      .catch(err => setError(err.message));
  };

  const leaveGroup = () => {
    if (!selectedGroup) return;
    fetch(`/api/groups/${selectedGroup.id}/leave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_id: teamId }),
    })
      .then(r => {
        if (!r.ok) throw new Error('Failed to leave group');
        setSelectedGroup(null);
        fetchGroups();
      })
      .catch(err => setError(err.message));
  };

  const deleteGroup = () => {
    if (!selectedGroup) return;
    fetch(`/api/groups/${selectedGroup.id}`, { method: 'DELETE' })
      .then(r => {
        if (!r.ok) throw new Error('Failed to delete group');
        setSelectedGroup(null);
        setShowDeleteConfirm(false);
        fetchGroups();
      })
      .catch(err => {
        setShowDeleteConfirm(false);
        setError(err.message);
      });
  };

  return (
    <div className="flex h-full">
      {/* Sidebar: Group list */}
      <div className="w-80 border-r border-gray-700 bg-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold">Groups</h2>
            <button onClick={() => setShowCreate(true)} className="px-3 py-1 bg-blue-600 rounded-lg text-sm hover:bg-blue-700">+ New</button>
          </div>
          <div className="flex gap-2 mb-3">
            <input
              value={teamIdInput}
              onChange={e => setTeamIdInput(e.target.value)}
              placeholder="Team ID"
              className="flex-1 bg-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button onClick={switchTeam} className="px-3 py-1.5 bg-gray-600 rounded-lg text-sm hover:bg-gray-500">Switch</button>
          </div>
          <div className="flex gap-2">
            <input
              value={joinCode}
              onChange={e => setJoinCode(e.target.value)}
              placeholder="Invite code"
              className="flex-1 bg-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button onClick={joinGroup} className="px-3 py-1.5 bg-green-600 rounded-lg text-sm hover:bg-green-700">Join</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {groups.map(g => (
            <button
              key={g.id}
              onClick={() => { setSelectedGroup(g); setInviteCode(''); setError(''); }}
              className={`w-full text-left px-4 py-3 border-b border-gray-700 hover:bg-gray-700 transition-colors ${selectedGroup?.id === g.id ? 'bg-gray-700' : ''}`}
            >
              <div className="font-medium">{g.name}</div>
              <div className="text-xs text-gray-400">{g.members?.length || 0} members</div>
            </button>
          ))}
        </div>
      </div>

      {/* Main: Group detail */}
      <div className="flex-1 bg-gray-900 p-6 overflow-y-auto">
        {error && <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm">{error}</div>}

        {showDeleteConfirm && selectedGroup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
              <h3 className="text-lg font-bold mb-2">Delete Group?</h3>
              <p className="text-gray-300 text-sm mb-6">
                This will permanently delete <span className="font-semibold text-white">{selectedGroup.name}</span>. This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    deleteGroup();
                  }}
                  className="px-4 py-2 bg-red-900 rounded-lg hover:bg-red-800 text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {showCreate ? (
          <div className="max-w-md">
            <h3 className="text-xl font-bold mb-4">Create Group</h3>
            <input
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              placeholder="Group name"
              className="w-full bg-gray-800 rounded-lg px-4 py-2.5 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <textarea
              value={newGroupDesc}
              onChange={e => setNewGroupDesc(e.target.value)}
              placeholder="Description"
              className="w-full bg-gray-800 rounded-lg px-4 py-2.5 mb-3 h-24 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-3">
              <button onClick={createGroup} className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700">Create</button>
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600">Cancel</button>
            </div>
          </div>
        ) : selectedGroup ? (
          <div className="max-w-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold">{selectedGroup.name}</h2>
                <p className="text-gray-400">{selectedGroup.description || 'No description'}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => generateInvite(selectedGroup.id)}
                  className="px-4 py-2 bg-purple-600 rounded-lg hover:bg-purple-700 text-sm"
                >
                  Invite Code
                </button>
                {selectedGroup.members?.some(m => m.team_id === teamId && m.role !== 'owner') && (
                  <button
                    onClick={leaveGroup}
                    className="px-4 py-2 bg-red-700 rounded-lg hover:bg-red-600 text-sm"
                  >
                    Leave Group
                  </button>
                )}
                {selectedGroup.owner_team_id === teamId && (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-4 py-2 bg-red-900 rounded-lg hover:bg-red-800 text-sm"
                  >
                    Delete Group
                  </button>
                )}
              </div>
            </div>

            {inviteCode && (
              <div className="mb-6 p-3 bg-purple-900/30 border border-purple-700 rounded-lg">
                <div className="text-sm text-purple-200">Invite code: <span className="font-mono font-bold">{inviteCode}</span></div>
              </div>
            )}

            {/* Members */}
            <div className="mb-6">
              <h3 className="text-lg font-bold mb-3">Members</h3>
              <div className="bg-gray-800 rounded-lg border border-gray-700">
                {selectedGroup.members?.map(m => (
                  <div key={m.team_id} className="px-4 py-3 border-b border-gray-700 last:border-0 flex items-center justify-between">
                    <span>{m.team_name}</span>
                    <div className="flex items-center gap-2">
                      <ReputationBadge score={reputation[m.team_id] ?? 0} />
                      <span className="text-xs px-2 py-1 bg-gray-700 rounded">{m.role}</span>
                    </div>
                  </div>
                )) || <div className="px-4 py-3 text-gray-500">No members</div>}
              </div>
            </div>

            {/* Contract editor */}
            <div>
              <h3 className="text-lg font-bold mb-3">Contract</h3>
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 space-y-4">
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Shared Capabilities</label>
                  <input
                    type="text"
                    value={(contract?.shared_capabilities || []).join(', ')}
                    onChange={e => setContract(prev => ({
                      ...prev!,
                      shared_capabilities: [...new Set(e.target.value.split(',').map(cap => cap.trim()).filter(Boolean))],
                    }))}
                    placeholder="code, review, test"
                    className="w-full bg-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Authorization Mode</label>
                  <select
                    value={contract?.authorization || 'manual'}
                    onChange={e => setContract(prev => ({ ...prev!, authorization: e.target.value }))}
                    className="w-full bg-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="manual">Manual</option>
                    <option value="auto">Auto</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Trust Threshold</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={contract?.trust_threshold || 0.5}
                    onChange={e => setContract(prev => ({ ...prev!, trust_threshold: parseFloat(e.target.value) }))}
                    className="w-full"
                  />
                  <div className="text-right text-sm text-gray-400">{contract?.trust_threshold || 0.5}</div>
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Max Tasks Per Hour</label>
                  <input
                    type="number"
                    value={contract?.resource_quota?.max_tasks_per_hour || 10}
                    onChange={e => setContract(prev => ({ ...prev!, resource_quota: { ...prev?.resource_quota, max_tasks_per_hour: parseInt(e.target.value) } }))}
                    className="w-full bg-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Max Retries Per Task</label>
                  <input
                    type="number"
                    value={contract?.resource_quota?.max_retry_per_task || 3}
                    onChange={e => setContract(prev => ({ ...prev!, resource_quota: { ...prev?.resource_quota, max_retry_per_task: parseInt(e.target.value) } }))}
                    className="w-full bg-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={contract?.visibility?.task_input !== false}
                      onChange={e => setContract(prev => ({ ...prev!, visibility: { ...prev?.visibility, task_input: e.target.checked } }))}
                    />
                    Show task input
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={contract?.visibility?.task_output !== false}
                      onChange={e => setContract(prev => ({ ...prev!, visibility: { ...prev?.visibility, task_output: e.target.checked } }))}
                    />
                    Show task output
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={contract?.visibility?.internal_log === true}
                      onChange={e => setContract(prev => ({ ...prev!, visibility: { ...prev?.visibility, internal_log: e.target.checked } }))}
                    />
                    Show internal logs
                  </label>
                </div>
                <button onClick={updateContract} className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700">Save Contract</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">Select a group to view details</div>
        )}
      </div>
    </div>
  );
}
