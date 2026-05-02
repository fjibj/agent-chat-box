import { useState, useEffect } from 'react';

interface ServerInfo {
  version: string;
  name: string;
  host: string;
  port: number;
  wsUrl: string;
  daemonUrl: string;
  dbPath: string;
  uptime: number;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-HTTPS
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="ml-2 px-2 py-1 text-xs bg-gray-600 hover:bg-gray-500 rounded transition-colors"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function SettingsPage() {
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [machines, setMachines] = useState<{ id: string; name: string; apiKey?: string }[]>([]);
  const [showNewKey, setShowNewKey] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/server-info')
      .then(res => res.json())
      .then(setServerInfo)
      .catch(console.error);

    fetch('/api/machines')
      .then(res => res.json())
      .then(data => setMachines(data.machines || []))
      .catch(console.error);
  }, []);

  const handleGenerateKey = async (machineId: string) => {
    try {
      const res = await fetch(`/api/machines/${machineId}/api-key`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setShowNewKey(data.apiKey);
        setTimeout(() => setShowNewKey(null), 30000); // Hide after 30s
      }
    } catch (err) {
      console.error('Failed to generate API key:', err);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold">Settings</h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 max-w-2xl">
        {/* Server Info */}
        <section className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Server Info</h3>
          {serverInfo ? (
            <div className="space-y-2">
              <InfoRow label="Name" value={serverInfo.name} />
              <InfoRow label="Version" value={serverInfo.version} />
              <InfoRow label="Host" value={`${serverInfo.host}:${serverInfo.port}`} />
              <InfoRow label="Uptime" value={formatUptime(serverInfo.uptime)} />
              <InfoRow label="Database" value={serverInfo.dbPath} />
            </div>
          ) : (
            <p className="text-sm text-gray-500">Loading...</p>
          )}
        </section>

        {/* Connection Info */}
        <section className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Connection</h3>
          {serverInfo && (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500">WebSocket URL (UI)</label>
                <div className="flex items-center mt-1">
                  <code className="text-sm bg-gray-700 px-3 py-1.5 rounded flex-1 font-mono">
                    {serverInfo.wsUrl}
                  </code>
                  <CopyButton text={serverInfo.wsUrl} />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500">Daemon Connect URL</label>
                <div className="flex items-center mt-1">
                  <code className="text-sm bg-gray-700 px-3 py-1.5 rounded flex-1 font-mono">
                    {serverInfo.daemonUrl}
                  </code>
                  <CopyButton text={serverInfo.daemonUrl} />
                </div>
              </div>
              <div className="mt-3 p-3 bg-gray-700/50 rounded-lg">
                <p className="text-xs text-gray-400 mb-2">Connect a daemon:</p>
                <code className="text-xs text-green-400 font-mono block">
                  ACB_SERVER={serverInfo.daemonUrl} acb daemon start
                </code>
              </div>
            </div>
          )}
        </section>

        {/* API Keys */}
        <section className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">API Keys</h3>
          {showNewKey && (
            <div className="mb-3 p-3 bg-green-900/30 border border-green-700 rounded-lg">
              <p className="text-xs text-green-400 mb-1">New API key (copy now, won't show again):</p>
              <div className="flex items-center">
                <code className="text-sm text-green-300 font-mono flex-1">{showNewKey}</code>
                <CopyButton text={showNewKey} />
              </div>
            </div>
          )}
          {machines.length === 0 ? (
            <p className="text-sm text-gray-500">No machines registered yet.</p>
          ) : (
            <div className="space-y-2">
              {machines.map(machine => (
                <div key={machine.id} className="flex items-center justify-between bg-gray-700 rounded-lg p-3">
                  <div>
                    <span className="text-sm font-medium">{machine.name}</span>
                    <span className="text-xs text-gray-400 ml-2">{machine.id.slice(0, 8)}</span>
                  </div>
                  <button
                    onClick={() => handleGenerateKey(machine.id)}
                    className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                  >
                    Generate Key
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-400">{label}</span>
      <span className="text-sm text-white font-mono">{value}</span>
    </div>
  );
}
