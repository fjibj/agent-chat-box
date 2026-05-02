import { useState, useEffect } from 'react';

interface Machine {
  id: string;
  name: string;
  status: string;
  lastHeartbeat: number | null;
}

interface Agent {
  id: string;
  machineId: string;
  name: string;
  runtime: string;
  status: string;
  currentTaskId?: string;
}

export function AgentsPage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [newAgent, setNewAgent] = useState({ name: '', runtime: 'claude', machineId: '' });

  useEffect(() => {
    Promise.all([
      fetch('/api/machines').then(res => res.json()),
      fetch('/api/agents').then(res => res.json()),
    ]).then(([machinesData, agentsData]) => {
      setMachines(machinesData.machines || []);
      setAgents(agentsData.agents || []);
    }).catch(console.error);
  }, []);

  const handleAddAgent = async () => {
    if (!newAgent.name || !newAgent.machineId) return;

    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAgent),
      });
      if (res.ok) {
        const agent = await res.json();
        setAgents(prev => [...prev, agent]);
        setShowAddAgent(false);
        setNewAgent({ name: '', runtime: 'claude', machineId: '' });
      }
    } catch (err) {
      console.error('Failed to add agent:', err);
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    try {
      const res = await fetch(`/api/agents/${agentId}`, { method: 'DELETE' });
      if (res.ok) {
        setAgents(prev => prev.filter(a => a.id !== agentId));
      }
    } catch (err) {
      console.error('Failed to delete agent:', err);
    }
  };

  const getMachineAgents = (machineId: string) => {
    return agents.filter(a => a.machineId === machineId);
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'online':
      case 'awake':
        return 'bg-green-500';
      case 'running':
        return 'bg-blue-500';
      case 'sleeping':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Machines & Agents</h2>
        <button
          onClick={() => setShowAddAgent(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Add Agent
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {machines.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No machines registered. Register a machine first.
          </div>
        ) : (
          machines.map(machine => (
            <div key={machine.id} className="bg-gray-800 rounded-lg p-4">
              {/* Machine header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">🖥</span>
                  <div>
                    <h3 className="font-medium">{machine.name}</h3>
                    <span className="text-xs text-gray-400">{machine.id.slice(0, 8)}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`w-2 h-2 rounded-full ${statusColor(machine.status)}`} />
                  <span className="text-sm text-gray-400 capitalize">{machine.status}</span>
                </div>
              </div>

              {/* Agents */}
              <div className="ml-8 space-y-2">
                <h4 className="text-sm text-gray-400 uppercase">Agents</h4>
                {getMachineAgents(machine.id).length === 0 ? (
                  <p className="text-sm text-gray-500">No agents</p>
                ) : (
                  getMachineAgents(machine.id).map(agent => (
                    <div key={agent.id} className="flex items-center justify-between bg-gray-700 rounded-lg p-3">
                      <div className="flex items-center space-x-3">
                        <span className={`w-2 h-2 rounded-full ${statusColor(agent.status)}`} />
                        <span className="font-medium">{agent.name}</span>
                        <span className="text-xs bg-gray-600 px-2 py-1 rounded">{agent.runtime}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {agent.currentTaskId && (
                          <span className="text-xs text-blue-400">Working</span>
                        )}
                        <button
                          onClick={() => handleDeleteAgent(agent.id)}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Agent Modal */}
      {showAddAgent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-gray-800 rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Add Agent</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Machine</label>
                <select
                  value={newAgent.machineId}
                  onChange={(e) => setNewAgent(prev => ({ ...prev, machineId: e.target.value }))}
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2"
                >
                  <option value="">Select machine...</option>
                  {machines.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name</label>
                <input
                  type="text"
                  value={newAgent.name}
                  onChange={(e) => setNewAgent(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2"
                  placeholder="Agent name"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Runtime</label>
                <select
                  value={newAgent.runtime}
                  onChange={(e) => setNewAgent(prev => ({ ...prev, runtime: e.target.value }))}
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2"
                >
                  <option value="claude">Claude</option>
                  <option value="codex">Codex</option>
                  <option value="openclaw">OpenClaw</option>
                  <option value="hermes">Hermes</option>
                </select>
              </div>
              <div className="flex space-x-3 pt-2">
                <button
                  onClick={handleAddAgent}
                  className="flex-1 bg-blue-600 text-white rounded-lg py-2 hover:bg-blue-700"
                >
                  Add
                </button>
                <button
                  onClick={() => setShowAddAgent(false)}
                  className="flex-1 bg-gray-700 text-white rounded-lg py-2 hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
