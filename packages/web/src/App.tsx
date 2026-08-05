import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { useWebSocket } from './hooks/useWebSocket';
import { useState, useCallback, useEffect, useRef } from 'react';
import type { WSMessage } from '@agent-chat-box/shared';
import { ChannelList } from './components/ChannelList';
import { MessageList } from './components/MessageList';
import { MessageInput } from './components/MessageInput';
import { MemberList } from './components/MemberList';
import { TaskBoard } from './components/TaskBoard';
import { AgentsPage } from './pages/AgentsPage';
import { SettingsPage } from './pages/SettingsPage';
import { GroupsPage } from './pages/GroupsPage';
import { DomainsPage } from './pages/DomainsPage';
import { GroupTasksPage } from './pages/GroupTasksPage';
import { AuthorizationsPage } from './pages/AuthorizationsPage';
import { requestNotificationPermission, setNavigationCallback, notifyTaskComplete, notifyMention } from './utils/notifications';

// Name prompt modal
function NamePrompt({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) onSubmit(name.trim());
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <form onSubmit={handleSubmit} className="bg-gray-800 rounded-xl p-6 w-80 shadow-xl border border-gray-700">
        <h2 className="text-lg font-bold mb-2">Welcome to Agent Chat Box</h2>
        <p className="text-sm text-gray-400 mb-4">Enter your display name to start chatting.</p>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Your name"
          className="w-full bg-gray-700 text-white rounded-lg px-4 py-2.5 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
        />
        <button
          type="submit"
          disabled={!name.trim()}
          className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Enter Chat
        </button>
      </form>
    </div>
  );
}

// Pages
function ChatPage({ wsMessages, send, clientId }: { wsMessages: WSMessage[]; send: (msg: WSMessage) => void; clientId: string | null }) {
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [clearKey, setClearKey] = useState(0);

  return (
    <div className="flex-1 flex min-h-0">
      <ChannelList
        selectedChannelId={selectedChannelId}
        onSelectChannel={setSelectedChannelId}
        wsMessages={wsMessages}
      />
      {selectedChannelId ? (
        <div className="flex-1 flex flex-col min-h-0">
          <MessageList key={clearKey} channelId={selectedChannelId} wsMessages={wsMessages} clientId={clientId} onClear={() => setClearKey(k => k + 1)} />
          <MessageInput channelId={selectedChannelId} onSend={send} />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          Select a channel to start chatting
        </div>
      )}
      {selectedChannelId && <MemberList channelId={selectedChannelId} />}
    </div>
  );
}

function TasksPage({ wsMessages }: { wsMessages?: WSMessage[] }) {
  return <TaskBoard wsMessages={wsMessages} />;
}

// Navigation
function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      className={`px-4 py-2 rounded-lg transition-colors ${
        isActive
          ? 'bg-gray-700 text-white'
          : 'text-gray-400 hover:text-white hover:bg-gray-800'
      }`}
    >
      {children}
    </Link>
  );
}

// Notification bridge — must be inside BrowserRouter
function NotificationBridge({ messages }: { messages: WSMessage[] }) {
  const navigate = useNavigate();

  useEffect(() => {
    requestNotificationPermission();
    setNavigationCallback((path: string) => navigate(path));
  }, [navigate]);

  // Trigger notifications on new messages
  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];

    if (last.type === 'task.complete') {
      const data = last.data as { title?: string; taskId?: string };
      notifyTaskComplete(data.title || 'Task', data.taskId || '');
    }

    if (last.type === 'message.new') {
      const data = last.data as { content?: string; senderName?: string; channelId?: string };
      // Check if message contains @mention (simple check)
      if (data.content?.includes('@') && data.senderName) {
        notifyMention(data.senderName, data.channelId || '');
      }
    }
  }, [messages]);

  return null;
}

// Main App
export default function App() {
  const [messages, setMessages] = useState<WSMessage[]>([]);
  const [userName, setUserName] = useState<string | null>(localStorage.getItem('acb-username'));
  const hasIdentifiedRef = useRef(false);

  const handleMessage = useCallback((msg: WSMessage) => {
    setMessages(prev => [...prev.slice(-100), msg]);
  }, []);

  const wsUrl = import.meta.env.VITE_WS_URL || `ws://${window.location.host}/ws`;
  const { connected, clientId, send } = useWebSocket({
    url: wsUrl,
    onMessage: handleMessage,
  });

  // Send human.identify when connected and name is set
  useEffect(() => {
    if (connected && userName && !hasIdentifiedRef.current) {
      hasIdentifiedRef.current = true;
      send({
        v: 1,
        type: 'human.identify',
        ts: Date.now(),
        data: {
          name: userName,
          client_id: clientId,
          team_id: localStorage.getItem('acb-teamId') || 'team-default',
        },
      });
    }
  }, [connected, userName, send, clientId]);

  // Reset identify flag on disconnect
  useEffect(() => {
    if (!connected) hasIdentifiedRef.current = false;
  }, [connected]);

  const handleSetName = (name: string) => {
    localStorage.setItem('acb-username', name);
    setUserName(name);
  };

  return (
    <BrowserRouter>
      {!userName && <NamePrompt onSubmit={handleSetName} />}
      <NotificationBridge messages={messages} />
      <div className="h-screen bg-gray-900 text-white flex flex-col">
        {/* Header */}
        <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-lg font-bold">Agent Chat Box</h1>
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-400">👤 {userName || '...'}</span>
            <nav className="flex space-x-2">
              <NavLink to="/">Chat</NavLink>
              <NavLink to="/tasks">Tasks</NavLink>
              <NavLink to="/group-tasks">Group Tasks</NavLink>
              <NavLink to="/groups">Groups</NavLink>
              <NavLink to="/domains">Domains</NavLink>
              <NavLink to="/authorizations">Authorizations</NavLink>
              <NavLink to="/agents">Agents</NavLink>
              <NavLink to="/settings">Settings</NavLink>
            </nav>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 flex min-h-0">
          <Routes>
            <Route path="/" element={<ChatPage wsMessages={messages} send={send} clientId={clientId} />} />
            <Route path="/tasks" element={<TasksPage wsMessages={messages} />} />
            <Route path="/group-tasks" element={<GroupTasksPage wsMessages={messages} />} />
            <Route path="/groups" element={<GroupsPage wsMessages={messages} />} />
            <Route path="/domains" element={<DomainsPage />} />
            <Route path="/authorizations" element={<AuthorizationsPage wsMessages={messages} />} />
            <Route path="/agents" element={<AgentsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
