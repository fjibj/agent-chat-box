export function ReputationBadge({ score }: { score: number }) {
  let colorClass = 'bg-red-600';
  if (score >= 5) colorClass = 'bg-green-600';
  else if (score >= 1) colorClass = 'bg-yellow-600';

  return (
    <span className={`inline-block px-2 py-1 rounded text-xs text-white ${colorClass}`}>
      {score}
    </span>
  );
}
