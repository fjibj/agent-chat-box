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
  const version = result.length > 0 && result[0].values.length > 0
    ? (result[0].values[0][0] as number)
    : 0;

  if (version === 0) {
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    db.exec(schema);
    db.run('PRAGMA user_version = 2');
    console.log('[db] Schema v2 created');
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
}

/** Get the singleton database instance (must call createDatabase first). */
export function getDatabase(): DatabaseWrapper {
  if (!dbInstance) throw new Error('Database not initialized. Call createDatabase() first.');
  return dbInstance;
}
