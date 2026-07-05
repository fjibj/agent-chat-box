import { useState } from 'react';
import { ReputationEventsModal } from './ReputationEventsModal';

interface ReputationBadgeProps {
  score: number;
  groupId?: string;
  teamId?: string;
  teamName?: string;
}

export function ReputationBadge({ score, groupId, teamId, teamName }: ReputationBadgeProps) {
  const [modalOpen, setModalOpen] = useState(false);

  let colorClass = 'bg-red-600';
  if (score >= 5) colorClass = 'bg-green-600';
  else if (score >= 1) colorClass = 'bg-yellow-600';

  const badge = (
    <span className={`inline-block px-2 py-1 rounded text-xs text-white ${colorClass}`}>
      {score}
    </span>
  );

  // Without context, keep the badge non-interactive for backwards compatibility
  if (!groupId || !teamId) {
    return badge;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="cursor-pointer hover:ring-2 hover:ring-white/50 rounded transition-shadow"
        title="View reputation events"
      >
        {badge}
      </button>
      <ReputationEventsModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        groupId={groupId}
        teamId={teamId}
        teamName={teamName}
      />
    </>
  );
}
