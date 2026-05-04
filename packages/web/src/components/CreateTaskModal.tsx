import { useState, useEffect } from 'react';

interface Channel {
  id: string;
  name: string;
  type: string;
}

interface Agent {
  id: string;
  name: string;
  status: string;
  runtime: string;
}

interface CreateTaskModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateTaskModal({ open, onClose, onCreated }: CreateTaskModalProps) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [channelId, setChannelId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [mode, setMode] = useState<'compete' | 'assign' | 'collaborate'>('compete');
  const [assigneeId, setAssigneeId] = useState('');
  const [tags, setTags] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      Promise.all([
        fetch('/api/channels').then(res => res.json()),
        fetch('/api/agents').then(res => res.json()),
      ])
        .then(([channelsData, agentsData]) => {
          const chList = channelsData.channels || [];
          setChannels(chList);
          if (chList.length > 0 && !channelId) {
            setChannelId(chList[0].id);
          }
          const agList = agentsData.agents || [];
          setAgents(agList);
          if (agList.length > 0 && !assigneeId) {
            setAssigneeId(agList[0].id);
          }
        })
        .catch(console.error);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !channelId) return;

    setSubmitting(true);
    setError('');

    try {
      const creatorId = localStorage.getItem('acb-humanId') || 'human-unknown';
      const body: Record<string, unknown> = {
        channelId,
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        mode,
        tags: tags.trim() ? tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
        creatorId,
      };

      // For assign mode, include assigneeId
      if (mode === 'assign' && assigneeId) {
        body.assigneeId = assigneeId;
      }

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create task');
      }

      // Reset form
      setTitle('');
      setDescription('');
      setPriority('normal');
      setMode('compete');
      setAssigneeId('');
      setTags('');
      setError('');
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <form onSubmit={handleSubmit} className="bg-gray-800 rounded-xl p-6 w-[480px] shadow-xl border border-gray-700 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold mb-4">Create New Task</h2>

        {/* Channel */}
        <label className="block mb-3">
          <span className="text-sm text-gray-400 mb-1 block">Channel</span>
          <select
            value={channelId}
            onChange={e => setChannelId(e.target.value)}
            className="w-full bg-gray-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {channels.map(ch => (
              <option key={ch.id} value={ch.id}>#{ch.name}</option>
            ))}
          </select>
        </label>

        {/* Title */}
        <label className="block mb-3">
          <span className="text-sm text-gray-400 mb-1 block">Title *</span>
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Task title"
            required
            className="w-full bg-gray-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
          />
        </label>

        {/* Description */}
        <label className="block mb-3">
          <span className="text-sm text-gray-400 mb-1 block">Description</span>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Task description (optional)"
            rows={3}
            className="w-full bg-gray-700 text-white rounded-lg px-4 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
          />
        </label>

        {/* Priority + Mode row */}
        <div className="flex space-x-3 mb-3">
          <label className="flex-1">
            <span className="text-sm text-gray-400 mb-1 block">Priority</span>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value as typeof priority)}
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>
          <label className="flex-1">
            <span className="text-sm text-gray-400 mb-1 block">Mode</span>
            <select
              value={mode}
              onChange={e => setMode(e.target.value as typeof mode)}
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="compete">Compete (auto)</option>
              <option value="assign">Assign</option>
              <option value="collaborate">Collaborate</option>
            </select>
          </label>
        </div>

        {/* Assignee (only for assign mode) */}
        {mode === 'assign' && (
          <label className="block mb-3">
            <span className="text-sm text-gray-400 mb-1 block">Assign to Agent</span>
            <select
              value={assigneeId}
              onChange={e => setAssigneeId(e.target.value)}
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {agents.length === 0 && <option value="">No agents available</option>}
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.status})</option>
              ))}
            </select>
          </label>
        )}

        {/* Tags */}
        <label className="block mb-4">
          <span className="text-sm text-gray-400 mb-1 block">Tags</span>
          <input
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="Comma separated, e.g. frontend, bug"
            className="w-full bg-gray-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
          />
        </label>

        {/* Error */}
        {error && (
          <p className="text-red-400 text-sm mb-3">{error}</p>
        )}

        {/* Buttons */}
        <div className="flex space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!title.trim() || !channelId || submitting}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Creating...' : 'Create Task'}
          </button>
        </div>
      </form>
    </div>
  );
}
