import initSqlJs, { Database as SqlJsDatabase, QueryExecResult } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Always resolve to project root's data/ dir, regardless of process.cwd()
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const DATA_DIR = process.env.DATA_DIR || path.join(PROJECT_ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'chatbox.sqlite');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let dbInstance: DatabaseWrapper | null = null;

export class DatabaseWrapper {
  constructor(private raw: SqlJsDatabase) {}

  /** Execute a single statement with optional bind params. */
  run(sql: string, params?: unknown[]): void {
    this.raw.run(sql, params as any[] | undefined); // eslint-disable-line @typescript-eslint/no-explicit-any -- sql.js typing
  }

  /** Execute multiple statements (no params). Returns QueryExecResult[]. */
  exec(sql: string): QueryExecResult[] {
    return this.raw.exec(sql);
  }

  /** Prepare a statement for repeated use. */
  prepare(sql: string): PreparedStatement {
    return new PreparedStatement(this.raw.prepare(sql));
  }

  /** Get raw sql.js database handle. */
  getRaw(): SqlJsDatabase {
    return this.raw;
  }

  /** Persist database to disk. */
  save(): void {
    const data = this.raw.export();
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }

  /** Close database. Always call save() first if you want persistence. */
  close(): void {
    this.raw.close();
  }
}

export class PreparedStatement {
  constructor(private stmt: any) {} // eslint-disable-line @typescript-eslint/no-explicit-any -- sql.js prepared stmt

  bind(params?: unknown[]): boolean {
    return this.stmt.bind(params as any[] | undefined); // eslint-disable-line @typescript-eslint/no-explicit-any -- sql.js typing
  }

  step(): boolean {
    return this.stmt.step();
  }

  getAsObject(): Record<string, unknown> {
    return this.stmt.getAsObject();
  }

  get(): unknown[] {
    return this.stmt.get();
  }

  reset(): void {
    this.stmt.reset();
  }

  free(): void {
    this.stmt.free();
  }
}

/**
 * Initialize the database. Call once at server startup.
 * - Loads existing DB file if present, otherwise creates fresh
 * - Runs schema migrations
 * - Returns wrapped Database instance
 */
export async function createDatabase(): Promise<DatabaseWrapper> {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs();

  let rawDb: SqlJsDatabase;
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    rawDb = new SQL.Database(fileBuffer);
  } else {
    rawDb = new SQL.Database();
  }

  const db = new DatabaseWrapper(rawDb);

  // Run schema + migrations
  migrate(db);

  // Save initial state
  db.save();

  dbInstance = db;
  return db;
}

