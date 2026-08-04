import { getDatabase } from '../db/index.js';

/** Record a reputation event */
export function recordReputation(
  teamId: string,
  groupId: string,
  eventType: 'task_completed' | 'task_failed' | 'review_approved' | 'review_rejected',
  taskId: string,
  domainId?: string,
): void {
  const db = getDatabase();

  const scoreMap: Record<string, number> = {
    task_completed: 1,
    task_failed: -1,
    review_approved: 1,
    review_rejected: -2,
  };

  const scoreDelta = scoreMap[eventType] || 0;
  const id = `rep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = Math.floor(Date.now() / 1000);

  db.run(
    `INSERT INTO reputation_records (id, team_id, group_id, event_type, score_delta, task_id, created_at, domain_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, teamId, groupId, eventType, scoreDelta, taskId, now, domainId ?? null]
  );
  db.save();
}

/** Get total reputation score for a team in a group */
export function getReputationScore(teamId: string, groupId: string): number {
  const db = getDatabase();

  const stmt = db.prepare(
    'SELECT COALESCE(SUM(score_delta), 0) as total FROM reputation_records WHERE team_id = ? AND group_id = ?'
  );
  stmt.bind([teamId, groupId]);
  if (stmt.step()) {
    const row = stmt.getAsObject() as { total: number };
    stmt.free();
    return row.total;
  }
  stmt.free();
  return 0;
}

/** Check if team reputation meets threshold */
export function checkThreshold(teamId: string, groupId: string, threshold: number): boolean {
  const score = getReputationScore(teamId, groupId);
  return score >= threshold;
}

/** Get reputation details for a team in a group */
export function getReputationDetails(teamId: string, groupId: string): {
  totalScore: number;
  eventCount: number;
  lastEventAt: number | null;
} {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT COALESCE(SUM(score_delta), 0) as total_score,
           COUNT(*) as event_count,
           MAX(created_at) as last_event_at
    FROM reputation_records
    WHERE team_id = ? AND group_id = ?
  `);
  stmt.bind([teamId, groupId]);
  if (stmt.step()) {
    const row = stmt.getAsObject() as { total_score: number; event_count: number; last_event_at: number | null };
    stmt.free();
    return {
      totalScore: row.total_score,
      eventCount: row.event_count,
      lastEventAt: row.last_event_at,
    };
  }
  stmt.free();
  return { totalScore: 0, eventCount: 0, lastEventAt: null };
}

/** Get all team reputations in a group */
export function getGroupReputations(groupId: string): Array<{
  teamId: string;
  totalScore: number;
  eventCount: number;
  lastEventAt: number | null;
}> {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT team_id,
           COALESCE(SUM(score_delta), 0) as total_score,
           COUNT(*) as event_count,
           MAX(created_at) as last_event_at
    FROM reputation_records
    WHERE group_id = ?
    GROUP BY team_id
  `);
  stmt.bind([groupId]);
  const results: Array<{ teamId: string; totalScore: number; eventCount: number; lastEventAt: number | null }> = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as { team_id: string; total_score: number; event_count: number; last_event_at: number | null };
    results.push({
      teamId: row.team_id,
      totalScore: row.total_score,
      eventCount: row.event_count,
      lastEventAt: row.last_event_at,
    });
  }
  stmt.free();
  return results;
}