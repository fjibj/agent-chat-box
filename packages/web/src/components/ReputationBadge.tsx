export function ReputationBadge({ score }: { score: number }) {
  let colorClass = 'bg-gray-600';
  if (score >= 4) colorClass = 'bg-green-600';
  else if (score >= 1) colorClass = 'bg-yellow-600';
  else if (score < 0) colorClass = 'bg-red-600';

  return (
    <span className={`inline-block px-2 py-1 rounded text-xs text-white ${colorClass}`}>
      {score}
    </span>
  );
}
