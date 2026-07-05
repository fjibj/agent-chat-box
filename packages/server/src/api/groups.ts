import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import yaml from 'js-yaml';
import { MSG } from '@agent-chat-box/shared';
import { getDatabase } from '../db/index.js';
import { broadcastToGroup, refreshGroupTeamsMap } from '../ws/handler.js';
import { disconnectPeerByTeamId } from '../federation/hub.js';
import { createGroupChannel, getGroupChannelId } from './channels.js';

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

    // Verify owner team exists and fetch owner user id
    const teamStmt = db.prepare('SELECT id, owner_user_id FROM teams WHERE id = ?');
    teamStmt.bind([body.owner_team_id]);
    if (!teamStmt.step()) {
      teamStmt.free();
      return reply.status(404).send({ error: 'Owner team not found' });
    }
    const teamRow = teamStmt.getAsObject() as { id: string; owner_user_id: string };
    teamStmt.free();

    const groupId = `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = Math.floor(Date.now() / 1000);

    try {
      db.run('BEGIN TRANSACTION');

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

      // Auto-create a dedicated chat channel for the group
      const { id: channelId } = createGroupChannel(
        groupId,
        body.name.trim(),
        teamRow.owner_user_id,
        'human',
      );

      db.run('COMMIT');
      db.save();

      refreshGroupTeamsMap();
      broadcastToGroup(groupId, MSG.GROUP_CREATED, {
        groupId,
        name: body.name.trim(),
        ownerTeamId: body.owner_team_id,
      });
      broadcastToGroup(groupId, MSG.CHANNEL_CREATED, {
        channelId,
        name: body.name.trim(),
        type: 'group',
        groupId,
      });

      return reply.status(201).send({
        id: groupId,
        name: body.name.trim(),
        description: body.description || '',
        owner_team_id: body.owner_team_id,
        channel_id: channelId,
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
      // Delete auto-created group channel and its members first
      const channelId = getGroupChannelId(id);
      db.run('DELETE FROM channel_members WHERE channel_id = ?', [channelId]);
      db.run('DELETE FROM channels WHERE id = ?', [channelId]);

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

      broadcastToGroup(id, MSG.GROUP_CONTRACT_UPDATED, {
        groupId: id,
        contract,
      });

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

      refreshGroupTeamsMap();
      broadcastToGroup(group.id, MSG.GROUP_JOINED, {
        groupId: group.id,
        teamId: body.team_id,
        role: 'member',
      });

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
      db.run('BEGIN TRANSACTION');

      // Release group tasks claimed by the leaving team's agents back to the pending pool
      const claimedStmt = db.prepare(`
        SELECT t.id FROM tasks t
        JOIN group_tasks gt ON t.id = gt.task_id
        WHERE gt.group_id = ? AND t.assignee_id IN (
          SELECT id FROM agents WHERE team_id = ?
        ) AND t.status IN ('claimed', 'running')
      `);
      claimedStmt.bind([id, body.team_id]);
      const claimedTaskIds: string[] = [];
      while (claimedStmt.step()) {
        const row = claimedStmt.getAsObject() as { id: string };
        claimedTaskIds.push(row.id);
      }
      claimedStmt.free();

      for (const taskId of claimedTaskIds) {
        db.run("UPDATE tasks SET status = 'pending', assignee_id = NULL WHERE id = ?", [taskId]);
        db.run("UPDATE group_tasks SET authorization_status = 'none' WHERE task_id = ?", [taskId]);
      }

      // Expire pending authorization requests initiated by the leaving team
      const now = Math.floor(Date.now() / 1000);
      const pendingAuthStmt = db.prepare(`
        SELECT ar.id, ar.group_task_id FROM authorization_requests ar
        JOIN group_tasks gt ON ar.group_task_id = gt.task_id
        WHERE gt.group_id = ? AND ar.requesting_team_id = ? AND ar.status = 'pending'
      `);
      pendingAuthStmt.bind([id, body.team_id]);
      const pendingAuthRows: Array<{ id: string; group_task_id: string }> = [];
      while (pendingAuthStmt.step()) {
        pendingAuthRows.push(pendingAuthStmt.getAsObject() as { id: string; group_task_id: string });
      }
      pendingAuthStmt.free();

      for (const row of pendingAuthRows) {
        db.run('UPDATE authorization_requests SET status = ?, resolved_at = ? WHERE id = ?', [
          'expired',
          now,
          row.id,
        ]);
        db.run("UPDATE group_tasks SET authorization_status = 'expired' WHERE task_id = ?", [
          row.group_task_id,
        ]);
        db.run("UPDATE tasks SET status = 'pending', assignee_id = NULL WHERE id = ?", [
          row.group_task_id,
        ]);
      }

      // Remove open tasks published by the leaving team from the federation index
      db.run(
        `DELETE FROM federation_task_index
         WHERE group_id = ? AND source_team_id = ? AND status = 'open'`,
        [id, body.team_id],
      );

      // Reset tasks claimed by the leaving team back to open in the federation index
      db.run(
        `UPDATE federation_task_index
         SET status = 'open', claimed_by_team_id = NULL, claimed_at = NULL
         WHERE group_id = ? AND claimed_by_team_id = ? AND status = 'claimed'`,
        [id, body.team_id],
      );

      // Remove team from group
      db.run('DELETE FROM group_members WHERE group_id = ? AND team_id = ?', [id, body.team_id]);

      db.run('COMMIT');
      db.save();

      // Disconnect the team's Runner peer if it is connected through federation
      disconnectPeerByTeamId(body.team_id, 'team_left_group');

      // Keep the in-memory group membership map in sync
      refreshGroupTeamsMap();

      // Notify remaining group members
      broadcastToGroup(id, MSG.GROUP_LEFT, {
        groupId: id,
        teamId: body.team_id,
      });

      return { success: true };
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
}