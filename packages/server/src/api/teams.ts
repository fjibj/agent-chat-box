import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDatabase } from '../db/index.js';

/** Register team API routes */
export async function registerTeamRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/teams — create team
  app.post('/api/teams', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { name?: string; user_id?: string };
    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return reply.status(400).send({ error: 'name is required' });
    }
    if (!body.user_id || typeof body.user_id !== 'string') {
      return reply.status(400).send({ error: 'user_id is required' });
    }

    const db = getDatabase();
    const teamId = `team-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = Math.floor(Date.now() / 1000);

    try {
      db.run(
        'INSERT INTO teams (id, name, owner_user_id, created_at) VALUES (?, ?, ?, ?)',
        [teamId, body.name.trim(), body.user_id, now]
      );
      // Add owner as team member
      db.run(
        'INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)',
        [teamId, body.user_id, 'owner', now]
      );
      db.save();

      return reply.status(201).send({
        id: teamId,
        name: body.name.trim(),
        owner_user_id: body.user_id,
        created_at: now,
      });
    } catch (err) {
      const error = err as Error;
      return reply.status(500).send({ error: error.message });
    }
  });

  // GET /api/teams/:id — get team with members
  app.get('/api/teams/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const db = getDatabase();

    // Get team
    const teamStmt = db.prepare('SELECT * FROM teams WHERE id = ?');
    teamStmt.bind([id]);
    if (!teamStmt.step()) {
      teamStmt.free();
      return reply.status(404).send({ error: 'Team not found' });
    }
    const team = teamStmt.getAsObject();
    teamStmt.free();

    // Get members
    const membersStmt = db.prepare('SELECT user_id, role, joined_at FROM team_members WHERE team_id = ?');
    membersStmt.bind([id]);
    const members: Array<{ user_id: string; role: string; joined_at: number }> = [];
    while (membersStmt.step()) {
      members.push(membersStmt.getAsObject() as { user_id: string; role: string; joined_at: number });
    }
    membersStmt.free();

    return { ...team, members };
  });

  // PATCH /api/teams/:id — update team name
  app.patch('/api/teams/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { name?: string };

    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return reply.status(400).send({ error: 'name is required' });
    }

    const db = getDatabase();

    // Check team exists
    const checkStmt = db.prepare('SELECT id FROM teams WHERE id = ?');
    checkStmt.bind([id]);
    if (!checkStmt.step()) {
      checkStmt.free();
      return reply.status(404).send({ error: 'Team not found' });
    }
    checkStmt.free();

    try {
      db.run('UPDATE teams SET name = ? WHERE id = ?', [body.name.trim(), id]);
      db.save();
      return { id, name: body.name.trim() };
    } catch (err) {
      const error = err as Error;
      return reply.status(500).send({ error: error.message });
    }
  });

  // DELETE /api/teams/:id — delete team
  app.delete('/api/teams/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const db = getDatabase();

    // Check team exists
    const checkStmt = db.prepare('SELECT id FROM teams WHERE id = ?');
    checkStmt.bind([id]);
    if (!checkStmt.step()) {
      checkStmt.free();
      return reply.status(404).send({ error: 'Team not found' });
    }
    checkStmt.free();

    // Check if team has agents
    const agentStmt = db.prepare('SELECT COUNT(*) as count FROM agents WHERE team_id = ?');
    agentStmt.bind([id]);
    agentStmt.step();
    const agentCount = (agentStmt.getAsObject() as { count: number }).count;
    agentStmt.free();

    if (agentCount > 0) {
      return reply.status(400).send({ error: 'Cannot delete team with agents. Remove all agents first.' });
    }

    try {
      db.run('DELETE FROM team_members WHERE team_id = ?', [id]);
      db.run('DELETE FROM teams WHERE id = ?', [id]);
      db.save();
      return { success: true };
    } catch (err) {
      const error = err as Error;
      return reply.status(500).send({ error: error.message });
    }
  });

  // GET /api/teams — list teams for a user
  app.get('/api/teams', async (request: FastifyRequest, reply: FastifyReply) => {
    const { user_id } = request.query as { user_id?: string };
    if (!user_id) {
      return reply.status(400).send({ error: 'user_id query param is required' });
    }

    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT t.* FROM teams t
      JOIN team_members tm ON t.id = tm.team_id
      WHERE tm.user_id = ?
    `);
    stmt.bind([user_id]);
    const teams: Array<Record<string, unknown>> = [];
    while (stmt.step()) {
      teams.push(stmt.getAsObject());
    }
    stmt.free();

    return teams;
  });

  // POST /api/teams/:id/agents/:aid — add agent to team
  app.post('/api/teams/:id/agents/:aid', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: teamId, aid: agentId } = request.params as { id: string; aid: string };
    const db = getDatabase();

    // Verify team exists
    const teamStmt = db.prepare('SELECT id FROM teams WHERE id = ?');
    teamStmt.bind([teamId]);
    if (!teamStmt.step()) {
      teamStmt.free();
      return reply.status(404).send({ error: 'Team not found' });
    }
    teamStmt.free();

    // Verify agent exists
    const agentStmt = db.prepare('SELECT id, team_id FROM agents WHERE id = ?');
    agentStmt.bind([agentId]);
    if (!agentStmt.step()) {
      agentStmt.free();
      return reply.status(404).send({ error: 'Agent not found' });
    }
    const agent = agentStmt.getAsObject() as { team_id: string | null };
    agentStmt.free();

    // Agent already in this team
    if (agent.team_id === teamId) {
      return { success: true, message: 'Agent already in this team' };
    }

    try {
      // Update agent's team (automatically removes from old team)
      db.run('UPDATE agents SET team_id = ? WHERE id = ?', [teamId, agentId]);
      db.save();
      return { success: true };
    } catch (err) {
      const error = err as Error;
      return reply.status(500).send({ error: error.message });
    }
  });

  // DELETE /api/teams/:id/agents/:aid — remove agent from team
  app.delete('/api/teams/:id/agents/:aid', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: teamId, aid: agentId } = request.params as { id: string; aid: string };
    const db = getDatabase();

    // Verify agent exists and is in this team
    const agentStmt = db.prepare('SELECT id, team_id FROM agents WHERE id = ?');
    agentStmt.bind([agentId]);
    if (!agentStmt.step()) {
      agentStmt.free();
      return reply.status(404).send({ error: 'Agent not found' });
    }
    const agent = agentStmt.getAsObject() as { team_id: string | null };
    agentStmt.free();

    if (agent.team_id !== teamId) {
      return reply.status(400).send({ error: 'Agent is not in this team' });
    }

    try {
      // Set team_id to null (remove from team)
      db.run('UPDATE agents SET team_id = NULL WHERE id = ?', [agentId]);
      db.save();
      return { success: true };
    } catch (err) {
      const error = err as Error;
      return reply.status(500).send({ error: error.message });
    }
  });

  // GET /api/teams/:id/agents — list agents in team
  app.get('/api/teams/:id/agents', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: teamId } = request.params as { id: string };
    const db = getDatabase();

    // Verify team exists
    const teamStmt = db.prepare('SELECT id FROM teams WHERE id = ?');
    teamStmt.bind([teamId]);
    if (!teamStmt.step()) {
      teamStmt.free();
      return reply.status(404).send({ error: 'Team not found' });
    }
    teamStmt.free();

    const stmt = db.prepare(`
      SELECT id, machine_id, name, runtime, status, capabilities, role_card, current_task_id, last_sleep_at, last_wake_at
      FROM agents WHERE team_id = ?
    `);
    stmt.bind([teamId]);
    const agents: Array<Record<string, unknown>> = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      agents.push({
        id: row.id,
        machineId: row.machine_id,
        name: row.name,
        runtime: row.runtime,
        status: row.status,
        capabilities: JSON.parse((row.capabilities as string) || '[]'),
        roleCard: JSON.parse(row.role_card as string),
        currentTaskId: row.current_task_id,
        lastSleepAt: row.last_sleep_at,
        lastWakeAt: row.last_wake_at,
      });
    }
    stmt.free();

    return agents;
  });

  // POST /api/teams/:id/members — add collaborator
  app.post('/api/teams/:id/members', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: teamId } = request.params as { id: string };
    const body = request.body as { user_id?: string; role?: string };

    if (!body.user_id || typeof body.user_id !== 'string') {
      return reply.status(400).send({ error: 'user_id is required' });
    }

    const role = body.role || 'member';
    if (!['owner', 'admin', 'member'].includes(role)) {
      return reply.status(400).send({ error: 'role must be owner, admin, or member' });
    }

    const db = getDatabase();

    // Verify team exists
    const teamStmt = db.prepare('SELECT id FROM teams WHERE id = ?');
    teamStmt.bind([teamId]);
    if (!teamStmt.step()) {
      teamStmt.free();
      return reply.status(404).send({ error: 'Team not found' });
    }
    teamStmt.free();

    const now = Math.floor(Date.now() / 1000);

    try {
      db.run(
        'INSERT OR REPLACE INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)',
        [teamId, body.user_id, role, now]
      );
      db.save();
      return { success: true };
    } catch (err) {
      const error = err as Error;
      return reply.status(500).send({ error: error.message });
    }
  });

  // DELETE /api/teams/:id/members/:uid — remove collaborator
  app.delete('/api/teams/:id/members/:uid', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: teamId, uid: userId } = request.params as { id: string; uid: string };
    const db = getDatabase();

    // Check if user is owner (cannot remove owner)
    const memberStmt = db.prepare('SELECT role FROM team_members WHERE team_id = ? AND user_id = ?');
    memberStmt.bind([teamId, userId]);
    if (!memberStmt.step()) {
      memberStmt.free();
      return reply.status(404).send({ error: 'Member not found' });
    }
    const member = memberStmt.getAsObject() as { role: string };
    memberStmt.free();

    if (member.role === 'owner') {
      return reply.status(400).send({ error: 'Cannot remove team owner' });
    }

    try {
      db.run('DELETE FROM team_members WHERE team_id = ? AND user_id = ?', [teamId, userId]);
      db.save();
      return { success: true };
    } catch (err) {
      const error = err as Error;
      return reply.status(500).send({ error: error.message });
    }
  });

  // GET /api/teams/:id/members — list team members
  app.get('/api/teams/:id/members', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: teamId } = request.params as { id: string };
    const db = getDatabase();

    // Verify team exists
    const teamStmt = db.prepare('SELECT id FROM teams WHERE id = ?');
    teamStmt.bind([teamId]);
    if (!teamStmt.step()) {
      teamStmt.free();
      return reply.status(404).send({ error: 'Team not found' });
    }
    teamStmt.free();

    const stmt = db.prepare('SELECT user_id, role, joined_at FROM team_members WHERE team_id = ?');
    stmt.bind([teamId]);
    const members: Array<{ user_id: string; role: string; joined_at: number }> = [];
    while (stmt.step()) {
      members.push(stmt.getAsObject() as { user_id: string; role: string; joined_at: number });
    }
    stmt.free();

    return members;
  });
}