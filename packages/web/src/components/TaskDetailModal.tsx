import { useState, useEffect } from 'react';

interface Task {
  id: string;
  channelId: string;
  title: string;
  description?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  mode: 'compete' | 'assign' | 'collaborate';
  status: string;
  tags?: string[];
  creatorId: string;
  assigneeId?: string;
  parentTaskId?: string;
  depth?: number;
  output?: string;
  timeoutSeconds?: number;
  maxRetries: number;
  retryCount: number;
  createdAt: number;
  claimedAt?: number;
  completedAt?: number;
}

interface TaskTree {
  task: Task;
  children: Task[];
}

interface TimelineEntry {
  type: string;
  timestamp: number;
  data: Record<string, unknown>;
}

interface TaskDetailModalProps {
  taskId: string | null;
  onClose: () => void;
  onUpdated: () => void;
  names?: Record<string, string>;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500',
  claimed: 'bg-blue-500',
  running: 'bg-blue-400',
  decomposing: 'bg-purple-500',
  verifying: 'bg-cyan-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
};

const statusIcons: Record<string, string> = {
  pending: '⏳',
  claimed: '🔵',
  running: '🔄',
  decomposing: '🧩',
  verifying: '🔍',
  completed: '✅',
  failed: '❌',
};

const priorityColors: Record<string, string> = {
  low: 'bg-gray-500',
  normal: 'bg-blue-500',
  high: 'bg-orange-500',
  urgent: 'bg-red-500',
};