function migrate(db: DatabaseWrapper): void {
  const result = db.exec('PRAGMA user_version');
  let version =
    result.length > 0 && result[0].values.length > 0 ? (result[0].values[0][0] as number) : 0;

  if (version === 0) {
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    db.exec(schema);
    // schema.sql already contains the latest schema (v11) and sets user_version
    // but we explicitly set it here as a safeguard
    db.run('PRAGMA user_version = 11');
    version = 11;
    console.log('[db] Schema v11 created');
  } else if (version === 1) {
    // v1 → v2: add sender_name column to messages
    db.run('ALTER TABLE messages ADD COLUMN sender_name TEXT');
    db.run('PRAGMA user_version = 2');
    console.log('[db] Migrated schema v1 → v2 (added sender_name)');
  }

  if (version <= 3) {
    // v2/v3 → v4: add assign mode, depth column, decomposing/verifying status
    db.exec(`
      CREATE TABLE IF NOT EXISTS tasks_new (
        id TEXT PRIMARY KEY,
        channel_id TEXT REFERENCES channels(id),
        title TEXT NOT NULL,
        description TEXT,
        priority TEXT DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent')),
        mode TEXT DEFAULT 'compete' CHECK(mode IN ('compete','assign','collaborate')),
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending','claimed','running','decomposing','verifying','completed','failed')),
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
        created_at INTEGER DEFAULT (unixepoch()),
        claimed_at INTEGER,
        completed_at INTEGER
      );
    `);
    // Insert with explicit column list to handle schema differences
    db.exec(`
      INSERT INTO tasks_new (id, channel_id, title, description, priority, mode, status, tags, creator_id, assignee_id, parent_task_id, depth, required_capabilities, output, timeout_seconds, max_retries, retry_count, created_at, claimed_at, completed_at)
      SELECT id, channel_id, title, description, priority, mode, status, tags, creator_id, assignee_id, parent_task_id, 0, required_capabilities, output, timeout_seconds, max_retries, retry_count, created_at, claimed_at, completed_at FROM tasks;
    `);
    db.exec(`DROP TABLE tasks; ALTER TABLE tasks_new RENAME TO tasks;`);
    // Recreate indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_channel ON tasks(channel_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
    `);
    db.run('PRAGMA user_version = 4');
    console.log('[db] Migrated schema to v4 (assign mode, depth, decomposing/verifying)');
  }

  if (version <= 4) {
    // v4 → v5: add teams table, team_members table, team_id columns
    console.log('[db] Migrating v4 → v5 (teams)...');

    // Create teams table
    db.exec(`
      CREATE TABLE IF NOT EXISTS teams (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        owner_user_id TEXT NOT NULL,
        created_at INTEGER DEFAULT (unixepoch())
      );
    `);

    // Create team_members table
    db.exec(`
      CREATE TABLE IF NOT EXISTS team_members (
        team_id TEXT REFERENCES teams(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        role TEXT DEFAULT 'member' CHECK(role IN ('owner','admin','member')),
        joined_at INTEGER DEFAULT (unixepoch()),
        PRIMARY KEY (team_id, user_id)
      );
    `);

    // Add team_id column to machines (SQLite doesn't support REFERENCES in ADD COLUMN)
    db.exec(`ALTER TABLE machines ADD COLUMN team_id TEXT;`);

    // Add team_id column to agents
    db.exec(`ALTER TABLE agents ADD COLUMN team_id TEXT;`);

    // Create default team for existing data
    const defaultTeamId = 'team-default';
    const defaultUserId = 'user-default';
    db.run(`INSERT OR IGNORE INTO teams (id, name, owner_user_id) VALUES (?, 'Default Team', ?)`, [
      defaultTeamId,
      defaultUserId,
    ]);
    db.run(`INSERT OR IGNORE INTO team_members (team_id, user_id, role) VALUES (?, ?, 'owner')`, [
      defaultTeamId,
      defaultUserId,
    ]);

    // Associate existing machines with default team
    db.run(`UPDATE machines SET team_id = ? WHERE team_id IS NULL`, [defaultTeamId]);

    // Associate existing agents with default team
    db.run(`UPDATE agents SET team_id = ? WHERE team_id IS NULL`, [defaultTeamId]);

    // Create indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_team_members ON team_members(user_id);
      CREATE INDEX IF NOT EXISTS idx_machines_team ON machines(team_id);
      CREATE INDEX IF NOT EXISTS idx_agents_team ON agents(team_id);
    `);

    db.run('PRAGMA user_version = 5');
    console.log('[db] Migrated schema to v5 (teams)');
  }

  if (version <= 5) {
    // v5 → v6: add groups and group_members tables
    console.log('[db] Migrating v5 → v6 (groups)...');

    // Create groups table
    db.exec(`
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
    `);

    // Create group_members table
    db.exec(`
      CREATE TABLE IF NOT EXISTS group_members (
        group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
        team_id TEXT REFERENCES teams(id) ON DELETE CASCADE,
        role TEXT DEFAULT 'member' CHECK(role IN ('owner','admin','member')),
        joined_at INTEGER DEFAULT (unixepoch()),
        PRIMARY KEY (group_id, team_id)
      );
    `);

    // Create indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
      CREATE INDEX IF NOT EXISTS idx_group_members_team ON group_members(team_id);
      CREATE INDEX IF NOT EXISTS idx_groups_invite_code ON groups(invite_code);
    `);

    db.run('PRAGMA user_version = 6');
    console.log('[db] Migrated schema to v6 (groups)');
  }

  if (version <= 6) {
    // v6 → v7: add group_tasks, authorization_requests tables, extend tasks table
    console.log('[db] Migrating v6 → v7 (group tasks)...');

    // Add columns to tasks table (SQLite doesn't support REFERENCES in ADD COLUMN)
    db.exec(`ALTER TABLE tasks ADD COLUMN is_group_task INTEGER DEFAULT 0;`);
    db.exec(`ALTER TABLE tasks ADD COLUMN source_team_id TEXT;`);

    // Create group_tasks table
    db.exec(`
      CREATE TABLE IF NOT EXISTS group_tasks (
        task_id TEXT PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE,
        group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
        source_team_id TEXT REFERENCES teams(id),
        authorization_status TEXT DEFAULT 'none' CHECK(authorization_status IN ('none','pending','approved','rejected','expired')),
        authorized_at INTEGER,
        created_at INTEGER DEFAULT (unixepoch())
      );
    `);

    // Create authorization_requests table
    db.exec(`
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
    `);

    // Create indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_group_tasks_group ON group_tasks(group_id);
      CREATE INDEX IF NOT EXISTS idx_authorization_requests_status ON authorization_requests(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_group_task ON tasks(is_group_task);
    `);

    db.run('PRAGMA user_version = 7');
    console.log('[db] Migrated schema to v7 (group tasks)');
  }

  if (version <= 7) {
    // v7 → v8: add reputation_records table
    console.log('[db] Migrating v7 → v8 (reputation records)...');

    db.exec(`
      CREATE TABLE IF NOT EXISTS reputation_records (
        id TEXT PRIMARY KEY,
        team_id TEXT REFERENCES teams(id),
        group_id TEXT REFERENCES groups(id),
        event_type TEXT NOT NULL CHECK(event_type IN ('task_completed','task_failed','review_approved','review_rejected')),
        score_delta INTEGER NOT NULL,
        task_id TEXT,
        created_at INTEGER DEFAULT (unixepoch())
      );
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_reputation_team_group ON reputation_records(team_id, group_id);
      CREATE INDEX IF NOT EXISTS idx_reputation_group ON reputation_records(group_id);
    `);

    db.run('PRAGMA user_version = 8');
    console.log('[db] Migrated schema to v8 (reputation records)');
  }

  if (version <= 8) {
    // v8 → v9: add federation tables and agent labels
    console.log('[db] Migrating v8 → v9 (federation gateway)...');

    // Add labels column to agents only if it does not already exist
    // (handles databases where the column was created but user_version was not bumped)
    const agentsColumns = db
      .exec(`PRAGMA table_info(agents)`)[0]
      .values.map((row) => String(row[1]));
    if (!agentsColumns.includes('labels')) {
      db.exec(`ALTER TABLE agents ADD COLUMN labels TEXT DEFAULT '[]';`);
    }

    // Create federation_peers table
    db.exec(`
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
    `);

    // Create federation_task_index table
    db.exec(`
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
    `);

    // Create indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_federation_peers_group ON federation_peers(group_id);
      CREATE INDEX IF NOT EXISTS idx_federation_peers_team ON federation_peers(team_id);
      CREATE INDEX IF NOT EXISTS idx_federation_task_index_group ON federation_task_index(group_id, status);
      CREATE INDEX IF NOT EXISTS idx_federation_task_index_labels ON federation_task_index(required_labels);
    `);

    db.run('PRAGMA user_version = 9');
    version = 9;
    console.log('[db] Migrated schema to v9 (federation gateway)');
  }

  if (version <= 9) {
    // v9 → v10: add domains and domain_members tables (multi-group alliance layer)
    console.log('[db] Migrating v9 → v10 (domains)...');

    // Create domains table
    db.exec(`
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
    `);

    // Create domain_members table
    db.exec(`
      CREATE TABLE IF NOT EXISTS domain_members (
        domain_id TEXT REFERENCES domains(id) ON DELETE CASCADE,
        group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
        role TEXT DEFAULT 'member' CHECK(role IN ('owner','member')),
        capabilities TEXT DEFAULT '[]',
        joined_at INTEGER DEFAULT (unixepoch()),
        PRIMARY KEY (domain_id, group_id)
      );
    `);

    // Create indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_domain_members_domain ON domain_members(domain_id);
      CREATE INDEX IF NOT EXISTS idx_domain_members_group ON domain_members(group_id);
      CREATE INDEX IF NOT EXISTS idx_domains_invite_code ON domains(invite_code);
    `);

    db.run('PRAGMA user_version = 10');
    version = 10;
    console.log('[db] Migrated schema to v10 (domains)');
  }

  if (version <= 10) {
    // v10 → v11: add domain_tasks table (domain collaboration task index)
    console.log('[db] Migrating v10 → v11 (domain tasks)...');

    db.exec(`
      CREATE TABLE IF NOT EXISTS domain_tasks (
        task_id TEXT PRIMARY KEY REFERENCES tasks(id),
        domain_id TEXT NOT NULL REFERENCES domains(id),
        requester_group_id TEXT NOT NULL REFERENCES groups(id),
        target_group_id TEXT NOT NULL REFERENCES groups(id),
        created_at INTEGER NOT NULL
      );
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_domain_tasks_domain ON domain_tasks(domain_id);
    `);

    db.run('PRAGMA user_version = 11');
    version = 11;
    console.log('[db] Migrated schema to v11 (domain tasks)');
  }
}

/** Get the singleton database instance (must call createDatabase first). */
export function getDatabase(): DatabaseWrapper {
  if (!dbInstance) throw new Error('Database not initialized. Call createDatabase() first.');
  return dbInstance;
}

/** Replace the singleton database instance (for tests only). */
export function setDatabase(db: DatabaseWrapper): void {
  if (dbInstance) {
    dbInstance.close();
  }
  dbInstance = db;
}

/** Reset and close the singleton database instance (for tests only). */
export function resetDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
