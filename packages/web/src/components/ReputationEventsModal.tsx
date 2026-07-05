import { useEffect, useState } from 'react';

interface ReputationEvent {
  id: string;
  event_type: string;
  score_delta: number;
  task_id: string | null;
  created_at: number;
}

interface ReputationEventsModalProps {
  open: boolean;
  onClose: () => void;
  groupId: string;
  teamId: string;
  teamName?: string;
}

export function ReputationEventsModal({
  open,
  onClose,
  groupId,
  teamId,
  teamName,
}: ReputationEventsModalProps) {
  const [events, setEvents] = useState<ReputationEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/groups/${groupId}/reputation/${teamId}/events`)
      .then(r => r.json())
      .then((data: ReputationEvent[]) => {
        setEvents(data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open, groupId, teamId]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-xl p-6 w-full max-w-2xl shadow-xl border border-gray-700"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            Reputation Events — {teamName || teamId}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-8">Loading…</div>
        ) : events.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No reputation events yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-400 uppercase border-b border-gray-700">
                <tr>
                  <th className="py-2 px-3">Event</th>
                  <th className="py-2 px-3">Score Delta</th>
                  <th className="py-2 px-3">Task</th>
                  <th className="py-2 px-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {events.map(event => (
                  <tr key={event.id} className="border-b border-gray-700/50 last:border-0">
                    <td className="py-2 px-3">{event.event_type}</td>
                    <td className={`py-2 px-3 font-mono ${event.score_delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {event.score_delta > 0 ? `+${event.score_delta}` : event.score_delta}
                    </td>
                    <td className="py-2 px-3 font-mono text-xs text-gray-400">
                      {event.task_id || '—'}
                    </td>
                    <td className="py-2 px-3 text-gray-400">
                      {new Date(event.created_at * 1000).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
