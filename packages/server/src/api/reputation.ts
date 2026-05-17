import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDatabase } from '../db/index.js';

/** Register reputation API routes */
export async function registerReputationRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/groups/:gid/reputation — list all team reputations in group
  app.get('/api/groups/:gid/reputation', async (request: FastifyRequest, reply: FastifyReply) => {
    const { gid } = request.params as { gid: string };
    const db = getDatabase();

    // Verify group exists
    const groupStmt = db.prepare('SELECT id FROM groups WHERE id = ?');
    groupStmt.bind([gid]);
    if (!groupStmt.step()) {
      groupStmt.free();
      return reply.status(404).send({ error: 'Group not found' });
    }
    groupStmt.free();

    const stmt = db.prepare(`
      SELECT team_id,
             COALESCE(SUM(score_delta), 0) as total_score,
             COUNT(*) as event_count,
             MAX(created_at) as last_event_at
      FROM reputation_records
      WHERE group_id = ?
      GROUP BY team_id
    `);
    stmt.bind([gid]);
    const results: Array<{ team_id: string; total_score: number; event_count: number; last_event_at: number | null }> = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as { team_id: string; total_score: number; event_count: number; last_event_at: number | null };
      results.push(row);
    }
    stmt.free();

    return results;
  });

  // GET /api/groups/:gid/reputation/:tid — get single team reputation in group
  app.get('/api/groups/:gid/reputation/:tid', async (request: FastifyRequest, reply: FastifyReply) => {
    const { gid, tid } = request.params as { gid: string; tid: string };
    const db = getDatabase();

    // Verify group exists
    const groupStmt = db.prepare('SELECT id FROM groups WHERE id = ?');
    groupStmt.bind([gid]);
    if (!groupStmt.step()) {
      groupStmt.free();
      return reply.status(404).send({ error: 'Group not found' });
    }
    groupStmt.free();

    const stmt = db.prepare(`
      SELECT COALESCE(SUM(score_delta), 0) as total_score,
             COUNT(*) as event_count,
             MAX(created_at) as last_event_at
      FROM reputation_records
      WHERE group_id = ? AND team_id = ?
    `);
    stmt.bind([gid, tid]);
    if (stmt.step()) {
      const row = stmt.getAsObject() as { total_score: number; event_count: number; last_event_at: number | null };
      stmt.free();
      return { ...row, team_id: tid, group_id: gid };
    }
    stmt.free();

    return { team_id: tid, group_id: gid, total_score: 0, event_count: 0, last_event_at: null };
  });
}
