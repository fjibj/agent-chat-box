import { useState, useEffect } from 'react';
import { TaskCard } from './TaskCard';

interface Task {
  id: string;
  title: string;
  description?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: string;
  assigneeId?: string;
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
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetch('/api/tasks')
      .then(res => res.json())
      .then(data => setTasks(data.tasks || []))
      .catch(console.error);
  }, []);

  // Filter tasks
  const filteredTasks = tasks.filter(task =>
    task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    task.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group by status
  const columns: Column[] = [
    {
      id: 'pending',
      title: 'Pending',
      status: 'pending',
      tasks: filteredTasks.filter(t => t.status === 'pending'),
    },
    {
      id: 'active',
      title: 'In Progress',
      status: 'claimed',
      tasks: filteredTasks.filter(t => t.status === 'claimed' || t.status === 'running'),
    },
    {
      id: 'completed',
      title: 'Completed',
      status: 'completed',
      tasks: filteredTasks.filter(t => t.status === 'completed' || t.status === 'failed'),
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
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
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
                  onClick={() => console.log('Task clicked:', task.id)}
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
    </div>
  );
}
