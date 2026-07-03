import { useState, useEffect, useCallback } from 'react';
import { TaskCard } from './TaskCard';
import { CreateTaskModal } from './CreateTaskModal';
import { TaskDetailModal } from './TaskDetailModal';

interface Task {
  id: string;
  channelId: string;
  title: string;
  description?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  mode?: 'compete' | 'assign' | 'collaborate';
  status: string;
  creatorId?: string;
  assigneeId?: string;
  parentTaskId?: string;
  depth?: number;
  isGroupTask?: boolean;
  sourceTeamId?: string;
  groupId?: string;
  authorizationStatus?: 'none' | 'pending' | 'approved' | 'rejected' | 'expired';
  createdAt: number;
}

interface Column {
  id: string;
  title: string;
  status: string;
  tasks: Task[];
}

export function TaskBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const fetchNames = useCallback((taskList: Task[]) => {
    const ids = new Set<string>();
    for (const t of taskList) {
      if (t.creatorId) ids.add(t.creatorId);
      if (t.assigneeId) ids.add(t.assigneeId);
      if (t.sourceTeamId) ids.add(t.sourceTeamId);
      if (t.groupId) ids.add(t.groupId);
    }
    if (ids.size === 0) return;
    fetch(`/api/resolve-names?ids=${encodeURIComponent([...ids].join(','))}`)
      .then(res => res.json())
      .then(data => setNames(prev => ({ ...prev, ...data.names })))
      .catch(console.error);
  }, []);

  const fetchTasks = useCallback(() => {
    fetch('/api/tasks')
      .then(res => res.json())
      .then(data => {
        const taskList = data.tasks || [];
        setTasks(taskList);
        fetchNames(taskList);
      })
      .catch(console.error);
  }, [fetchNames]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Filter tasks — only show root tasks (no parentTaskId) on the board
  const rootTasks = tasks.filter(t => !t.parentTaskId);
  const filteredTasks = rootTasks.filter(task =>
    task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    task.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate subtask progress for collaborate tasks
  const getSubtaskProgress = (taskId: string) => {
    const children = tasks.filter(t => t.parentTaskId === taskId);
    if (children.length === 0) return undefined;
    return {
      completed: children.filter(t => t.status === 'completed').length,
      total: children.length,
    };
  };

  // Check if a collaborate task has any active (non-terminal) children
  const hasActiveChildren = (taskId: string) => {
    return tasks.some(t => t.parentTaskId === taskId && !['completed', 'failed'].includes(t.status));
  };

  // Effective status: for collaborate tasks, if children are still active, treat as "running"
  const getEffectiveStatus = (task: { id: string; status: string; mode?: string }) => {
    if (task.mode === 'collaborate' && hasActiveChildren(task.id)) {
      return 'running';
    }
    return task.status;
  };

  // Group by status
  const columns: Column[] = [
    {
      id: 'pending',
      title: 'Pending',
      status: 'pending',
      tasks: filteredTasks.filter(t => getEffectiveStatus(t) === 'pending'),
    },
    {
      id: 'authorization',
      title: 'Authorization',
      status: 'pending_authorization',
      tasks: filteredTasks.filter(t => getEffectiveStatus(t) === 'pending_authorization'),
    },
    {
      id: 'active',
      title: 'In Progress',
      status: 'claimed',
      tasks: filteredTasks.filter(t => ['claimed', 'running', 'decomposing', 'verifying'].includes(getEffectiveStatus(t))),
    },
    {
      id: 'completed',
      title: 'Completed',
      status: 'completed',
      tasks: filteredTasks.filter(t => {
        const s = getEffectiveStatus(t);
        return s === 'completed' || s === 'failed';
      }),
    },
  ];

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Task Board</h2>
        <div className="flex space-x-3">
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
          />
          <button
            onClick={fetchTasks}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors"
          >
            Refresh
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            + New Task
          </button>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 flex p-4 space-x-4 overflow-x-auto">
        {columns.map(column => (
          <div key={column.id} className="flex-1 min-w-[300px]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-400 uppercase">
                {column.title}
              </h3>
              <span className="text-xs bg-gray-700 px-2 py-1 rounded">
                {column.tasks.length}
              </span>
            </div>
            <div className="space-y-3">
              {column.tasks.map(task => (
                <TaskCard
                  key={task.id}
                  {...task}
                  names={names}
                  subtaskProgress={getSubtaskProgress(task.id)}
                  onClick={() => setSelectedTaskId(task.id)}
                />
              ))}
              {column.tasks.length === 0 && (
                <div className="text-center text-gray-500 py-8 text-sm">
                  No tasks
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modals */}
      <CreateTaskModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={fetchTasks}
      />
      <TaskDetailModal
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onUpdated={fetchTasks}
        names={names}
      />
    </div>
  );
}
