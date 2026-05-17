import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDatabase } from '../db/index.js';
import { recordReputation } from '../modules/reputation.js';

/** Register review API routes */
export async function registerReviewRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/tasks/:tid/review — submit review
  app.post('/api/tasks/:tid/review', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tid } = request.params as { tid: string };
    const body = request.body as { decision?: string; reviewer_id?: string };

    if (!body.decision || !['approved', 'rejected'].includes(body.decision)) {
      return reply.status(400).send({ error: 'decision must be approved or rejected' });
    }
    if (!body.reviewer_id) {
      return reply.status(400).send({ error: 'reviewer_id is required' });
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

    // Check task is completed group task
    if (task.status !== 'completed') {
      return reply.status(400).send({ error: 'Task must be completed before review' });
    }

    // Get group task info
    const gtStmt = db.prepare('SELECT * FROM group_tasks WHERE task_id = ?');
    gtStmt.bind([tid]);
    if (!gtStmt.step()) {
      gtStmt.free();
      return reply.status(400).send({ error: 'Task is not a group task' });
    }
    const groupTask = gtStmt.getAsObject() as { group_id: string; source_team_id: string };
    gtStmt.free();

    const now = Math.floor(Date.now() / 1000);

    try {
      if (body.decision === 'approved') {
        // Record positive reputation for executing team
        const executingTeamId = task.assignee_id ? getTeamIdForAgent(task.assignee_id as string) : null;
        if (executingTeamId) {
          recordReputation(executingTeamId, groupTask.group_id, 'review_approved', tid);
        }

        // TODO: Send WebSocket review.completed to executing team

        return { success: true, decision: 'approved' };
      } else {
        // Rejected: task back to pool, record negative reputation
        const executingTeamId = task.assignee_id ? getTeamIdForAgent(task.assignee_id as string) : null;
        if (executingTeamId) {
          recordReputation(executingTeamId, groupTask.group_id, 'review_rejected', tid);
        }

        // Reset task to pending
        db.run("UPDATE tasks SET status = 'pending', assignee_id = NULL WHERE id = ?", [tid]);
        db.run("UPDATE group_tasks SET authorization_status = 'none' WHERE task_id = ?", [tid]);
        db.save();

        // TODO: Send WebSocket review.completed to executing team

        return { success: true, decision: 'rejected' };
      }
    } catch (err) {
      const error = err as Error;
      return reply.status(500).send({ error: error.message });
    }
  });
}

/** Get team_id for an agent */
function getTeamIdForAgent(agentId: string): string | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT team_id FROM agents WHERE id = ?');
  stmt.bind([agentId]);
  if (stmt.step()) {
    const row = stmt.getAsObject() as { team_id: string | null };
    stmt.free();
    return row.team_id;
  }
  stmt.free();
  return null;
}