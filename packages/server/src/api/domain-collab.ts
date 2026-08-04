import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDatabase } from '../db/index.js';
import {
  getDomainMembers,
  getDomainReputation,
  parseCapabilities,
  requireDomain,
  requireDomainMember,
} from './domain-capabilities.js';
import { recordReputation } from '../modules/reputation.js';
import { indexGroupTask } from '../federation/hub.js';

/**
 * IDSD Slice 3: domain collaboration tasks.
 *
 * All mechanisms reuse group-layer primitives (group_tasks, recordReputation,
 * review events, authorization gate) — the only domain-layer rule remains the
 * reputation aggregation. Cross-group tasks are inserted directly into the
 * target group's pool (the source team is not a member of the target group, so
 * the group task publish API would 403).
 */

/** Register domain collaboration routes. */
export async function registerDomainCollabRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/domains/:id/tasks — initiate a domain collaboration (auto-routing)
  app.post('/api/domains/:id/tasks', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      requester_group_id?: string;
      title?: string;
      description?: string;
      required_capabilities?: unknown;
      timeout_seconds?: number;
    };

    const db = getDatabase();

    if (!requireDomain(db, id, reply)) return reply;

    if (!body.requester_group_id || typeof body.requester_group_id !== 'string') {
      return reply.status(400).send({ error: 'requester_group_id is required' });
    }
    if (!requireDomainMember(db, id, body.requester_group_id, reply)) return reply;

    // required_capabilities must be a non-empty array of strings
    const required = body.required_capabilities;
    if (
      !Array.isArray(required) ||
      required.length === 0 ||
      required.some((c) => typeof c !== 'string')
    ) {
      return reply
        .status(400)
        .send({ error: 'required_capabilities must be a non-empty array of strings' });
    }
    const requiredCaps: string[] = required;

    // Auto-route: members declaring required ⊆ capabilities, excluding the requester.
    // Pick the highest domain reputation; ties broken by join time ascending.
    const candidates = getDomainMembers(db, id)
      .filter((m) => {
        if (m.group_id === body.requester_group_id) return false;
        const declared = parseCapabilities(m.capabilities);
        return requiredCaps.every((c) => declared.includes(c));
      })
      .sort(
        (a, b) =>
          getDomainReputation(db, id, b.group_id) - getDomainReputation(db, id, a.group_id) ||
          a.joined_at - b.joined_at,
      );
    const target = candidates[0];
    if (!target) {
      return reply.status(400).send({ error: 'No group with required capabilities found' });
    }

    // Resolve the requester group's owner team as the source team
    const requesterStmt = db.prepare('SELECT owner_team_id FROM groups WHERE id = ?');
    requesterStmt.bind([body.requester_group_id]);
    if (!requesterStmt.step()) {
      requesterStmt.free();
      return reply.status(404).send({ error: 'Requester group not found' });
    }
    const requesterRow = requesterStmt.getAsObject() as { owner_team_id: string | null };
    requesterStmt.free();
    if (!requesterRow.owner_team_id) {
      return reply.status(400).send({ error: 'Requester group has no owner team' });
    }

    const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const nowMs = Date.now();

    try {
      // Create the group task inside the target group (mirrors group-tasks.ts)
      db.run(
        `INSERT INTO tasks (id, title, description, priority, status, tags, creator_id, required_capabilities, is_group_task, source_team_id, timeout_seconds, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          taskId,
          body.title && body.title.trim().length > 0
            ? body.title.trim()
            : 'Domain collaboration task',
          body.description || '',
          'normal',
          'pending',
          JSON.stringify([]),
          body.requester_group_id,
          JSON.stringify(requiredCaps),
          1, // is_group_task
          requesterRow.owner_team_id,
          body.timeout_seconds || 3600,
          nowMs,
        ],
      );

      db.run(
        `INSERT INTO group_tasks (task_id, group_id, source_team_id, authorization_status, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [taskId, target.group_id, requesterRow.owner_team_id, 'none', nowMs],
      );

      db.run(
        `INSERT INTO domain_tasks (task_id, domain_id, requester_group_id, target_group_id, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [taskId, id, body.requester_group_id, target.group_id, nowMs],
      );

      db.save();

      // Index in federation queue for cross-team poll; failure must not block
      try {
        indexGroupTask(taskId, target.group_id, requesterRow.owner_team_id, requiredCaps);
      } catch (err) {
        console.warn(
          '[domain-collab] Failed to index group task in federation queue:',
          (err as Error).message,
        );
      }

      return reply.status(201).send({
        task_id: taskId,
        target_group_id: target.group_id,
        target_group_name: target.group_name,
        status: 'pending',
      });
    } catch (err) {
      const error = err as Error;
      return reply.status(500).send({ error: error.message });
    }
  });

  // GET /api/domains/:id/tasks?group_id=<member> — list domain collaboration tasks
  app.get('/api/domains/:id/tasks', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { group_id?: string };

    const db = getDatabase();

    if (!requireDomain(db, id, reply)) return reply;

    if (!query.group_id || typeof query.group_id !== 'string') {
      return reply.status(400).send({ error: 'group_id query param is required' });
    }
    if (!requireDomainMember(db, id, query.group_id, reply)) return reply;

    const stmt = db.prepare(`
      SELECT dt.task_id, dt.requester_group_id, dt.target_group_id, dt.created_at,
             t.status, t.title
      FROM domain_tasks dt
      JOIN tasks t ON t.id = dt.task_id
      WHERE dt.domain_id = ?
      ORDER BY dt.created_at DESC
    `);
    stmt.bind([id]);
    const tasks: Array<Record<string, unknown>> = [];
    while (stmt.step()) {
      tasks.push(stmt.getAsObject());
    }
    stmt.free();

    return tasks.map((t) => ({
      task_id: t.task_id,
      requester_group_id: t.requester_group_id,
      target_group_id: t.target_group_id,
      status: t.status,
      title: t.title,
      created_at: t.created_at,
    }));
  });

  // POST /api/domains/:id/tasks/:tid/rating — rate a collaboration (reuses review semantics)
  app.post(
    '/api/domains/:id/tasks/:tid/rating',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id, tid } = request.params as { id: string; tid: string };
      const body = request.body as { rater_group_id?: string; decision?: string };

      const db = getDatabase();

      if (!requireDomain(db, id, reply)) return reply;

      if (!body.rater_group_id || typeof body.rater_group_id !== 'string') {
        return reply.status(400).send({ error: 'rater_group_id is required' });
      }
      if (body.decision !== 'approved' && body.decision !== 'rejected') {
        return reply.status(400).send({ error: 'decision must be approved or rejected' });
      }
      if (!requireDomainMember(db, id, body.rater_group_id, reply)) return reply;

      // The task must be a collaboration task of this domain
      const dtStmt = db.prepare(
        'SELECT task_id, requester_group_id, target_group_id FROM domain_tasks WHERE task_id = ? AND domain_id = ?',
      );
      dtStmt.bind([tid, id]);
      if (!dtStmt.step()) {
        dtStmt.free();
        return reply.status(404).send({ error: 'Task not found in this domain' });
      }
      const dt = dtStmt.getAsObject() as {
        task_id: string;
        requester_group_id: string;
        target_group_id: string;
      };
      dtStmt.free();

      // Only the requester group may rate its own collaboration
      if (dt.requester_group_id !== body.rater_group_id) {
        return reply.status(403).send({ error: 'Only the requester group can rate this task' });
      }

      // The task must have been completed
      const taskStmt = db.prepare('SELECT status, assignee_id FROM tasks WHERE id = ?');
      taskStmt.bind([tid]);
      if (!taskStmt.step()) {
        taskStmt.free();
        return reply.status(404).send({ error: 'Task not found' });
      }
      const task = taskStmt.getAsObject() as { status: string; assignee_id: string | null };
      taskStmt.free();

      if (task.status !== 'completed') {
        return reply.status(400).send({ error: 'Task must be completed before rating' });
      }

      // One rating per task — a review event already recorded means it is rated
      const reviewStmt = db.prepare(
        "SELECT id FROM reputation_records WHERE task_id = ? AND event_type IN ('review_approved', 'review_rejected')",
      );
      reviewStmt.bind([tid]);
      const alreadyRated = reviewStmt.step();
      reviewStmt.free();
      if (alreadyRated) {
        return reply.status(400).send({ error: 'Task already rated' });
      }

      // Executing team = the assignee agent's team
      if (!task.assignee_id) {
        return reply.status(400).send({ error: 'Executing team not found' });
      }
      const agentStmt = db.prepare('SELECT team_id FROM agents WHERE id = ?');
      agentStmt.bind([task.assignee_id]);
      if (!agentStmt.step()) {
        agentStmt.free();
        return reply.status(400).send({ error: 'Executing team not found' });
      }
      const agentRow = agentStmt.getAsObject() as { team_id: string | null };
      agentStmt.free();
      if (!agentRow.team_id) {
        return reply.status(400).send({ error: 'Executing team not found' });
      }

      // Reuse the group-layer review reputation semantics on the target group
      recordReputation(
        agentRow.team_id,
        dt.target_group_id,
        body.decision === 'approved' ? 'review_approved' : 'review_rejected',
        tid,
      );

      return { success: true, decision: body.decision };
    },
  );
}
