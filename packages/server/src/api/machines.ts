import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { getDatabase } from '../db/index.js';
import { API_KEY_PREFIX } from '@agent-chat-box/shared';

/** Generate API Key: sk_ + 32 bytes base64url */
function generateApiKey(): string {
  return API_KEY_PREFIX + crypto.randomBytes(32).toString('base64url');
}

/** Hash API Key with scrypt for storage */
function hashApiKey(key: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(key, salt, 64);
  return salt.toString('hex') + ':' + hash.toString('hex');
}

/** Verify API Key against stored hash */
export function verifyApiKey(key: string, storedHash: string): boolean {
  const [saltHex, hashHex] = storedHash.split(':');
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, 'hex');
  const expectedHash = Buffer.from(hashHex, 'hex');
  const actualHash = crypto.scryptSync(key, salt, 64);
  return crypto.timingSafeEqual(expectedHash, actualHash);
}

/** Find machine by API Key (for auth) */
export function findMachineByApiKey(key: string): { id: string; name: string } | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT id, name, api_key_hash FROM machines');
  while (stmt.step()) {
    const row = stmt.getAsObject() as { id: string; name: string; api_key_hash: string };
    if (verifyApiKey(key, row.api_key_hash)) {
      stmt.free();
      return { id: row.id, name: row.name };
    }
  }
  stmt.free();
  return null;
}

/** Register machine API routes */
export async function registerMachineRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/machines — create machine
  app.post('/api/machines', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { name?: string };
    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return reply.status(400).send({ error: 'name is required' });
    }

    const db = getDatabase();
    const id = crypto.randomUUID();
    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);
    const name = body.name.trim();

    db.run('INSERT INTO machines (id, name, api_key_hash, status) VALUES (?, ?, ?, ?)', [
      id,
      name,
      apiKeyHash,
      'offline',
    ]);
    db.save();

    // API Key only returned once
    return reply.status(201).send({ id, name, apiKey });
  });

  // GET /api/machines — list machines (no keys)
  app.get('/api/machines', async () => {
    const db = getDatabase();
    const machines: Array<{
      id: string;
      name: string;
      status: string;
      lastHeartbeat: number | null;
    }> = [];
    const stmt = db.prepare(
      'SELECT id, name, status, last_heartbeat FROM machines ORDER BY created_at DESC',
    );
    while (stmt.step()) {
      const row = stmt.getAsObject() as {
        id: string;
        name: string;
        status: string;
        last_heartbeat: number | null;
      };
      machines.push({
        id: row.id,
        name: row.name,
        status: row.status,
        lastHeartbeat: row.last_heartbeat,
      });
    }
    stmt.free();
    return { machines };
  });

  // GET /api/machines/:id — get single machine
  app.get('/api/machines/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const db = getDatabase();
    const stmt = db.prepare(
      'SELECT id, name, status, last_heartbeat, created_at FROM machines WHERE id = ?',
    );
    stmt.bind([id]);
    if (!stmt.step()) {
      stmt.free();
      return reply.status(404).send({ error: 'Machine not found' });
    }
    const row = stmt.getAsObject() as {
      id: string;
      name: string;
      status: string;
      last_heartbeat: number | null;
      created_at: number;
    };
    stmt.free();
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      lastHeartbeat: row.last_heartbeat,
      createdAt: row.created_at,
    };
  });

  // PATCH /api/machines/:id — rename machine
  app.patch('/api/machines/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { name?: string };

    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return reply.status(400).send({ error: 'name is required' });
    }

    const db = getDatabase();
    const checkStmt = db.prepare('SELECT id FROM machines WHERE id = ?');
    checkStmt.bind([id]);
    if (!checkStmt.step()) {
      checkStmt.free();
      return reply.status(404).send({ error: 'Machine not found' });
    }
    checkStmt.free();

    db.run('UPDATE machines SET name = ? WHERE id = ?', [body.name.trim(), id]);
    db.save();

    return { success: true, name: body.name.trim() };
  });

  // DELETE /api/machines/:id — delete machine
  app.delete('/api/machines/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const db = getDatabase();

    // Check existence
    const checkStmt = db.prepare('SELECT id FROM machines WHERE id = ?');
    checkStmt.bind([id]);
    if (!checkStmt.step()) {
      checkStmt.free();
      return reply.status(404).send({ error: 'Machine not found' });
    }
    checkStmt.free();

    db.run('DELETE FROM machines WHERE id = ?', [id]);
    db.save();

    return { success: true };
  });
}
