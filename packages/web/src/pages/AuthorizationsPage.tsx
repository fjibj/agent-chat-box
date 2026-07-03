import { useState, useEffect, useCallback } from 'react';
import { ReputationBadge } from '../components/ReputationBadge';

interface AuthRequest {
  id: string;
  task_title: string;
  task_description: string;
  agent_name: string;
  agent_runtime: string;
  requesting_team_id: string;
  group_id: string;
  status: string;
  created_at: number;
  expires_at: number;
}

export function AuthorizationsPage() {
  const [pending, setPending] = useState<AuthRequest[]>([]);
  const [reputation, setReputation] = useState<Record<string, number>>({});
  const [teamId] = useState('team-default');
  const [error, setError] = useState('');

  const fetchPending = useCallback(() => {
    fetch(`/api/authorizations/pending?team_id=${teamId}`)
      .then(r => r.json())
      .then(setPending)
      .catch(console.error);
  }, [teamId]);

  useEffect(() => {
    fetchPending();
    const interval = setInterval(fetchPending, 10_000);
    return () => clearInterval(interval);
  }, [fetchPending]);

  useEffect(() => {
    const pairs = pending
      .filter(ar => ar.group_id && ar.requesting_team_id)
      .map(ar => [ar.group_id, ar.requesting_team_id] as const);
    const uniquePairs = [...new Map(pairs.map(pair => [`${pair[0]}:${pair[1]}`, pair])).values()];
    if (uniquePairs.length === 0) {
      setReputation({});
      return;
    }
    Promise.all(uniquePairs.map(([groupId, requestingTeamId]) =>
      fetch(`/api/groups/${groupId}/reputation/${requestingTeamId}`)
        .then(r => r.json())
        .then(data => [requestingTeamId, data.total_score ?? 0] as const)
        .catch(() => [requestingTeamId, 0] as const),
    )).then(entries => setReputation(Object.fromEntries(entries)));
  }, [pending]);

  const handleApprove = (id: string) => {
    fetch(`/api/authorizations/${id}/approve`, { method: 'POST' })
      .then(r => {
        if (!r.ok) throw new Error('Failed to approve');
        fetchPending();
      })
      .catch(err => setError(err.message));
  };

  const handleReject = (id: string) => {
    fetch(`/api/authorizations/${id}/reject`, { method: 'POST' })
      .then(r => {
        if (!r.ok) throw new Error('Failed to reject');
        fetchPending();
      })
      .catch(err => setError(err.message));
  };

  const formatTime = (ts: number) => {
    const diff = ts - Math.floor(Date.now() / 1000);
    if (diff <= 0) return 'Expired';
    const m = Math.floor(diff / 60);
    const s = diff % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Authorization Requests</h2>
      {error && <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm">{error}</div>}

      {pending.length === 0 ? (
        <div className="text-center text-gray-500 py-12">No pending authorization requests</div>
      ) : (
        <div className="space-y-4">
          {pending.map(ar => (
            <div key={ar.id} className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-semibold">{ar.task_title}</div>
                  <div className="text-sm text-gray-400">{ar.task_description || 'No description'}</div>
                </div>
                <div className={`text-sm font-mono ${ar.expires_at - Math.floor(Date.now() / 1000) < 60 ? 'text-red-400' : 'text-gray-400'}`}>
                  {formatTime(ar.expires_at)}
                </div>
              </div>
              <div className="flex items-center gap-4 mb-3 text-sm text-gray-400">
                <span>Agent: {ar.agent_name} ({ar.agent_runtime})</span>
                <span>Team: {ar.requesting_team_id.slice(0, 8)}...</span>
                <span className="flex items-center gap-1">Reputation: <ReputationBadge score={reputation[ar.requesting_team_id] ?? 0} /></span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => handleApprove(ar.id)}
                  className="px-4 py-2 bg-green-600 rounded-lg hover:bg-green-700 text-sm"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleReject(ar.id)}
                  className="px-4 py-2 bg-red-600 rounded-lg hover:bg-red-700 text-sm"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
