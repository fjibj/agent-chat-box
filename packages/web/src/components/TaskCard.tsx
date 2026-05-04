interface TaskCardProps {
  id: string;
  title: string;
  description?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: string;
  mode?: 'compete' | 'collaborate';
  creatorId?: string;
  assigneeId?: string;
  names?: Record<string, string>;
  onClick?: () => void;
}

const priorityColors = {
  low: 'bg-gray-500',
  normal: 'bg-blue-500',
  high: 'bg-orange-500',
  urgent: 'bg-red-500',
};

const priorityLabels = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};

const statusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: 'bg-yellow-500', label: 'Pending' },
  claimed: { color: 'bg-blue-500', label: 'Claimed' },
  running: { color: 'bg-blue-400', label: 'Running' },
  completed: { color: 'bg-green-500', label: 'Done' },
  failed: { color: 'bg-red-500', label: 'Failed' },
};

export function TaskCard({ title, description, priority, status, mode, creatorId, assigneeId, names, onClick }: TaskCardProps) {
  const st = statusConfig[status] || { color: 'bg-gray-500', label: status };
  const creatorName = creatorId && names?.[creatorId];
  const assigneeName = assigneeId && names?.[assigneeId];

  return (
    <div
      onClick={onClick}
      className="bg-gray-700 rounded-lg p-4 cursor-pointer hover:bg-gray-600 transition-colors"
    >
      {/* Top row: priority + status + mode */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <span className={`text-xs px-2 py-1 rounded ${priorityColors[priority]} text-white`}>
            {priorityLabels[priority]}
          </span>
          <span className={`text-xs px-2 py-1 rounded ${st.color} text-white`}>
            {st.label}
          </span>
          {mode && (
            <span className="text-xs px-2 py-1 rounded bg-purple-600 text-white">
              {mode}
            </span>
          )}
        </div>
      </div>

      {/* Title */}
      <h3 className="text-white font-medium mb-1 line-clamp-2">{title}</h3>

      {/* Description */}
      {description && (
        <p className="text-sm text-gray-400 mb-3 line-clamp-2">{description}</p>
      )}

      {/* Bottom row: creator + assignee */}
      <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
        {creatorName && <span>by {creatorName}</span>}
        {assigneeName && (
          <div className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-gray-300">{assigneeName}</span>
          </div>
        )}
      </div>
    </div>
  );
}
