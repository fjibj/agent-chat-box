import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { getDatabase } from '../db/index.js';
import { getClients } from '../ws/handler.js';
import { getAgentById } from './agents.js';

/** Create or get DM channel between two members */
export function getOrCreateDmChannel(
  member1Id: string,
  member1Kind: 'human' | 'agent',
  member2Id: string,
  member2Kind: 'human' | 'agent',
): { id: string; name: string } {
  const db = getDatabase();

  // Check if DM already exists (both members in same dm channel)
  const existingStmt = db.prepare(`
    SELECT c.id, c.name FROM channels c
    JOIN channel_members cm1 ON c.id = cm1.channel_id AND cm1.member_id = ?
    JOIN channel_members cm2 ON c.id = cm2.channel_id AND cm2.member_id = ?
    WHERE c.type = 'dm'
  `);
  existingStmt.bind([member1Id, member2Id]);
  if (existingStmt.step()) {
    const row = existingStmt.getAsObject() as { id: string; name: string };
    existingStmt.free();
    return row;
  }
  existingStmt.free();

  // Create new DM channel
  const id = crypto.randomUUID();
  const name = `dm:${member1Id}:${member2Id}`;
  db.run('INSERT INTO channels (id, name, type) VALUES (?, ?, ?)', [id, name, 'dm']);
  db.run('INSERT INTO channel_members (channel_id, member_id, member_kind) VALUES (?, ?, ?)', [
    id,
    member1Id,
    member1Kind,
  ]);
  db.run('INSERT INTO channel_members (channel_id, member_id, member_kind) VALUES (?, ?, ?)', [
    id,
    member2Id,
    member2Kind,
  ]);
  db.save();

  return { id, name };
}

/** Add member to channel */
export function addChannelMember(
  channelId: string,
  memberId: string,
  memberKind: 'human' | 'agent',
): void {
  const db = getDatabase();
  db.run(
    'INSERT OR IGNORE INTO channel_members (channel_id, member_id, member_kind) VALUES (?, ?, ?)',
    [channelId, memberId, memberKind],
  );
  db.save();
}

/** Remove member from channel */
export function removeChannelMember(channelId: string, memberId: string): void {
  const db = getDatabase();
  db.run('DELETE FROM channel_members WHERE channel_id = ? AND member_id = ?', [
    channelId,
    memberId,
  ]);
  db.save();
}

/** Get channel members */
export function getChannelMembers(
  channelId: string,
): Array<{ memberId: string; memberKind: string; joinedAt: number }> {
  const db = getDatabase();
  const members: Array<{ memberId: string; memberKind: string; joinedAt: number }> = [];
  const stmt = db.prepare(
    'SELECT member_id, member_kind, joined_at FROM channel_members WHERE channel_id = ? ORDER BY joined_at ASC',
  );
  stmt.bind([channelId]);
  while (stmt.step()) {
    const row = stmt.getAsObject() as { member_id: string; member_kind: string; joined_at: number };
    members.push({
      memberId: row.member_id,
      memberKind: row.member_kind,
      joinedAt: row.joined_at,
    });
  }
  stmt.free();
  return members;
}

/** Get channels for a member */
export function getMemberChannels(
  memberId: string,
): Array<{ id: string; name: string; type: string }> {
  const db = getDatabase();
  const channels: Array<{ id: string; name: string; type: string }> = [];
  const stmt = db.prepare(`
    SELECT c.id, c.name, c.type FROM channels c
    JOIN channel_members cm ON c.id = cm.channel_id
    WHERE cm.member_id = ?
    ORDER BY c.created_at ASC
  `);
  stmt.bind([memberId]);
  while (stmt.step()) {
    const row = stmt.getAsObject() as { id: string; name: string; type: string };
    channels.push(row);
  }
  stmt.free();
  return channels;
}

/** Create default #general channel if not exists */
export function ensureDefaultChannel(): void {
  const db = getDatabase();
  const stmt = db.prepare("SELECT id FROM channels WHERE name = 'general' AND type = 'group'");
  if (stmt.step()) {
    stmt.free();
    return; // already exists
  }
  stmt.free();

  const id = crypto.randomUUID();
  db.run('INSERT INTO channels (id, name, description, type) VALUES (?, ?, ?, ?)', [
    id,
    'general',
    'General discussion',
    'group',
  ]);
  db.save();
  console.log('[db] Default #general channel created');
}

