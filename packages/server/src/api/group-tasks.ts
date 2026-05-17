import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import yaml from 'js-yaml';
import { getDatabase } from '../db/index.js';
import { checkThreshold } from '../modules/reputation.js';
import { indexGroupTask } from '../federation/hub.js';

/** Register group task API routes */
export async function registerGroupTaskRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/groups/:gid/tasks — publish group task
  app.post('/api/groups/:gid/tasks', async (request: FastifyRequest, reply: FastifyReply) => {
    const { gid } = request.params as { gid: string };
    const body = request.body as {
      title?: string;
      description?: string;
      priority?: string;
      tags?: string[];
      required_capabilities?: string[];
      source_team_id?: string;
      creator_id?: string;
      timeout_seconds?: number;
    };

    if (!body.title || typeof body.title !== 'string' || body.title.trim().length === 0) {
      return reply.status(400).send({ error: 'title is required' });
    }
    if (!body.source_team_id || typeof body.source_team_id !== 'string') {
      return reply.status(400).send({ error: 'source_team_id is required' });
    }
    if (!body.creator_id || typeof body.creator_id !== 'string') {
      return reply.status(400).send({ error: 'creator_id is required' });
    }

    const db = getDatabase();

    // Verify group exists
    const groupStmt = db.prepare('SELECT id, contract_yaml FROM groups WHERE id = ?');
    groupStmt.bind([gid]);
    if (!groupStmt.step()) {
      groupStmt.free();
      return reply.status(404).send({ error: 'Group not found' });
    }
    const group = groupStmt.getAsObject() as { id: string; contract_yaml: string };
    groupStmt.free();

    // Verify source team is member of group
    const memberStmt = db.prepare('SELECT team_id FROM group_members WHERE group_id = ? AND team_id = ?');
    memberStmt.bind([gid, body.source_team_id]);
    if (!memberStmt.step()) {
      memberStmt.free();
      return reply.status(403).send({ error: 'Team is not a member of this group' });
    }
    memberStmt.free();

    // Validate required_capabilities against contract shared_capabilities
    if (body.required_capabilities && body.required_capabilities.length > 0) {
      try {
        const contract = yaml.load(group.contract_yaml || '') as Record<string, unknown>;
        const sharedCaps = (contract.shared_capabilities as string[]) || [];
        const invalidCaps = body.required_capabilities.filter(cap => !sharedCaps.includes(cap));
        if (invalidCaps.length > 0) {
          return reply.status(400).send({
            error: `Capabilities not in group contract shared_capabilities: ${invalidCaps.join(', ')}`,
          });
        }
      } catch {
        // If YAML parsing fails, skip validation
      }
    }

    const taskId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    try {
      // Create task
      db.run(
        `INSERT INTO tasks (id, title, description, priority, status, tags, creator_id, required_capabilities, is_group_task, source_team_id, timeout_seconds, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          taskId,
          body.title.trim(),
          body.description || '',
          body.priority || 'normal',
          'pending',
          JSON.stringify(body.tags || []),
          body.creator_id,
          JSON.stringify(body.required_capabilities || []),
          1, // is_group_task
          body.source_team_id,
          body.timeout_seconds || 3600,
          now,
        ]
      );

      // Create group_tasks record
      db.run(
        `INSERT INTO group_tasks (task_id, group_id, source_team_id, authorization_status, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [taskId, gid, body.source_team_id, 'none', now]
      );

      db.save();

      // Index task in federation queue for cross-team poll
      try {
        indexGroupTask(taskId, gid, body.source_team_id, body.required_capabilities || []);
      } catch (err) {
        console.warn('[group-tasks] Failed to index group task in federation queue:', (err as Error).message);
      }

      return reply.status(201).send({
        id: taskId,
        title: body.title.trim(),
        group_id: gid,
        source_team_id: body.source_team_id,
        status: 'pending',
        created_at: now,
      });
    } catch (err) {
      const error = err as Error;
      return reply.status(500).send({ error: error.message });
    }
  });

  // GET /api/groups/:gid/tasks — list group tasks
  app.get('/api/groups/:gid/tasks', async (request: FastifyRequest, reply: FastifyReply) => {
    const { gid } = request.params as { gid: string };
    const { status } = request.query as { status?: string };

    const db = getDatabase();

    // Verify group exists
    const groupStmt = db.prepare('SELECT id FROM groups WHERE id = ?');
    groupStmt.bind([gid]);
    if (!groupStmt.step()) {
      groupStmt.free();
      return reply.status(404).send({ error: 'Group not found' });
    }
    groupStmt.free();

    let sql = `
      SELECT t.*, gt.authorization_status, gt.source_team_id as gt_source_team_id
      FROM tasks t
      JOIN group_tasks gt ON t.id = gt.task_id
      WHERE gt.group_id = ?
    `;
    const params: unknown[] = [gid];

    if (status) {
      sql += ' AND t.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY t.created_at DESC';

    const stmt = db.prepare(sql);
    stmt.bind(params);
    const tasks: Array<Record<string, unknown>> = [];
    while (stmt.step()) {
      tasks.push(stmt.getAsObject());
    }
    stmt.free();

    return tasks;
  });

  // POST /api/tasks/:tid/group-claim — cross-team claim
  app.post('/api/tasks/:tid/group-claim', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tid } = request.params as { tid: string };
    const body = request.body as { agent_id?: string; team_id?: string };

    if (!body.agent_id || typeof body.agent_id !== 'string') {
      return reply.status(400).send({ error: 'agent_id is required' });
    }
    if (!body.team_id || typeof body.team_id !== 'string') {
      return reply.status(400).send({ error: 'team_id is required' });
    }

    const db = getDatabase();

    // Get task
    const taskStmt = db.prepare('SELECT * FROM tasks WHERE id = ?');
    taskStmt.bind([tid]);
    if (!taskStmt.step()) {
      taskStmt.free();
      return reply.status(404).send({ error: 'Task not found' });
    }
    const task = taskStmt.getAsObject() as Record<string, unknown>;
    taskStmt.free();

    // Check task is group task and pending
    if (!task.is_group_task) {
      return reply.status(400).send({ error: 'Task is not a group task' });
    }
    if (task.status !== 'pending') {
      return reply.status(400).send({ error: 'Task is not available for claiming' });
    }

    // Get group task info
    const gtStmt = db.prepare('SELECT * FROM group_tasks WHERE task_id = ?');
    gtStmt.bind([tid]);
    if (!gtStmt.step()) {
      gtStmt.free();
      return reply.status(400).send({ error: 'Group task record not found' });
    }
    const groupTask = gtStmt.getAsObject() as { group_id: string; source_team_id: string };
    gtStmt.free();

    // Verify claiming team is member of the group
    const memberStmt = db.prepare('SELECT team_id FROM group_members WHERE group_id = ? AND team_id = ?');
    memberStmt.bind([groupTask.group_id, body.team_id]);
    if (!memberStmt.step()) {
      memberStmt.free();
      return reply.status(403).send({ error: 'Team is not a member of this group' });
    }
    memberStmt.free();

    // Cannot claim own team's task
    if (groupTask.source_team_id === body.team_id) {
      return reply.status(400).send({ error: 'Cannot claim your own team\'s task' });
    }

    // Validate capabilities (if task requires them)
    const requiredCaps = task.required_capabilities ? JSON.parse(task.required_capabilities as string) : [];
    if (requiredCaps.length > 0) {
      // Get agent capabilities
      const agentStmt = db.prepare('SELECT capabilities FROM agents WHERE id = ?');
      agentStmt.bind([body.agent_id]);
      if (!agentStmt.step()) {
        agentStmt.free();
        return reply.status(404).send({ error: 'Agent not found' });
      }
      const agentRow = agentStmt.getAsObject() as { capabilities: string };
      agentStmt.free();
      const agentCaps = JSON.parse(agentRow.capabilities || '[]');
      const missingCaps = requiredCaps.filter((cap: string) => !agentCaps.includes(cap));
      if (missingCaps.length > 0) {
        return reply.status(400).send({
          error: `Agent missing required capabilities: ${missingCaps.join(', ')}`,
          error_code: 'CAPABILITY_MISMATCH',
        });
      }
    }

    const now = Math.floor(Date.now() / 1000);
    const authRequestId = crypto.randomUUID();

    try {
      // Update task status to pending_authorization
      db.run('UPDATE tasks SET status = ? WHERE id = ?', ['pending_authorization', tid]);

      // Update group_tasks authorization_status
      db.run('UPDATE group_tasks SET authorization_status = ? WHERE task_id = ?', ['pending', tid]);

      // Create authorization request (5 min expiry)
      db.run(
        `INSERT INTO authorization_requests (id, group_task_id, requesting_team_id, requesting_agent_id, status, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [authRequestId, tid, body.team_id, body.agent_id, 'pending', now, now + 300]
      );

      db.save();

      // Check for auto authorization mode
      const groupStmt2 = db.prepare('SELECT contract_yaml FROM groups WHERE id = ?');
      groupStmt2.bind([groupTask.group_id]);
      let authMode = 'manual';
      let trustThreshold = 0.5;
      if (groupStmt2.step()) {
        const groupRow = groupStmt2.getAsObject() as { contract_yaml: string };
        try {
          const contract = yaml.load(groupRow.contract_yaml || '') as Record<string, unknown>;
          authMode = (contract.authorization as string) ?? 'manual';
          trustThreshold = (contract.trust_threshold as number) ?? 0.5;
        } catch {
          // Default to manual
        }
      }
      groupStmt2.free();

      if (authMode === 'auto') {
        // Check reputation threshold
        const meetsThreshold = checkThreshold(body.team_id, groupTask.group_id, trustThreshold);
        if (meetsThreshold) {
          // Auto-approve
          db.run(
            'UPDATE tasks SET status = ?, assignee_id = ?, claimed_at = ? WHERE id = ?',
            ['claimed', body.agent_id, now, tid]
          );
          db.run(
            'UPDATE group_tasks SET authorization_status = ?, authorized_at = ? WHERE task_id = ?',
            ['approved', now, tid]
          );
          db.run(
            'UPDATE authorization_requests SET status = ?, resolved_at = ? WHERE id = ?',
            ['approved', now, authRequestId]
          );
          db.save();

          return {
            success: true,
            authorization_request_id: authRequestId,
            status: 'claimed',
            auto_approved: true,
          };
        }
        // Below threshold: falls through to manual flow
      }

      // TODO: Send WebSocket authorization.requested to task source team owner

      return {
        success: true,
        authorization_request_id: authRequestId,
        status: 'pending_authorization',
        expires_at: now + 300,
      };
    } catch (err) {
      const error = err as Error;
      return reply.status(500).send({ error: error.message });
    }
  });
}