export function TaskDetailModal({ taskId, onClose, onUpdated, names }: TaskDetailModalProps) {
  const [task, setTask] = useState<Task | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [agents, setAgents] = useState<Array<{ id: string; name: string; status: string }>>([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resolvedNames, setResolvedNames] = useState<Record<string, string>>({});
  const [taskTree, setTaskTree] = useState<TaskTree | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [selectedSubtask, setSelectedSubtask] = useState<string | null>(null);

  // Merge prop names with locally resolved names
  const allNames = { ...names, ...resolvedNames };

  useEffect(() => {
    if (!taskId) return;
    setLoading(true);
    setError('');

    Promise.all([
      fetch(`/api/tasks/${taskId}/timeline`).then(r => r.json()),
      fetch('/api/agents').then(r => r.json()),
      fetch(`/api/tasks/${taskId}/tree`).then(r => r.json()).catch(() => null),
    ])
      .then(([timelineData, agentsData, treeData]) => {
        setTask(timelineData.task);
        const tl = timelineData.timeline || [];
        setTimeline(tl);
        const agentList = agentsData.agents || [];
        setAgents(agentList);
        if (agentList.length > 0 && !selectedAgent) {
          setSelectedAgent(agentList[0].id);
        }
        if (treeData && treeData.task) {
          setTaskTree(treeData);
          // Auto-expand all
          setExpandedTasks(new Set([treeData.task.id, ...treeData.children.map((c: Task) => c.id)]));
        }

        // Collect IDs from timeline for name resolution
        const extraIds = new Set<string>();
        for (const entry of tl) {
          if (entry.type === 'message' && entry.data?.senderId) {
            extraIds.add(entry.data.senderId);
          }
          if (entry.data?.agentId) extraIds.add(entry.data.agentId);
          if (entry.data?.claimedBy) extraIds.add(entry.data.claimedBy);
        }
        // Also collect IDs from tree
        if (treeData?.children) {
          for (const child of treeData.children) {
            if (child.assigneeId) extraIds.add(child.assigneeId);
            if (child.creatorId) extraIds.add(child.creatorId);
          }
        }
        if (extraIds.size > 0) {
          fetch(`/api/resolve-names?ids=${encodeURIComponent([...extraIds].join(','))}`)
            .then(r => r.json())
            .then(d => setResolvedNames(prev => ({ ...prev, ...d.names })))
            .catch(() => {});
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [taskId]);

  const apiCall = async (url: string, method: string, body?: Record<string, unknown>) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async () => {
    if (!selectedAgent || !taskId) return;
    const result = await apiCall(`/api/tasks/${taskId}/claim`, 'POST', { agentId: selectedAgent });
    if (result?.success) {
      onUpdated();
      // Refresh detail
      const data = await fetch(`/api/tasks/${taskId}/timeline`).then(r => r.json());
      setTask(data.task);
      setTimeline(data.timeline || []);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!taskId) return;
    const body: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'completed' && output.trim()) {
      body.output = output.trim();
    }
    const result = await apiCall(`/api/tasks/${taskId}`, 'PATCH', body);
    if (result) {
      onUpdated();
      refreshDetail();
    }
  };

  const handleForceComplete = async () => {
    if (!taskId) return;
    const result = await apiCall(`/api/tasks/${taskId}/force-complete`, 'POST');
    if (result) {
      onUpdated();
      refreshDetail();
    }
  };

  const handleForceFail = async () => {
    if (!taskId) return;
    const result = await apiCall(`/api/tasks/${taskId}/force-fail`, 'POST');
    if (result) {
      onUpdated();
      refreshDetail();
    }
  };

  const refreshDetail = async () => {
    if (!taskId) return;
    const [timelineData, treeData] = await Promise.all([
      fetch(`/api/tasks/${taskId}/timeline`).then(r => r.json()),
      fetch(`/api/tasks/${taskId}/tree`).then(r => r.json()).catch(() => null),
    ]);
    setTask(timelineData.task);
    setTimeline(timelineData.timeline || []);
    if (treeData && treeData.task) {
      setTaskTree(treeData);
    }
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleString();
  };

  /** Format timeline entry data, resolving known ID fields to names */
  const formatTimelineData = (entry: TimelineEntry): string => {
    if (entry.type === 'message') {
      const sender = allNames[(entry.data as { senderId?: string }).senderId || ''] || (entry.data as { senderId?: string }).senderId;
      return `${sender}: ${(entry.data as { content?: string }).content}`;
    }
    // For task events, resolve known ID fields
    const resolved: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(entry.data)) {
      if ((k === 'agentId' || k === 'claimedBy' || k === 'creatorId' || k === 'assigneeId') && typeof v === 'string') {
        resolved[k] = allNames[v] || v;
      } else {
        resolved[k] = v;
      }
    }
    return JSON.stringify(resolved);
  };

  if (!taskId) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-6 w-[560px] max-h-[85vh] overflow-y-auto shadow-xl border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Task Details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">&times;</button>
        </div>

        {loading && !task && <p className="text-gray-400">Loading...</p>}
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

        {task && (
          <>
            {/* Task info */}
            <div className="bg-gray-700 rounded-lg p-4 mb-4">
              <div className="flex items-center space-x-2 mb-2">
                <span className={`text-xs px-2 py-1 rounded ${priorityColors[task.priority]} text-white`}>
                  {task.priority}
                </span>
                <span className={`text-xs px-2 py-1 rounded ${statusColors[task.status] || 'bg-gray-500'} text-white`}>
                  {task.status}
                </span>
                <span className="text-xs px-2 py-1 rounded bg-purple-600 text-white">
                  {task.mode}
                </span>
                {task.tags?.map(tag => (
                  <span key={tag} className="text-xs px-2 py-1 rounded bg-gray-600 text-gray-300">
                    {tag}
                  </span>
                ))}
              </div>
              <h3 className="text-white font-medium text-lg mb-1">{task.title}</h3>
              {task.description && (
                <p className="text-sm text-gray-300 mb-2">{task.description}</p>
              )}
              <div className="text-xs text-gray-400 space-y-1">
                <p>ID: {task.id}</p>
                <p>Creator: {allNames[task.creatorId] || task.creatorId}</p>
                {task.assigneeId && <p>Assignee: {allNames[task.assigneeId] || task.assigneeId}</p>}
                <p>Created: {formatTime(task.createdAt)}</p>
                {task.claimedAt && <p>Claimed: {formatTime(task.claimedAt)}</p>}
                {task.completedAt && <p>Completed: {formatTime(task.completedAt)}</p>}
              </div>
              {task.output && (
                <div className="mt-2 p-2 bg-gray-600 rounded text-sm text-gray-200">
                  <span className="text-xs text-gray-400 block mb-1">Output:</span>
                  {task.output}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 mb-4">
              {task.status === 'pending' && (
                <>
                  <select
                    value={selectedAgent}
                    onChange={e => setSelectedAgent(e.target.value)}
                    className="bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {agents.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.status})</option>
                    ))}
                  </select>
                  <button
                    onClick={handleClaim}
                    disabled={!selectedAgent || loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    Claim
                  </button>
                </>
              )}
              {task.status === 'claimed' && (
                <button
                  onClick={() => handleStatusChange('running')}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50 transition-colors"
                >
                  Start
                </button>
              )}
              {(task.status === 'claimed' || task.status === 'running') && (
                <>
                  <input
                    value={output}
                    onChange={e => setOutput(e.target.value)}
                    placeholder="Output (optional)"
                    className="bg-gray-700 text-white rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
                  />
                  <button
                    onClick={() => handleStatusChange('completed')}
                    disabled={loading}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    Complete
                  </button>
                  <button
                    onClick={() => handleStatusChange('failed')}
                    disabled={loading}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    Fail
                  </button>
                </>
              )}
              {/* Force buttons for admin override */}
              {task.status !== 'completed' && task.status !== 'failed' && (
                <div className="flex gap-2 ml-auto">
                  <button
                    onClick={handleForceComplete}
                    disabled={loading}
                    className="px-3 py-2 bg-emerald-700 text-white rounded-lg text-xs hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                    title="Force complete (admin override)"
                  >
                    Force Complete
                  </button>
                  <button
                    onClick={handleForceFail}
                    disabled={loading}
                    className="px-3 py-2 bg-red-800 text-white rounded-lg text-xs hover:bg-red-700 disabled:opacity-50 transition-colors"
                    title="Force fail (admin override)"
                  >
                    Force Fail
                  </button>
                </div>
              )}
            </div>

            {/* Task Tree (for collaborate mode) */}
            {taskTree && taskTree.children.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-400 mb-2">
                  Subtasks ({taskTree.children.filter(c => c.status === 'completed').length}/{taskTree.children.length})
                </h4>
                <div className="space-y-1">
                  {taskTree.children
                    .filter(c => !c.parentTaskId || c.parentTaskId === task.id)
                    .map(child => (
                      <div key={child.id}>
                        <div
                          className="flex items-center space-x-2 p-2 bg-gray-700 rounded cursor-pointer hover:bg-gray-650"
                          onClick={() => {
                            setExpandedTasks(prev => {
                              const next = new Set(prev);
                              if (next.has(child.id)) next.delete(child.id);
                              else next.add(child.id);
                              return next;
                            });
                          }}
                        >
                          <span className="text-sm">{statusIcons[child.status] || '❓'}</span>
                          <span className="text-sm text-gray-200 flex-1">{child.title}</span>
                          {child.retryCount > 0 && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-600 text-white" title={`Retried ${child.retryCount}/${child.maxRetries} times`}>
                              retry {child.retryCount}/{child.maxRetries}
                            </span>
                          )}
                          <span className={`text-xs px-1.5 py-0.5 rounded ${statusColors[child.status] || 'bg-gray-500'} text-white`}>
                            {child.status}
                          </span>
                          {child.assigneeId && (
                            <span className="text-xs text-gray-400">
                              {allNames[child.assigneeId] || child.assigneeId}
                            </span>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSubtask(child.id);
                            }}
                            className="text-xs text-blue-400 hover:text-blue-300"
                          >
                            detail
                          </button>
                        </div>
                        {/* Nested subtasks (depth 2) */}
                        {expandedTasks.has(child.id) && (
                          <div className="ml-6 space-y-1 mt-1">
                            {taskTree.children
                              .filter(gc => gc.parentTaskId === child.id)
                              .map(grandchild => (
                                <div
                                  key={grandchild.id}
                                  className="flex items-center space-x-2 p-1.5 bg-gray-600 rounded text-sm"
                                >
                                  <span>{statusIcons[grandchild.status] || '❓'}</span>
                                  <span className="text-gray-200 flex-1">{grandchild.title}</span>
                                  {grandchild.retryCount > 0 && (
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-amber-600 text-white" title={`Retried ${grandchild.retryCount}/${grandchild.maxRetries} times`}>
                                      retry {grandchild.retryCount}/{grandchild.maxRetries}
                                    </span>
                                  )}
                                  <span className={`text-xs px-1.5 py-0.5 rounded ${statusColors[grandchild.status] || 'bg-gray-500'} text-white`}>
                                    {grandchild.status}
                                  </span>
                                  {grandchild.assigneeId && (
                                    <span className="text-xs text-gray-400">
                                      {allNames[grandchild.assigneeId] || grandchild.assigneeId}
                                    </span>
                                  )}
                                  <button
                                    onClick={() => setSelectedSubtask(grandchild.id)}
                                    className="text-xs text-blue-400 hover:text-blue-300"
                                  >
                                    detail
                                  </button>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Timeline */}
            {timeline.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-400 mb-2">Timeline</h4>
                <div className="max-h-48 overflow-y-auto overflow-x-auto">
                  {timeline.map((entry, i) => (
                    <div key={i} className="flex items-start space-x-3 text-sm py-1 min-w-max">
                      <span className="text-xs text-gray-500 w-32 shrink-0">
                        {formatTime(entry.timestamp)}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${
                        entry.type.startsWith('task.') ? 'bg-blue-900/50 text-blue-300' : 'bg-gray-600 text-gray-300'
                      }`}>
                        {entry.type}
                      </span>
                      <span className="text-gray-300 whitespace-nowrap">
                        {formatTimelineData(entry)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Close button */}
        <div className="mt-4">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Subtask detail modal (recursive) */}
      {selectedSubtask && (
        <TaskDetailModal
          taskId={selectedSubtask}
          onClose={() => setSelectedSubtask(null)}
          onUpdated={onUpdated}
          names={allNames}
        />
      )}
    </div>
  );
}
