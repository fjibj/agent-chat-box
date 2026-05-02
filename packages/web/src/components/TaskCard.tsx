interface TaskCardProps {
  id: string;
  title: string;
  description?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: string;
  assigneeId?: string;
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

export function TaskCard({ id, title, description, priority, status: _status, assigneeId, onClick }: TaskCardProps) {
  return (
    <div
      onClick={onClick}
      className="bg-gray-700 rounded-lg p-4 cursor-pointer hover:bg-gray-600 transition-colors"
    >
      {/* Priority badge */}
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs px-2 py-1 rounded ${priorityColors[priority]} text-white`}>
          {priorityLabels[priority]}
        </span>
        <span className="text-xs text-gray-400">{id.slice(0, 8)}</span>
      </div>

      {/* Title */}
      <h3 className="text-white font-medium mb-1 line-clamp-2">{title}</h3>

      {/* Description */}
      {description && (
        <p className="text-sm text-gray-400 mb-3 line-clamp-2">{description}</p>
      )}

      {/* Assignee */}
      {assigneeId && (
        <div className="flex items-center space-x-2 mt-3">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-xs text-gray-300">{assigneeId}</span>
        </div>
      )}
    </div>
  );
}
