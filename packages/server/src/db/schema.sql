-- Agent Chat Box Database Schema
-- Version: 1

-- Machines table
CREATE TABLE IF NOT EXISTS machines (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  api_key_hash TEXT NOT NULL,
  status TEXT DEFAULT 'offline',
  last_heartbeat INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Agents table
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  machine_id TEXT REFERENCES machines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  runtime TEXT NOT NULL CHECK(runtime IN ('claude','codex','openclaw','hermes')),
  status TEXT DEFAULT 'idle' CHECK(status IN ('sleeping','awake','running','offline')),
  role_card TEXT,
  capabilities TEXT,
  current_task_id TEXT,
  last_sleep_at INTEGER,
  last_wake_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Channels table
CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT DEFAULT 'group' CHECK(type IN ('group','dm','task')),
  created_at INTEGER DEFAULT (unixepoch())
);

-- Channel members table
CREATE TABLE IF NOT EXISTS channel_members (
  channel_id TEXT REFERENCES channels(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL,
  member_kind TEXT NOT NULL CHECK(member_kind IN ('human','agent')),
  joined_at INTEGER DEFAULT (unixepoch()),
  PRIMARY KEY (channel_id, member_id)
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  channel_id TEXT REFERENCES channels(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  sender_kind TEXT NOT NULL CHECK(sender_kind IN ('human','agent','system')),
  sender_name TEXT,
  content TEXT NOT NULL,
  mentions TEXT,
  reply_to TEXT,
  attachments TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  channel_id TEXT REFERENCES channels(id),
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent')),
  mode TEXT DEFAULT 'compete' CHECK(mode IN ('compete','assign','collaborate')),
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','claimed','running','completed','failed')),
  tags TEXT,
  creator_id TEXT NOT NULL,
  assignee_id TEXT REFERENCES agents(id),
  parent_task_id TEXT REFERENCES tasks(id),
  required_capabilities TEXT,
  output TEXT,
  timeout_seconds INTEGER DEFAULT 3600,
  max_retries INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  claimed_at INTEGER,
  completed_at INTEGER
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_channel ON tasks(channel_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_agents_machine ON agents(machine_id);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_runtime ON agents(runtime);
CREATE INDEX IF NOT EXISTS idx_channel_members ON channel_members(member_id);

-- FTS5 not available in sql.js WASM build
-- Full-text search will use LIKE queries or external search module
-- CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(content, content=messages, content_rowid=rowid);
