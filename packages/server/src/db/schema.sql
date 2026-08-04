-- Agent Chat Box Database Schema
-- Version: 12

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Team members table
CREATE TABLE IF NOT EXISTS team_members (
  team_id TEXT REFERENCES teams(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT DEFAULT 'member' CHECK(role IN ('owner','admin','member')),
  joined_at INTEGER DEFAULT (unixepoch()),
  PRIMARY KEY (team_id, user_id)
);

-- Groups table
CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  contract_yaml TEXT,
  owner_team_id TEXT REFERENCES teams(id),
  invite_code TEXT UNIQUE,
  invite_code_expires_at INTEGER,
  invite_code_max_uses INTEGER,
  invite_code_uses INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Group members table
CREATE TABLE IF NOT EXISTS group_members (
  group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
  team_id TEXT REFERENCES teams(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK(role IN ('owner','admin','member')),
  joined_at INTEGER DEFAULT (unixepoch()),
  PRIMARY KEY (group_id, team_id)
);

-- Machines table
CREATE TABLE IF NOT EXISTS machines (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  api_key_hash TEXT NOT NULL,
  team_id TEXT REFERENCES teams(id),
  status TEXT DEFAULT 'offline',
  last_heartbeat INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Agents table
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  machine_id TEXT REFERENCES machines(id) ON DELETE CASCADE,
  team_id TEXT REFERENCES teams(id),
  name TEXT NOT NULL,
  runtime TEXT NOT NULL CHECK(runtime IN ('claude','codex','openclaw','hermes')),
  status TEXT DEFAULT 'idle' CHECK(status IN ('sleeping','awake','running','offline')),
  role_card TEXT,
  capabilities TEXT,
  labels TEXT DEFAULT '[]',
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
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','claimed','running','decomposing','verifying','completed','failed','pending_authorization')),
  tags TEXT,
  creator_id TEXT NOT NULL,
  assignee_id TEXT REFERENCES agents(id),
  parent_task_id TEXT REFERENCES tasks(id),
  depth INTEGER DEFAULT 0,
  required_capabilities TEXT,
  output TEXT,
  timeout_seconds INTEGER DEFAULT 3600,
  max_retries INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  is_group_task INTEGER DEFAULT 0,
  source_team_id TEXT REFERENCES teams(id),
  created_at INTEGER DEFAULT (unixepoch()),
  claimed_at INTEGER,
  completed_at INTEGER
);

-- Group tasks table
CREATE TABLE IF NOT EXISTS group_tasks (
  task_id TEXT PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE,
  group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
  source_team_id TEXT REFERENCES teams(id),
  authorization_status TEXT DEFAULT 'none' CHECK(authorization_status IN ('none','pending','approved','rejected','expired')),
  authorized_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Authorization requests table
CREATE TABLE IF NOT EXISTS authorization_requests (
  id TEXT PRIMARY KEY,
  group_task_id TEXT REFERENCES group_tasks(task_id) ON DELETE CASCADE,
  requesting_team_id TEXT REFERENCES teams(id),
  requesting_agent_id TEXT REFERENCES agents(id),
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','expired')),
  created_at INTEGER DEFAULT (unixepoch()),
  expires_at INTEGER,
  resolved_at INTEGER
);

-- Reputation records table
CREATE TABLE IF NOT EXISTS reputation_records (
  id TEXT PRIMARY KEY,
  team_id TEXT REFERENCES teams(id),
  group_id TEXT REFERENCES groups(id),
  -- Domain ownership of the event: NULL = group-level event (counted in every
  -- domain the group belongs to); non-NULL = domain collaboration event
  -- (counted only in that domain).
  domain_id TEXT,
  event_type TEXT NOT NULL CHECK(event_type IN ('task_completed','task_failed','review_approved','review_rejected')),
  score_delta INTEGER NOT NULL,
  task_id TEXT,
  created_at INTEGER DEFAULT (unixepoch())
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
CREATE INDEX IF NOT EXISTS idx_team_members ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_machines_team ON machines(team_id);
CREATE INDEX IF NOT EXISTS idx_agents_team ON agents(team_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_team ON group_members(team_id);
CREATE INDEX IF NOT EXISTS idx_groups_invite_code ON groups(invite_code);
CREATE INDEX IF NOT EXISTS idx_group_tasks_group ON group_tasks(group_id);
CREATE INDEX IF NOT EXISTS idx_authorization_requests_status ON authorization_requests(status);
CREATE INDEX IF NOT EXISTS idx_tasks_group_task ON tasks(is_group_task);
CREATE INDEX IF NOT EXISTS idx_reputation_team_group ON reputation_records(team_id, group_id);
CREATE INDEX IF NOT EXISTS idx_reputation_group ON reputation_records(group_id);

-- Seed data for fresh installations
INSERT OR IGNORE INTO teams (id, name, owner_user_id) VALUES ('team-default', 'Default Team', 'user-default');
INSERT OR IGNORE INTO team_members (team_id, user_id, role) VALUES ('team-default', 'user-default', 'owner');
INSERT OR IGNORE INTO channels (id, name, description, type) VALUES ('channel-general', 'general', 'General discussion', 'group');
INSERT OR IGNORE INTO channel_members (channel_id, member_id, member_kind) VALUES ('channel-general', 'user-default', 'human');

-- Federation peers table
CREATE TABLE IF NOT EXISTS federation_peers (
  id TEXT PRIMARY KEY,
  group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
  team_id TEXT REFERENCES teams(id) ON DELETE CASCADE,
  hub_url TEXT NOT NULL,
  status TEXT DEFAULT 'connected' CHECK(status IN ('connected','disconnected','error')),
  labels TEXT,
  role_card TEXT,
  last_heartbeat INTEGER,
  connected_at INTEGER DEFAULT (unixepoch()),
  disconnected_at INTEGER,
  UNIQUE(group_id, team_id)
);

-- Federation task index table (Hub-side queue for poll)
CREATE TABLE IF NOT EXISTS federation_task_index (
  id TEXT PRIMARY KEY,
  task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
  source_team_id TEXT REFERENCES teams(id),
  required_labels TEXT,
  status TEXT DEFAULT 'open' CHECK(status IN ('open','claimed','completed','expired')),
  claimed_by_team_id TEXT REFERENCES teams(id),
  claimed_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Federation indexes
CREATE INDEX IF NOT EXISTS idx_federation_peers_group ON federation_peers(group_id);
CREATE INDEX IF NOT EXISTS idx_federation_peers_team ON federation_peers(team_id);
CREATE INDEX IF NOT EXISTS idx_federation_task_index_group ON federation_task_index(group_id, status);
CREATE INDEX IF NOT EXISTS idx_federation_task_index_labels ON federation_task_index(required_labels);

-- Domains table (multi-group alliance layer)
CREATE TABLE IF NOT EXISTS domains (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  contract_yaml TEXT,
  owner_group_id TEXT REFERENCES groups(id),
  invite_code TEXT UNIQUE,
  invite_code_expires_at INTEGER,
  invite_code_max_uses INTEGER,
  invite_code_uses INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Domain members table (groups join domains; owner group cannot leave)
CREATE TABLE IF NOT EXISTS domain_members (
  domain_id TEXT REFERENCES domains(id) ON DELETE CASCADE,
  group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK(role IN ('owner','member')),
  capabilities TEXT DEFAULT '[]',
  joined_at INTEGER DEFAULT (unixepoch()),
  PRIMARY KEY (domain_id, group_id)
);

-- Domain indexes
CREATE INDEX IF NOT EXISTS idx_domain_members_domain ON domain_members(domain_id);
CREATE INDEX IF NOT EXISTS idx_domain_members_group ON domain_members(group_id);
CREATE INDEX IF NOT EXISTS idx_domains_invite_code ON domains(invite_code);

-- Domain collaboration task index (which domain a cross-group task belongs to)
CREATE TABLE IF NOT EXISTS domain_tasks (
  task_id TEXT PRIMARY KEY REFERENCES tasks(id),
  domain_id TEXT NOT NULL REFERENCES domains(id),
  requester_group_id TEXT NOT NULL REFERENCES groups(id),
  target_group_id TEXT NOT NULL REFERENCES groups(id),
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_domain_tasks_domain ON domain_tasks(domain_id);

PRAGMA user_version = 12;

-- FTS5 not available in sql.js WASM build
-- Full-text search will use LIKE queries or external search module
-- CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(content, content=messages, content_rowid=rowid);
