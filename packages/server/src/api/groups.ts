import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import yaml from 'js-yaml';
import { getDatabase } from '../db/index.js';

/** Default group contract template */
const DEFAULT_CONTRACT_YAML = `# Group Contract
shared_capabilities:
  - code
  - review
  - test
resource_quota:
  max_tasks_per_hour: 10
  max_retry_per_task: 3
authorization: manual
trust_threshold: 0.5
visibility:
  task_input: true
  task_output: true
  internal_log: false
`;

/** Register group API routes */
export async function registerGroupRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/groups — create group
  app.post('/api/groups', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { name?: string; description?: string; owner_team_id?: string };

    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return reply.status(400).send({ error: 'name is required' });
    }
    if (!body.owner_team_id || typeof body.owner_team_id !== 'string') {
      return reply.status(400).send({ error: 'owner_team_id is required' });
    }

    const db = getDatabase();

    // Verify owner team exists
    const teamStmt = db.prepare('SELECT id FROM teams WHERE id = ?');
    teamStmt.bind([body.owner_team_id]);
    if (!teamStmt.step()) {
      teamStmt.free();
      return reply.status(404).send({ error: 'Owner team not found' });
    }
    teamStmt.free();

    const groupId = `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = Math.floor(Date.now() / 1000);

    try {
      // Create group
      db.run(
        `INSERT INTO groups (id, name, description, contract_yaml, owner_team_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [groupId, body.name.trim(), body.description || '', DEFAULT_CONTRACT_YAML, body.owner_team_id, now]
      );

      // Add owner team as group member with role=owner
      db.run(
        'INSERT INTO group_members (group_id, team_id, role, joined_at) VALUES (?, ?, ?, ?)',
        [groupId, body.owner_team_id, 'owner', now]
      );

      db.save();

      return reply.status(201).send({
        id: groupId,
        name: body.name.trim(),
        description: body.description || '',
        owner_team_id: body.owner_team_id,
        created_at: now,
      });
    } catch (err) {
      const error = err as Error;
      return reply.status(500).send({ error: error.message });
    }
  });

  // GET /api/groups/:id — get group details with members
  app.get('/api/groups/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const db = getDatabase();

    // Get group
    const groupStmt = db.prepare('SELECT * FROM groups WHERE id = ?');
    groupStmt.bind([id]);
    if (!groupStmt.step()) {
      groupStmt.free();
      return reply.status(404).send({ error: 'Group not found' });
    }
    const group = groupStmt.getAsObject();
    groupStmt.free();

    // Get members
    const membersStmt = db.prepare(`
      SELECT gm.team_id, gm.role, gm.joined_at, t.name as team_name
      FROM group_members gm
      JOIN teams t ON gm.team_id = t.id
      WHERE gm.group_id = ?
    `);
    membersStmt.bind([id]);
    const members: Array<Record<string, unknown>> = [];
    while (membersStmt.step()) {
      members.push(membersStmt.getAsObject());
    }
    membersStmt.free();

    return { ...group, members };
  });

  // PATCH /api/groups/:id — update group name/description
  app.patch('/api/groups/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { name?: string; description?: string };

    const db = getDatabase();

    // Check group exists
    const checkStmt = db.prepare('SELECT id FROM groups WHERE id = ?');
    checkStmt.bind([id]);
    if (!checkStmt.step()) {
      checkStmt.free();
      return reply.status(404).send({ error: 'Group not found' });
    }
    checkStmt.free();

    const updates: string[] = [];
    const params: unknown[] = [];

    if (body.name && typeof body.name === 'string' && body.name.trim().length > 0) {
      updates.push('name = ?');
      params.push(body.name.trim());
    }
    if (body.description !== undefined) {
      updates.push('description = ?');
      params.push(body.description);
    }

    if (updates.length === 0) {
      return reply.status(400).send({ error: 'No fields to update' });
    }

    params.push(id);
    try {
      db.run(`UPDATE groups SET ${updates.join(', ')} WHERE id = ?`, params);
      db.save();
      return { success: true };
    } catch (err) {
      const error = err as Error;
      return reply.status(500).send({ error: error.message });
    }
  });

  // DELETE /api/groups/:id — dissolve group
  app.delete('/api/groups/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const db = getDatabase();

    // Check group exists
    const checkStmt = db.prepare('SELECT id FROM groups WHERE id = ?');
    checkStmt.bind([id]);
    if (!checkStmt.step()) {
      checkStmt.free();
      return reply.status(404).send({ error: 'Group not found' });
    }
    checkStmt.free();

    try {
      // Delete group members first
      db.run('DELETE FROM group_members WHERE group_id = ?', [id]);
      // Delete group
      db.run('DELETE FROM groups WHERE id = ?', [id]);
      db.save();
      return { success: true };
    } catch (err) {
      const error = err as Error;
      return reply.status(500).send({ error: error.message });
    }
  });

  // GET /api/groups — list groups for a team
  app.get('/api/groups', async (request: FastifyRequest, reply: FastifyReply) => {
    const { team_id } = request.query as { team_id?: string };
    if (!team_id) {
      return reply.status(400).send({ error: 'team_id query param is required' });
    }

    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT g.* FROM groups g
      JOIN group_members gm ON g.id = gm.group_id
      WHERE gm.team_id = ?
    `);
    stmt.bind([team_id]);
    const groups: Array<Record<string, unknown>> = [];
    while (stmt.step()) {
      groups.push(stmt.getAsObject());
    }
    stmt.free();

    return groups;
  });

  // GET /api/groups/:id/contract — get group contract
  app.get('/api/groups/:id/contract', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const db = getDatabase();

    const stmt = db.prepare('SELECT contract_yaml FROM groups WHERE id = ?');
    stmt.bind([id]);
    if (!stmt.step()) {
      stmt.free();
      return reply.status(404).send({ error: 'Group not found' });
    }
    const row = stmt.getAsObject() as { contract_yaml: string };
    stmt.free();

    try {
      const contract = yaml.load(row.contract_yaml || DEFAULT_CONTRACT_YAML);
      return { contract };
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to parse contract YAML' });
    }
  });

  // PATCH /api/groups/:id/contract — update group contract
  app.patch('/api/groups/:id/contract', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { contract?: Record<string, unknown> };

    if (!body.contract || typeof body.contract !== 'object') {
      return reply.status(400).send({ error: 'contract object is required' });
    }

    const db = getDatabase();

    // Check group exists
    const checkStmt = db.prepare('SELECT id FROM groups WHERE id = ?');
    checkStmt.bind([id]);
    if (!checkStmt.step()) {
      checkStmt.free();
      return reply.status(404).send({ error: 'Group not found' });
    }
    checkStmt.free();

    // Validate contract fields
    const contract = body.contract;
    const validAuthModes = ['auto', 'manual'];
    if (contract.authorization && !validAuthModes.includes(contract.authorization as string)) {
      return reply.status(400).send({ error: 'authorization must be auto or manual' });
    }
    if (contract.trust_threshold !== undefined) {
      const threshold = contract.trust_threshold as number;
      if (typeof threshold !== 'number' || threshold < 0 || threshold > 1) {
        return reply.status(400).send({ error: 'trust_threshold must be between 0 and 1' });
      }
    }

    try {
      const contractYaml = yaml.dump(contract);
      db.run('UPDATE groups SET contract_yaml = ? WHERE id = ?', [contractYaml, id]);
      db.save();

      // TODO: Send WebSocket notification to group members (group.contract.updated)

      return { success: true };
    } catch (err) {
      const error = err as Error;
      return reply.status(500).send({ error: error.message });
    }
  });

  // POST /api/groups/:id/invite — generate invite code
  app.post('/api/groups/:id/invite', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { max_uses?: number; expires_in_hours?: number };

    const db = getDatabase();

    // Check group exists
    const checkStmt = db.prepare('SELECT id FROM groups WHERE id = ?');
    checkStmt.bind([id]);
    if (!checkStmt.step()) {
      checkStmt.free();
      return reply.status(404).send({ error: 'Group not found' });
    }
    checkStmt.free();

    // Generate invite code (8 chars from UUID)
    const inviteCode = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
    const maxUses = body.max_uses || null;
    const expiresInHours = body.expires_in_hours || 24;
    const expiresAt = Math.floor(Date.now() / 1000) + expiresInHours * 3600;

    try {
      db.run(
        `UPDATE groups SET invite_code = ?, invite_code_expires_at = ?, invite_code_max_uses = ?, invite_code_uses = 0 WHERE id = ?`,
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

  // POST /api/groups/join — join group via invite code
  app.post('/api/groups/join', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { invite_code?: string; team_id?: string };

    if (!body.invite_code || typeof body.invite_code !== 'string') {
      return reply.status(400).send({ error: 'invite_code is required' });
    }
    if (!body.team_id || typeof body.team_id !== 'string') {
      return reply.status(400).send({ error: 'team_id is required' });
    }

    const db = getDatabase();

    // Find group by invite code
    const groupStmt = db.prepare(`
      SELECT id, invite_code_expires_at, invite_code_max_uses, invite_code_uses
      FROM groups WHERE invite_code = ?
    `);
    groupStmt.bind([body.invite_code.toUpperCase()]);
    if (!groupStmt.step()) {
      groupStmt.free();
      return reply.status(404).send({ error: 'Invalid invite code' });
    }
    const group = groupStmt.getAsObject() as {
      id: string;
      invite_code_expires_at: number | null;
      invite_code_max_uses: number | null;
      invite_code_uses: number;
    };
    groupStmt.free();

    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (group.invite_code_expires_at && group.invite_code_expires_at < now) {
      return reply.status(400).send({ error: 'Invite code has expired' });
    }

    // Check max uses
    if (group.invite_code_max_uses && group.invite_code_uses >= group.invite_code_max_uses) {
      return reply.status(400).send({ error: 'Invite code has reached maximum uses' });
    }

    // Check if team already in group
    const memberStmt = db.prepare('SELECT team_id FROM group_members WHERE group_id = ? AND team_id = ?');
    memberStmt.bind([group.id, body.team_id]);
    if (memberStmt.step()) {
      memberStmt.free();
      return reply.status(400).send({ error: 'Team already in this group' });
    }
    memberStmt.free();

    try {
      // Add team to group
      db.run(
        'INSERT INTO group_members (group_id, team_id, role, joined_at) VALUES (?, ?, ?, ?)',
        [group.id, body.team_id, 'member', now]
      );

      // Increment invite code uses
      db.run(
        'UPDATE groups SET invite_code_uses = invite_code_uses + 1 WHERE id = ?',
        [group.id]
      );

      db.save();

      // TODO: Send WebSocket notification (group.joined)

      return { success: true, group_id: group.id };
    } catch (err) {
      const error = err as Error;
      return reply.status(500).send({ error: error.message });
    }
  });

  // POST /api/groups/:id/leave — leave group
  app.post('/api/groups/:id/leave', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { team_id?: string };

    if (!body.team_id || typeof body.team_id !== 'string') {
      return reply.status(400).send({ error: 'team_id is required' });
    }

    const db = getDatabase();

    // Check if team is in group
    const memberStmt = db.prepare('SELECT role FROM group_members WHERE group_id = ? AND team_id = ?');
    memberStmt.bind([id, body.team_id]);
    if (!memberStmt.step()) {
      memberStmt.free();
      return reply.status(404).send({ error: 'Team is not a member of this group' });
    }
    const member = memberStmt.getAsObject() as { role: string };
    memberStmt.free();

    // Owner cannot leave (must dissolve group)
    if (member.role === 'owner') {
      return reply.status(400).send({ error: 'Group owner cannot leave. Delete the group instead.' });
    }

    try {
      // Remove team from group
      db.run('DELETE FROM group_members WHERE group_id = ? AND team_id = ?', [id, body.team_id]);

      // TODO: Reset claimed tasks back to pending pool (requires group_tasks table from STORY-G010)

      db.save();

      // TODO: Send WebSocket notification (group.left)

      return { success: true };
    } catch (err) {
      const error = err as Error;
      return reply.status(500).send({ error: error.message });
    }
  });
}