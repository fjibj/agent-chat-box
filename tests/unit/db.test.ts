import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp } from '../helpers.js';
import { getDatabase } from '../../packages/server/src/db/index.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
});

describe('DatabaseWrapper', () => {
  it('run + prepare + step — basic CRUD', () => {
    const db = getDatabase();
    const id = 'test-crud-' + Date.now();

    db.run('INSERT INTO channels (id, name, type) VALUES (?, ?, ?)', [id, 'test-crud', 'group']);

    const stmt = db.prepare('SELECT id, name, type FROM channels WHERE id = ?');
    stmt.bind([id]);
    expect(stmt.step()).toBe(true);
    const row = stmt.getAsObject() as { id: string; name: string; type: string };
    expect(row.id).toBe(id);
    expect(row.name).toBe('test-crud');
    expect(row.type).toBe('group');
    stmt.free();
  });

  it('prepare — returns multiple rows', () => {
    const db = getDatabase();
    // Insert two channels
    const id1 = 'multi-1-' + Date.now();
    const id2 = 'multi-2-' + Date.now();
    db.run('INSERT INTO channels (id, name, type) VALUES (?, ?, ?)', [id1, 'multi-1', 'group']);
    db.run('INSERT INTO channels (id, name, type) VALUES (?, ?, ?)', [id2, 'multi-2', 'group']);

    const stmt = db.prepare('SELECT id FROM channels WHERE name LIKE ?');
    stmt.bind(['multi-%']);
    const ids: string[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as { id: string };
      ids.push(row.id);
    }
    stmt.free();

    expect(ids).toContain(id1);
    expect(ids).toContain(id2);
  });

  it('exec — runs raw SQL', () => {
    const db = getDatabase();
    const result = db.exec('SELECT COUNT(*) as count FROM channels');
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].values[0][0]).toBeGreaterThan(0);
  });

  it('run — UPDATE statement', () => {
    const db = getDatabase();
    const id = 'update-test-' + Date.now();
    db.run('INSERT INTO channels (id, name, type) VALUES (?, ?, ?)', [id, 'before', 'group']);
    db.run('UPDATE channels SET name = ? WHERE id = ?', ['after', id]);

    const stmt = db.prepare('SELECT name FROM channels WHERE id = ?');
    stmt.bind([id]);
    stmt.step();
    const row = stmt.getAsObject() as { name: string };
    expect(row.name).toBe('after');
    stmt.free();
  });

  it('run — DELETE statement', () => {
    const db = getDatabase();
    const id = 'delete-test-' + Date.now();
    db.run('INSERT INTO channels (id, name, type) VALUES (?, ?, ?)', [id, 'to-delete', 'group']);
    db.run('DELETE FROM channels WHERE id = ?', [id]);

    const stmt = db.prepare('SELECT id FROM channels WHERE id = ?');
    stmt.bind([id]);
    expect(stmt.step()).toBe(false);
    stmt.free();
  });
});

describe('PreparedStatement', () => {
  it('reset — allows re-binding', () => {
    const db = getDatabase();
    const stmt = db.prepare('SELECT name FROM channels WHERE type = ? LIMIT 1');

    stmt.bind(['group']);
    expect(stmt.step()).toBe(true);
    stmt.reset();

    stmt.bind(['dm']);
    // May or may not have DM channels, but should not throw
    stmt.step();
    stmt.free();
  });

  it('free — releases statement', () => {
    const db = getDatabase();
    const stmt = db.prepare('SELECT 1');
    stmt.step();
    stmt.free();
    // Should not throw after free
  });
});

describe('Database schema', () => {
  it('all expected tables exist', () => {
    const db = getDatabase();
    const result = db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    const tables = result[0].values.map(row => row[0]);
    expect(tables).toContain('machines');
    expect(tables).toContain('agents');
    expect(tables).toContain('channels');
    expect(tables).toContain('channel_members');
    expect(tables).toContain('messages');
    expect(tables).toContain('tasks');
  });

  it('indexes exist', () => {
    const db = getDatabase();
    const result = db.exec("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name");
    const indexes = result[0].values.map(row => row[0]);
    expect(indexes).toContain('idx_messages_channel');
    expect(indexes).toContain('idx_tasks_status');
    expect(indexes).toContain('idx_tasks_channel');
    expect(indexes).toContain('idx_tasks_assignee');
    expect(indexes).toContain('idx_agents_machine');
    expect(indexes).toContain('idx_agents_status');
  });
});
