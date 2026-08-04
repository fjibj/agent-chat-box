import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { getDatabase } from '../db/index.js';

/** Default domain contract template */
const DEFAULT_CONTRACT_YAML = `# Domain Contract
shared_capabilities:
  - code
  - review
  - test
authorization: manual
trust_threshold: 0.5
visibility:
  member_list: true
  capability_declarations: true
`;

/** Register domain API routes */
export async function registerDomainRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/domains — create domain (creator group becomes owner member)
  app.post('/api/domains', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { name?: string; description?: string; owner_group_id?: string };

    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return reply.status(400).send({ error: 'name is required' });
    }
    if (!body.owner_group_id || typeof body.owner_group_id !== 'string') {
      return reply.status(400).send({ error: 'owner_group_id is required' });
    }

    const db = getDatabase();

    // Verify owner group exists
    const groupStmt = db.prepare('SELECT id FROM groups WHERE id = ?');
    groupStmt.bind([body.owner_group_id]);
    if (!groupStmt.step()) {
      groupStmt.free();
      return reply.status(404).send({ error: 'Owner group not found' });
    }
    groupStmt.free();

    const domainId = `domain-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = Math.floor(Date.now() / 1000);

    try {
      db.run('BEGIN TRANSACTION');

      // Create domain
      db.run(
        `INSERT INTO domains (id, name, description, contract_yaml, owner_group_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [domainId, body.name.trim(), body.description || '', DEFAULT_CONTRACT_YAML, body.owner_group_id, now]
      );

      // Add owner group as domain member with role=owner
      db.run(
        'INSERT INTO domain_members (domain_id, group_id, role, capabilities, joined_at) VALUES (?, ?, ?, ?, ?)',
        [domainId, body.owner_group_id, 'owner', '[]', now]
      );

      db.run('COMMIT');
      db.save();

      return reply.status(201).send({
        id: domainId,
        name: body.name.trim(),
        description: body.description || '',
        owner_group_id: body.owner_group_id,
        created_at: now,
      });
    } catch (err) {
      try {
        db.run('ROLLBACK');
      } catch {
        // Ignore rollback errors; the connection may already be closed.
      }
      const error = err as Error;
      return reply.status(500).send({ error: error.message });
    }
  });

  // GET /api/domains — list domains a group belongs to
  app.get('/api/domains', async (request: FastifyRequest, reply: FastifyReply) => {
    const { group_id } = request.query as { group_id?: string };
    if (!group_id) {
      return reply.status(400).send({ error: 'group_id query param is required' });
    }

    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT d.* FROM domains d
      JOIN domain_members dm ON d.id = dm.domain_id
      WHERE dm.group_id = ?
    `);
    stmt.bind([group_id]);
    const domains: Array<Record<string, unknown>> = [];
    while (stmt.step()) {
      domains.push(stmt.getAsObject());
    }
    stmt.free();

    return domains;
  });

  // GET /api/domains/:id — get domain details with members
  app.get('/api/domains/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const db = getDatabase();

    // Get domain
    const domainStmt = db.prepare('SELECT * FROM domains WHERE id = ?');
    domainStmt.bind([id]);
    if (!domainStmt.step()) {
      domainStmt.free();
      return reply.status(404).send({ error: 'Domain not found' });
    }
    const domain = domainStmt.getAsObject();
    domainStmt.free();

    // Get members
    const membersStmt = db.prepare(`
      SELECT dm.group_id, dm.role, dm.capabilities, dm.joined_at, g.name as group_name
      FROM domain_members dm
      JOIN groups g ON dm.group_id = g.id
      WHERE dm.domain_id = ?
    `);
    membersStmt.bind([id]);
    const members: Array<Record<string, unknown>> = [];
    while (membersStmt.step()) {
      members.push(membersStmt.getAsObject());
    }
    membersStmt.free();

    return { ...domain, members };
  });

  // DELETE /api/domains/:id — dissolve domain
  app.delete('/api/domains/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const db = getDatabase();

    // Check domain exists
    const checkStmt = db.prepare('SELECT id FROM domains WHERE id = ?');
    checkStmt.bind([id]);
    if (!checkStmt.step()) {
      checkStmt.free();
      return reply.status(404).send({ error: 'Domain not found' });
    }
    checkStmt.free();

    try {
      // Delete domain members first
      db.run('DELETE FROM domain_members WHERE domain_id = ?', [id]);
      // Delete domain
      db.run('DELETE FROM domains WHERE id = ?', [id]);
      db.save();
      return { success: true };
    } catch (err) {
      const error = err as Error;
      return reply.status(500).send({ error: error.message });
    }
  });

  // POST /api/domains/:id/invite — generate invite code
  app.post('/api/domains/:id/invite', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { max_uses?: number; expires_in_hours?: number };

    const db = getDatabase();

    // Check domain exists
    const checkStmt = db.prepare('SELECT id FROM domains WHERE id = ?');
    checkStmt.bind([id]);
    if (!checkStmt.step()) {
      checkStmt.free();
      return reply.status(404).send({ error: 'Domain not found' });
    }
    checkStmt.free();

    // Generate invite code (8 chars from UUID)
    const inviteCode = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
    const maxUses = body.max_uses || null;
    const expiresInHours = body.expires_in_hours || 24;
    const expiresAt = Math.floor(Date.now() / 1000) + expiresInHours * 3600;

    try {
      db.run(
        `UPDATE domains SET invite_code = ?, invite_code_expires_at = ?, invite_code_max_uses = ?, invite_code_uses = 0 WHERE id = ?`,
        [inviteCode, expiresAt, maxUses, id]
      );
      db.save();

      return {
        invite_code: inviteCode,
        expires_at: expiresAt,
        max_uses: maxUses,
      };
    } catch (err) {
      const error = err as Error;
      return reply.status(500).send({ error: error.message });
    }
  });

  // POST /api/domains/join — join domain via invite code
  app.post('/api/domains/join', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      invite_code?: string;
      group_id?: string;
      capabilities?: string[];
    };

    if (!body.invite_code || typeof body.invite_code !== 'string') {
      return reply.status(400).send({ error: 'invite_code is required' });
    }
    if (!body.group_id || typeof body.group_id !== 'string') {
      return reply.status(400).send({ error: 'group_id is required' });
    }

    const db = getDatabase();

    // Find domain by invite code
    const domainStmt = db.prepare(`
      SELECT id, invite_code_expires_at, invite_code_max_uses, invite_code_uses
      FROM domains WHERE invite_code = ?
    `);
    domainStmt.bind([body.invite_code.toUpperCase()]);
    if (!domainStmt.step()) {
      domainStmt.free();
      return reply.status(404).send({ error: 'Invalid invite code' });
    }
    const domain = domainStmt.getAsObject() as {
      id: string;
      invite_code_expires_at: number | null;
      invite_code_max_uses: number | null;
      invite_code_uses: number;
    };
    domainStmt.free();

    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (domain.invite_code_expires_at && domain.invite_code_expires_at < now) {
      return reply.status(400).send({ error: 'Invite code has expired' });
    }

    // Check max uses
    if (domain.invite_code_max_uses && domain.invite_code_uses >= domain.invite_code_max_uses) {
      return reply.status(400).send({ error: 'Invite code has reached maximum uses' });
    }

    // Check if group already in domain
    const memberStmt = db.prepare('SELECT group_id FROM domain_members WHERE domain_id = ? AND group_id = ?');
    memberStmt.bind([domain.id, body.group_id]);
    if (memberStmt.step()) {
      memberStmt.free();
      return reply.status(400).send({ error: 'Group already in this domain' });
    }
    memberStmt.free();

    try {
      // Add group to domain (capability declaration placeholder, stored but not queried yet)
      const capabilities = Array.isArray(body.capabilities) ? body.capabilities : [];
      db.run(
        'INSERT INTO domain_members (domain_id, group_id, role, capabilities, joined_at) VALUES (?, ?, ?, ?, ?)',
        [domain.id, body.group_id, 'member', JSON.stringify(capabilities), now]
      );

      // Increment invite code uses
      db.run(
        'UPDATE domains SET invite_code_uses = invite_code_uses + 1 WHERE id = ?',
        [domain.id]
      );

      db.save();

      return { success: true, domain_id: domain.id };
    } catch (err) {
      const error = err as Error;
      return reply.status(500).send({ error: error.message });
    }
  });

  // POST /api/domains/:id/leave — leave domain
  app.post('/api/domains/:id/leave', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { group_id?: string };

    if (!body.group_id || typeof body.group_id !== 'string') {
      return reply.status(400).send({ error: 'group_id is required' });
    }

    const db = getDatabase();

    // Check if group is in domain
    const memberStmt = db.prepare('SELECT role FROM domain_members WHERE domain_id = ? AND group_id = ?');
    memberStmt.bind([id, body.group_id]);
    if (!memberStmt.step()) {
      memberStmt.free();
      return reply.status(404).send({ error: 'Group is not a member of this domain' });
    }
    const member = memberStmt.getAsObject() as { role: string };
    memberStmt.free();

    // Owner cannot leave (must dissolve domain)
    if (member.role === 'owner') {
      return reply.status(400).send({ error: 'Domain owner cannot leave. Delete the domain instead.' });
    }

    try {
      db.run('DELETE FROM domain_members WHERE domain_id = ? AND group_id = ?', [id, body.group_id]);
      db.save();
      return { success: true };
    } catch (err) {
      const error = err as Error;
      return reply.status(500).send({ error: error.message });
    }
  });
}
