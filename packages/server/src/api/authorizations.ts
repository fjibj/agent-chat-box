import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDatabase } from '../db/index.js';

/** Register authorization API routes */
export async function registerAuthorizationRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/authorizations/pending — list pending authorization requests
  app.get('/api/authorizations/pending', async (request: FastifyRequest, reply: FastifyReply) => {
    const { team_id } = request.query as { team_id?: string };

    const db = getDatabase();

    let sql = `
      SELECT ar.*, t.title as task_title, t.description as task_description,
             gt.group_id, gt.source_team_id,
             a.name as agent_name, a.runtime as agent_runtime
      FROM authorization_requests ar
      JOIN group_tasks gt ON ar.group_task_id = gt.task_id
      JOIN tasks t ON ar.group_task_id = t.id
      LEFT JOIN agents a ON ar.requesting_agent_id = a.id
      WHERE ar.status = 'pending'
    `;
    const params: unknown[] = [];

    if (team_id) {
      sql += ' AND gt.source_team_id = ?';
      params.push(team_id);
    }

    sql += ' ORDER BY ar.created_at ASC';

    const stmt = db.prepare(sql);
    if (params.length > 0) stmt.bind(params);
    const requests: Array<Record<string, unknown>> = [];
    while (stmt.step()) {
      requests.push(stmt.getAsObject());
    }
    stmt.free();

    return requests;
  });

  // POST /api/authorizations/:id/approve — approve authorization
  app.post('/api/authorizations/:id/approve', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const db = getDatabase();

    // Get authorization request
    const arStmt = db.prepare('SELECT * FROM authorization_requests WHERE id = ?');
    arStmt.bind([id]);
    if (!arStmt.step()) {
      arStmt.free();
      return reply.status(404).send({ error: 'Authorization request not found' });
    }
    const ar = arStmt.getAsObject() as {
      group_task_id: string;
      requesting_team_id: string;
      requesting_agent_id: string;
      status: string;
      expires_at: number;
    };
    arStmt.free();

    if (ar.status !== 'pending') {
      return reply.status(400).send({ error: `Authorization request is already ${ar.status}` });
    }

    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (ar.expires_at && ar.expires_at < now) {
      // Mark as expired
      db.run('UPDATE authorization_requests SET status = ?, resolved_at = ? WHERE id = ?', ['expired', now, id]);
      db.run('UPDATE group_tasks SET authorization_status = ? WHERE task_id = ?', ['expired', ar.group_task_id]);
      db.run('UPDATE tasks SET status = ? WHERE id = ?', ['pending', ar.group_task_id]);
      db.save();
      return reply.status(400).send({ error: 'Authorization request has expired' });
    }

    try {
      // Approve: set task to claimed, assign to requesting agent
      db.run(
        'UPDATE tasks SET status = ?, assignee_id = ?, claimed_at = ? WHERE id = ?',
        ['claimed', ar.requesting_agent_id, now, ar.group_task_id]
      );

      // Update group_tasks
      db.run(
        'UPDATE group_tasks SET authorization_status = ?, authorized_at = ? WHERE task_id = ?',
        ['approved', now, ar.group_task_id]
      );

      // Update authorization request
      db.run(
        'UPDATE authorization_requests SET status = ?, resolved_at = ? WHERE id = ?',
        ['approved', now, id]
      );

      db.save();

      try {
        const { wakeFederationAgent } = await import('../federation/hub.js');
        wakeFederationAgent(ar.requesting_team_id, ar.requesting_agent_id, ar.group_task_id, {
          title: 'Federation task approved',
          requiredLabels: [],
          sourceTeamId: '',
        });
      } catch {
        // Ignore wake failures; the task remains claimed and can be polled/recovered.
      }

      return { success: true, status: 'approved' };
    } catch (err) {
      const error = err as Error;
      return reply.status(500).send({ error: error.message });
    }
  });

  // POST /api/authorizations/:id/reject — reject authorization
  app.post('/api/authorizations/:id/reject', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const db = getDatabase();

    // Get authorization request
    const arStmt = db.prepare('SELECT * FROM authorization_requests WHERE id = ?');
    arStmt.bind([id]);
    if (!arStmt.step()) {
      arStmt.free();
      return reply.status(404).send({ error: 'Authorization request not found' });
    }
    const ar = arStmt.getAsObject() as {
      group_task_id: string;
      requesting_team_id: string;
      requesting_agent_id: string;
      status: string;
    };
    arStmt.free();

    if (ar.status !== 'pending') {
      return reply.status(400).send({ error: `Authorization request is already ${ar.status}` });
    }

    const now = Math.floor(Date.now() / 1000);

    try {
      // Reject: reset task to pending, other agents can re-claim
      db.run('UPDATE tasks SET status = ? WHERE id = ?', ['pending', ar.group_task_id]);

      // Update group_tasks
      db.run(
        'UPDATE group_tasks SET authorization_status = ? WHERE task_id = ?',
        ['rejected', ar.group_task_id]
      );

      // Update authorization request
      db.run(
        'UPDATE authorization_requests SET status = ?, resolved_at = ? WHERE id = ?',
        ['rejected', now, id]
      );

      db.save();

      // TODO: Send WebSocket authorization.rejected to requesting team

      return { success: true, status: 'rejected' };
    } catch (err) {
      const error = err as Error;
      return reply.status(500).send({ error: error.message });
    }
  });
}

/** Scan and expire pending authorization requests that have timed out */
export function checkExpiredAuthorizations(): void {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  // Find expired pending requests
  const stmt = db.prepare(`
    SELECT id, group_task_id FROM authorization_requests
    WHERE status = 'pending' AND expires_at < ?
  `);
  stmt.bind([now]);

  const expired: Array<{ id: string; group_task_id: string }> = [];
  while (stmt.step()) {
    expired.push(stmt.getAsObject() as { id: string; group_task_id: string });
  }
  stmt.free();

  for (const ar of expired) {
    db.run('UPDATE authorization_requests SET status = ?, resolved_at = ? WHERE id = ?', ['expired', now, ar.id]);
    db.run('UPDATE group_tasks SET authorization_status = ? WHERE task_id = ?', ['expired', ar.group_task_id]);
    db.run('UPDATE tasks SET status = ? WHERE id = ?', ['pending', ar.group_task_id]);
    console.log(`[auth] Authorization expired: ${ar.id} for task ${ar.group_task_id}`);
  }

  if (expired.length > 0) {
    db.save();
    // TODO: Send WebSocket authorization.expired notifications
  }
}