/** Register channel API routes */
export async function registerChannelRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/channels — create channel
  app.post('/api/channels', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { name?: string; description?: string; type?: string };
    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return reply.status(400).send({ error: 'name is required' });
    }

    const validTypes = ['group', 'dm', 'task'];
    const type = body.type || 'group';
    if (!validTypes.includes(type)) {
      return reply.status(400).send({ error: `type must be one of: ${validTypes.join(', ')}` });
    }

    const db = getDatabase();
    const id = crypto.randomUUID();
    const name = body.name.trim();
    const description = body.description?.trim() || null;

    db.run('INSERT INTO channels (id, name, description, type) VALUES (?, ?, ?, ?)', [
      id,
      name,
      description,
      type,
    ]);
    db.save();

    return reply.status(201).send({ id, name, description, type });
  });

  // POST /api/channels/dm — create or get DM channel
  app.post('/api/channels/dm', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      member1Id?: string;
      member1Kind?: string;
      member2Id?: string;
      member2Kind?: string;
    };

    if (!body.member1Id || !body.member1Kind || !body.member2Id || !body.member2Kind) {
      return reply
        .status(400)
        .send({ error: 'member1Id, member1Kind, member2Id, member2Kind are required' });
    }

    const validKinds = ['human', 'agent'];
    if (!validKinds.includes(body.member1Kind) || !validKinds.includes(body.member2Kind)) {
      return reply.status(400).send({ error: 'memberKind must be human or agent' });
    }

    const channel = getOrCreateDmChannel(
      body.member1Id,
      body.member1Kind as 'human' | 'agent',
      body.member2Id,
      body.member2Kind as 'human' | 'agent',
    );

    return reply.status(201).send(channel);
  });

  // GET /api/channels — list channels
  app.get('/api/channels', async (request: FastifyRequest) => {
    const query = request.query as { type?: string; memberId?: string };
    const db = getDatabase();

    let sql = 'SELECT DISTINCT c.id, c.name, c.description, c.type, c.created_at FROM channels c';
    const params: unknown[] = [];

    if (query.memberId) {
      sql += ' JOIN channel_members cm ON c.id = cm.channel_id WHERE cm.member_id = ?';
      params.push(query.memberId);
      if (query.type) {
        sql += ' AND c.type = ?';
        params.push(query.type);
      }
    } else if (query.type) {
      sql += ' WHERE c.type = ?';
      params.push(query.type);
    }

    sql += ' ORDER BY c.created_at ASC';

    const channels: Array<{
      id: string;
      name: string;
      description: string | null;
      type: string;
      createdAt: number;
    }> = [];
    const stmt = db.prepare(sql);
    if (params.length > 0) stmt.bind(params);

    while (stmt.step()) {
      const row = stmt.getAsObject() as {
        id: string;
        name: string;
        description: string | null;
        type: string;
        created_at: number;
      };
      channels.push({
        id: row.id,
        name: row.name,
        description: row.description,
        type: row.type,
        createdAt: row.created_at,
      });
    }
    stmt.free();
    return { channels };
  });

  // GET /api/channels/:id — get single channel
  app.get('/api/channels/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const db = getDatabase();
    const stmt = db.prepare(
      'SELECT id, name, description, type, created_at FROM channels WHERE id = ?',
    );
    stmt.bind([id]);
    if (!stmt.step()) {
      stmt.free();
      return reply.status(404).send({ error: 'Channel not found' });
    }
    const row = stmt.getAsObject() as {
      id: string;
      name: string;
      description: string | null;
      type: string;
      created_at: number;
    };
    stmt.free();
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      type: row.type,
      createdAt: row.created_at,
    };
  });

  // GET /api/channels/:id/members — list channel members
  app.get('/api/channels/:id/members', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const db = getDatabase();

    const checkStmt = db.prepare('SELECT id FROM channels WHERE id = ?');
    checkStmt.bind([id]);
    if (!checkStmt.step()) {
      checkStmt.free();
      return reply.status(404).send({ error: 'Channel not found' });
    }
    checkStmt.free();

    const members = getChannelMembers(id);
    const clients = getClients();

    // Build client ID → name map from active connections
    const humanNameMap = new Map<string, string>();
    for (const client of clients.values()) {
      if (client.type === 'human' && client.name) {
        humanNameMap.set(client.id, client.name);
      }
    }

    // Resolve names
    const resolved = members.map((m) => ({
      ...m,
      name:
        m.memberKind === 'agent'
          ? getAgentById(m.memberId)?.name || m.memberId
          : humanNameMap.get(m.memberId) || m.memberId,
    }));

    return { members: resolved };
  });

  // POST /api/channels/:id/members — add member to channel
  app.post('/api/channels/:id/members', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { memberId?: string; memberKind?: string };

    if (!body.memberId || !body.memberKind) {
      return reply.status(400).send({ error: 'memberId and memberKind are required' });
    }

    const validKinds = ['human', 'agent'];
    if (!validKinds.includes(body.memberKind)) {
      return reply.status(400).send({ error: 'memberKind must be human or agent' });
    }

    const db = getDatabase();
    const checkStmt = db.prepare('SELECT id FROM channels WHERE id = ?');
    checkStmt.bind([id]);
    if (!checkStmt.step()) {
      checkStmt.free();
      return reply.status(404).send({ error: 'Channel not found' });
    }
    checkStmt.free();

    addChannelMember(id, body.memberId, body.memberKind as 'human' | 'agent');
    return reply.status(201).send({ success: true });
  });

  // DELETE /api/channels/:id/members/:memberId — remove member from channel
  app.delete(
    '/api/channels/:id/members/:memberId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id, memberId } = request.params as { id: string; memberId: string };
      removeChannelMember(id, memberId);
      return { success: true };
    },
  );

  // DELETE /api/channels/:id — delete channel
  app.delete('/api/channels/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const db = getDatabase();

    // Check existence
    const checkStmt = db.prepare('SELECT id FROM channels WHERE id = ?');
    checkStmt.bind([id]);
    if (!checkStmt.step()) {
      checkStmt.free();
      return reply.status(404).send({ error: 'Channel not found' });
    }
    checkStmt.free();

    // Delete members first (foreign key)
    db.run('DELETE FROM channel_members WHERE channel_id = ?', [id]);
    // Delete channel
    db.run('DELETE FROM channels WHERE id = ?', [id]);
    db.save();

    return { success: true };
  });
}
