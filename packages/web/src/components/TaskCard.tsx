interface TaskCardProps {
  id: string;
  title: string;
  description?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: string;
  mode?: 'compete' | 'assign' | 'collaborate';
  parentTaskId?: string;
  depth?: number;
  creatorId?: string;
  assigneeId?: string;
  names?: Record<string, string>;
  subtaskProgress?: { completed: number; total: number };
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
  decomposing: { color: 'bg-purple-500', label: 'Decomposing' },
  verifying: { color: 'bg-cyan-500', label: 'Verifying' },
  completed: { color: 'bg-green-500', label: 'Done' },
  failed: { color: 'bg-red-500', label: 'Failed' },
};

export function TaskCard({ title, description, priority, status, mode, parentTaskId, depth, creatorId, assigneeId, names, subtaskProgress, onClick }: TaskCardProps) {
  const st = statusConfig[status] || { color: 'bg-gray-500', label: status };
  const creatorName = creatorId && names?.[creatorId];
  const assigneeName = assigneeId && names?.[assigneeId];
  const isSubtask = !!parentTaskId;
  const depthLabel = depth && depth > 0 ? `L${depth}` : '';

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
          {depthLabel && (
            <span className="text-xs px-2 py-1 rounded bg-gray-600 text-gray-300">
              {depthLabel}
            </span>
          )}
          {isSubtask && (
            <span className="text-xs px-2 py-1 rounded bg-gray-600 text-gray-300">
              sub
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

      {/* Subtask progress for collaborate mode */}
      {subtaskProgress && subtaskProgress.total > 0 && (
        <div className="mb-2">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span>Subtasks</span>
            <span>{subtaskProgress.completed}/{subtaskProgress.total}</span>
          </div>
          <div className="w-full bg-gray-600 rounded-full h-1.5">
            <div
              className="bg-green-500 h-1.5 rounded-full transition-all"
              style={{ width: `${(subtaskProgress.completed / subtaskProgress.total) * 100}%` }}
            />
          </div>
        </div>
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
