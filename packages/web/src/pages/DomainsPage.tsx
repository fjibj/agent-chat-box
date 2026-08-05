import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ReputationBadge } from '../components/ReputationBadge';

interface Group {
  id: string;
  name: string;
  description: string;
  owner_team_id: string;
}

interface DomainSummary {
  id: string;
  name: string;
  description: string;
  owner_group_id: string;
  created_at: number;
}

interface DomainMember {
  group_id: string;
  group_name: string;
  role: string;
  capabilities?: string;
  joined_at?: number;
}

interface DomainDetail extends DomainSummary {
  members: DomainMember[];
}

interface MemberCapability {
  group_id: string;
  group_name: string;
  capabilities: string[];
}

interface DiscoverResult {
  group_id: string;
  group_name: string;
  capabilities: string[];
  reputation: number;
  flagged: boolean;
}

interface ReputationEntry {
  group_id: string;
  group_name: string;
  reputation: number;
  flagged: boolean;
}

interface CollabTask {
  task_id: string;
  requester_group_id: string;
  target_group_id: string;
  status: string;
  title: string;
  created_at: number;
}

/** Fetch JSON and surface the server's {error} message on non-2xx responses. */
async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = init ? await fetch(url, init) : await fetch(url);
  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      if (body && typeof body.error === 'string') message = body.error;
    } catch {
      // Non-JSON error body; keep the generic status message.
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

/** Split a comma-separated tag input into a de-duplicated list. */
function parseTags(input: string): string[] {
  return [
    ...new Set(
      input
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  ];
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString();
}

export function DomainsPage() {
  const [teamId] = useState(() => localStorage.getItem('acb-teamId') || 'team-default');
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [selectedGroupId, setSelectedGroupId] = useState('');

  const [domains, setDomains] = useState<DomainSummary[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<DomainDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [newDomainName, setNewDomainName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [capabilityInput, setCapabilityInput] = useState('');
  const [memberCapabilities, setMemberCapabilities] = useState<MemberCapability[]>([]);
  const [discoverInput, setDiscoverInput] = useState('');
  const [discoverResults, setDiscoverResults] = useState<DiscoverResult[]>([]);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskCaps, setTaskCaps] = useState('');
  const [tasks, setTasks] = useState<CollabTask[]>([]);
  const [reputationBoard, setReputationBoard] = useState<ReputationEntry[]>([]);

  const [error, setError] = useState('');

  const fetchGroups = useCallback(() => {
    setGroupsLoading(true);
    apiFetch<Group[]>(`/api/groups?team_id=${teamId}`)
      .then((data) => {
        setGroups(data || []);
        // Drop the selection if the chosen group no longer exists.
        setSelectedGroupId((prev) => (prev && data?.some((g) => g.id === prev) ? prev : ''));
      })
      .catch((err) => setError(err.message))
      .finally(() => setGroupsLoading(false));
  }, [teamId]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const fetchDomains = useCallback(() => {
    if (!selectedGroupId) return;
    apiFetch<DomainSummary[]>(`/api/domains?group_id=${selectedGroupId}`)
      .then(setDomains)
      .catch((err) => setError(err.message));
  }, [selectedGroupId]);

  useEffect(() => {
    setDomains([]);
    setSelectedDomain(null);
    setError('');
    if (selectedGroupId) fetchDomains();
  }, [selectedGroupId, fetchDomains]);

  const loadDomain = useCallback(
    (domainId: string) => {
      if (!selectedGroupId) return;
      setDetailLoading(true);
      setInviteCode('');
      setDiscoverResults([]);
      setError('');
      apiFetch<DomainDetail>(`/api/domains/${domainId}`)
        .then((detail) => setSelectedDomain(detail))
        .catch((err) => setError(err.message))
        .finally(() => setDetailLoading(false));
      apiFetch<MemberCapability[]>(`/api/domains/${domainId}/capabilities`)
        .then(setMemberCapabilities)
        .catch(() => setMemberCapabilities([]));
      apiFetch<CollabTask[]>(`/api/domains/${domainId}/tasks?group_id=${selectedGroupId}`)
        .then(setTasks)
        .catch(() => setTasks([]));
      apiFetch<ReputationEntry[]>(`/api/domains/${domainId}/reputation?group_id=${selectedGroupId}`)
        .then(setReputationBoard)
        .catch(() => setReputationBoard([]));
    },
    [selectedGroupId],
  );

  const createDomain = () => {
    if (!newDomainName.trim() || !selectedGroupId) return;
    apiFetch<DomainSummary>('/api/domains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newDomainName,
        description: '',
        owner_group_id: selectedGroupId,
      }),
    })
      .then(() => {
        setShowCreate(false);
        setNewDomainName('');
        fetchDomains();
      })
      .catch((err) => setError(err.message));
  };

  const joinDomain = () => {
    if (!joinCode.trim() || !selectedGroupId) return;
    apiFetch('/api/domains/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_code: joinCode, group_id: selectedGroupId }),
    })
      .then(() => {
        setJoinCode('');
        fetchDomains();
      })
      .catch((err) => setError(err.message));
  };

  const generateInvite = () => {
    if (!selectedDomain) return;
    apiFetch<{ invite_code: string }>(`/api/domains/${selectedDomain.id}/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
      .then((data) => setInviteCode(data.invite_code))
      .catch((err) => setError(err.message));
  };

  const leaveDomain = () => {
    if (!selectedDomain) return;
    if (selectedDomain.owner_group_id === selectedGroupId) {
      setError('域主不能退出域，请解散域');
      return;
    }
    apiFetch(`/api/domains/${selectedDomain.id}/leave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group_id: selectedGroupId }),
    })
      .then(() => {
        setSelectedDomain(null);
        fetchDomains();
      })
      .catch((err) => setError(err.message));
  };

  const dissolveDomain = () => {
    if (!selectedDomain) return;
    apiFetch(`/api/domains/${selectedDomain.id}`, { method: 'DELETE' })
      .then(() => {
        setSelectedDomain(null);
        setShowDeleteConfirm(false);
        fetchDomains();
      })
      .catch((err) => {
        setShowDeleteConfirm(false);
        setError(err.message);
      });
  };

  const declareCapabilities = () => {
    if (!selectedDomain) return;
    const caps = parseTags(capabilityInput);
    apiFetch(`/api/domains/${selectedDomain.id}/capabilities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group_id: selectedGroupId, capabilities: caps }),
    })
      .then(() => {
        setCapabilityInput('');
        apiFetch<MemberCapability[]>(`/api/domains/${selectedDomain.id}/capabilities`)
          .then(setMemberCapabilities)
          .catch((err) => setError(err.message));
      })
      .catch((err) => setError(err.message));
  };

  const runDiscover = () => {
    if (!selectedDomain) return;
    const caps = parseTags(discoverInput).join(',');
    apiFetch<DiscoverResult[]>(
      `/api/domains/${selectedDomain.id}/discover?capabilities=${caps}&group_id=${selectedGroupId}`,
    )
      .then(setDiscoverResults)
      .catch((err) => setError(err.message));
  };

  const createTask = () => {
    if (!selectedDomain) return;
    const required = parseTags(taskCaps);
    if (!taskTitle.trim() || required.length === 0) return;
    apiFetch(`/api/domains/${selectedDomain.id}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requester_group_id: selectedGroupId,
        title: taskTitle,
        required_capabilities: required,
      }),
    })
      .then(() => {
        setTaskTitle('');
        setTaskCaps('');
        apiFetch<CollabTask[]>(
          `/api/domains/${selectedDomain.id}/tasks?group_id=${selectedGroupId}`,
        )
          .then(setTasks)
          .catch((err) => setError(err.message));
      })
      .catch((err) => setError(err.message));
  };

  const rateTask = (taskId: string, decision: 'approved' | 'rejected') => {
    if (!selectedDomain) return;
    apiFetch(`/api/domains/${selectedDomain.id}/tasks/${taskId}/rating`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rater_group_id: selectedGroupId, decision }),
    })
      .then(() => {
        apiFetch<CollabTask[]>(
          `/api/domains/${selectedDomain.id}/tasks?group_id=${selectedGroupId}`,
        )
          .then(setTasks)
          .catch((err) => setError(err.message));
        apiFetch<ReputationEntry[]>(
          `/api/domains/${selectedDomain.id}/reputation?group_id=${selectedGroupId}`,
        )
          .then(setReputationBoard)
          .catch(() => setReputationBoard([]));
      })
      .catch((err) => setError(err.message));
  };

  const memberName = (groupId: string): string =>
    selectedDomain?.members.find((m) => m.group_id === groupId)?.group_name || groupId;

  const isOwner = selectedDomain?.owner_group_id === selectedGroupId;

  return (
    <div className="flex h-full">
      {/* Sidebar: group selector + domain list */}
      <div className="w-80 border-r border-gray-700 bg-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold">Domains</h2>
            <button
              onClick={() => setShowCreate(true)}
              disabled={!selectedGroupId}
              className="px-3 py-1 bg-blue-600 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + New
            </button>
          </div>
          <div className="mb-3">
            <label className="text-xs text-gray-400 block mb-1">
              Acting as group (team {teamId})
            </label>
            <select
              value={selectedGroupId}
              onChange={(e) => {
                setSelectedGroupId(e.target.value);
              }}
              className="w-full bg-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a group…</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <button
              onClick={fetchGroups}
              className="mt-2 w-full px-3 py-1.5 bg-gray-600 rounded-lg text-sm hover:bg-gray-500"
            >
              Refresh Groups
            </button>
          </div>
          <div className="flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Invite code"
              className="flex-1 bg-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={joinDomain}
              disabled={!selectedGroupId || !joinCode.trim()}
              className="px-3 py-1.5 bg-green-600 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Join
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {domains.map((d) => (
            <button
              key={d.id}
              onClick={() => loadDomain(d.id)}
              className={`w-full text-left px-4 py-3 border-b border-gray-700 hover:bg-gray-700 transition-colors ${
                selectedDomain?.id === d.id ? 'bg-gray-700' : ''
              }`}
            >
              <div className="font-medium">{d.name}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                {d.owner_group_id === selectedGroupId ? 'Owner' : 'Member'} · created{' '}
                {formatDate(d.created_at)}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main: domain detail */}
      <div className="flex-1 bg-gray-900 p-6 overflow-y-auto">
        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm">
            {error}
          </div>
        )}

        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
              <h3 className="text-lg font-bold mb-4">Create Domain</h3>
              <input
                autoFocus
                value={newDomainName}
                onChange={(e) => setNewDomainName(e.target.value)}
                placeholder="Domain name"
                className="w-full bg-gray-700 rounded-lg px-4 py-2.5 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowCreate(false);
                    setNewDomainName('');
                  }}
                  className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={createDomain}
                  disabled={!newDomainName.trim()}
                  className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {showDeleteConfirm && selectedDomain && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
              <h3 className="text-lg font-bold mb-2">Dissolve Domain?</h3>
              <p className="text-gray-300 text-sm mb-6">
                This will permanently dissolve{' '}
                <span className="font-semibold text-white">{selectedDomain.name}</span> and remove
                every member group. This action cannot be undone.
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
                    dissolveDomain();
                  }}
                  className="px-4 py-2 bg-red-900 rounded-lg hover:bg-red-800 text-sm"
                >
                  Dissolve
                </button>
              </div>
            </div>
          </div>
        )}

        {groupsLoading ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            Loading groups…
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <p className="mb-2">No groups found for team {teamId}.</p>
            <p className="mb-4 text-sm">Create or join a group first to manage domains.</p>
            <Link
              to="/groups"
              className="px-4 py-2 bg-blue-600 rounded-lg text-sm text-white hover:bg-blue-700"
            >
              Go to Groups
            </Link>
          </div>
        ) : !selectedGroupId ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            Select a group to manage domains
          </div>
        ) : domains.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <p className="mb-2">No domains yet for the selected group.</p>
            <p className="text-sm">
              Create a new domain or join one with an invite code from the sidebar.
            </p>
          </div>
        ) : !selectedDomain ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            {detailLoading ? 'Loading domain…' : 'Select a domain to view details'}
          </div>
        ) : (
          <div className="max-w-3xl">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold">{selectedDomain.name}</h2>
                <p className="text-gray-400">{selectedDomain.description || 'No description'}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Owner: {memberName(selectedDomain.owner_group_id)} ·{' '}
                  {selectedDomain.members?.length || 0} members
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={generateInvite}
                  className="px-4 py-2 bg-purple-600 rounded-lg hover:bg-purple-700 text-sm"
                >
                  Invite Code
                </button>
                <button
                  onClick={leaveDomain}
                  className="px-4 py-2 bg-red-700 rounded-lg hover:bg-red-600 text-sm"
                >
                  Leave Domain
                </button>
                {isOwner && (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-4 py-2 bg-red-900 rounded-lg hover:bg-red-800 text-sm"
                  >
                    Dissolve Domain
                  </button>
                )}
              </div>
            </div>

            {inviteCode && (
              <div className="mb-6 p-3 bg-purple-900/30 border border-purple-700 rounded-lg">
                <div className="text-sm text-purple-200">
                  Invite code: <span className="font-mono font-bold">{inviteCode}</span>
                </div>
              </div>
            )}

            {/* Members */}
            <section className="mb-8">
              <h3 className="text-lg font-bold mb-3">Members</h3>
              <div className="bg-gray-800 rounded-lg border border-gray-700">
                {selectedDomain.members?.map((m) => (
                  <div
                    key={m.group_id}
                    className="px-4 py-3 border-b border-gray-700 last:border-0 flex items-center justify-between"
                  >
                    <span>{m.group_name}</span>
                    <span className="text-xs px-2 py-1 bg-gray-700 rounded">{m.role}</span>
                  </div>
                )) || <div className="px-4 py-3 text-gray-500">No members</div>}
              </div>
            </section>

            {/* Capability declaration */}
            <section className="mb-8">
              <h3 className="text-lg font-bold mb-3">Capabilities</h3>
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                <div className="flex gap-2 mb-4">
                  <input
                    value={capabilityInput}
                    onChange={(e) => setCapabilityInput(e.target.value)}
                    placeholder="code, review, test"
                    className="flex-1 bg-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={declareCapabilities}
                    className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 text-sm"
                  >
                    Declare
                  </button>
                </div>
                <div className="space-y-2">
                  {memberCapabilities.map((mc) => (
                    <div
                      key={mc.group_id}
                      className="flex items-center justify-between bg-gray-700/50 rounded-lg px-3 py-2"
                    >
                      <span className="text-sm">{mc.group_name}</span>
                      <div className="flex flex-wrap gap-1 justify-end">
                        {mc.capabilities.length > 0 ? (
                          mc.capabilities.map((cap) => (
                            <span
                              key={cap}
                              className="text-xs bg-gray-600 px-2 py-1 rounded text-gray-200"
                            >
                              {cap}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-500">No capabilities declared</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {memberCapabilities.length === 0 && (
                    <div className="text-sm text-gray-500">No capabilities declared yet.</div>
                  )}
                </div>
              </div>
            </section>

            {/* Discovery */}
            <section className="mb-8">
              <h3 className="text-lg font-bold mb-3">Discover</h3>
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                <div className="flex gap-2 mb-4">
                  <input
                    value={discoverInput}
                    onChange={(e) => setDiscoverInput(e.target.value)}
                    placeholder="Required capabilities (e.g. code, test)"
                    className="flex-1 bg-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={runDiscover}
                    className="px-4 py-2 bg-cyan-700 rounded-lg hover:bg-cyan-600 text-sm"
                  >
                    Search
                  </button>
                </div>
                <div className="space-y-2">
                  {discoverResults.map((r) => (
                    <div
                      key={r.group_id}
                      className="flex items-center justify-between bg-gray-700/50 rounded-lg px-3 py-2"
                    >
                      <div>
                        <span className="text-sm font-medium">{r.group_name}</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {r.capabilities.map((cap) => (
                            <span
                              key={cap}
                              className="text-xs bg-gray-600 px-2 py-1 rounded text-gray-200"
                            >
                              {cap}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.flagged && (
                          <span className="text-xs px-2 py-1 bg-red-900 rounded text-red-200">
                            flagged
                          </span>
                        )}
                        <ReputationBadge score={r.reputation} />
                      </div>
                    </div>
                  ))}
                  {discoverResults.length === 0 && (
                    <div className="text-sm text-gray-500">
                      Enter capabilities and search to find matching member groups.
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Collaboration tasks */}
            <section className="mb-8">
              <h3 className="text-lg font-bold mb-3">Collaboration Tasks</h3>
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                <div className="mb-4 space-y-2">
                  <input
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder="Task title"
                    className="w-full bg-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex gap-2">
                    <input
                      value={taskCaps}
                      onChange={(e) => setTaskCaps(e.target.value)}
                      placeholder="Required capabilities (e.g. code)"
                      className="flex-1 bg-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={createTask}
                      disabled={!taskTitle.trim() || parseTags(taskCaps).length === 0}
                      className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Initiate
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {tasks.map((t) => (
                    <div
                      key={t.task_id}
                      className="flex items-center justify-between bg-gray-700/50 rounded-lg px-3 py-2"
                    >
                      <div>
                        <div className="text-sm font-medium">{t.title}</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {memberName(t.requester_group_id)} → {memberName(t.target_group_id)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-1 bg-gray-600 rounded">{t.status}</span>
                        {t.status === 'completed' && t.requester_group_id === selectedGroupId && (
                          <>
                            <button
                              onClick={() => rateTask(t.task_id, 'approved')}
                              className="px-2 py-1 text-xs bg-green-700 rounded hover:bg-green-600"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => rateTask(t.task_id, 'rejected')}
                              className="px-2 py-1 text-xs bg-red-800 rounded hover:bg-red-700"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  {tasks.length === 0 && (
                    <div className="text-sm text-gray-500">No collaboration tasks yet.</div>
                  )}
                </div>
              </div>
            </section>

            {/* Reputation board */}
            <section className="mb-4">
              <h3 className="text-lg font-bold mb-3">Reputation</h3>
              <div className="bg-gray-800 rounded-lg border border-gray-700">
                {reputationBoard.map((r) => (
                  <div
                    key={r.group_id}
                    className="px-4 py-3 border-b border-gray-700 last:border-0 flex items-center justify-between"
                  >
                    <span>{r.group_name}</span>
                    <div className="flex items-center gap-2">
                      {r.flagged && (
                        <span className="text-xs px-2 py-1 bg-red-900 rounded text-red-200">
                          flagged
                        </span>
                      )}
                      <ReputationBadge score={r.reputation} />
                    </div>
                  </div>
                ))}
                {reputationBoard.length === 0 && (
                  <div className="px-4 py-3 text-gray-500">No reputation data yet.</div>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
