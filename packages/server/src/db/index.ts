import initSqlJs, { Database as SqlJsDatabase, QueryExecResult } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
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
  } else {
    console.log(`[db] Schema version: ${version}`);
  }
}

/** Get the singleton database instance (must call createDatabase first). */
export function getDatabase(): DatabaseWrapper {
  if (!dbInstance) throw new Error('Database not initialized. Call createDatabase() first.');
  return dbInstance;
}
