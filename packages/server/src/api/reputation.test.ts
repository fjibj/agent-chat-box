import { describe, it, expect } from 'vitest';
import { buildApp, createTeam, createGroup } from '../test-helpers.js';
import { recordReputation } from '../modules/reputation.js';

// ATDD: EPIC-005 Reputation System
// Stories: G020-G022

describe('G020: Reputation Records', () => {
  it('TC-G020-001: invalid event_type rejected by DB', async () => {
    const { db } = await buildApp();
    // SQLite CHECK constraint will reject invalid event_type
    let threw = false;
    try {
      db.run(
        `INSERT INTO reputation_records (id, team_id, group_id, event_type, score_delta, task_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['rep-bad', 'team-1', 'group-1', 'invalid_type', 0, 't1', 0]
      );
      db.save();
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });
});

describe('G021: Reputation Query API', () => {
  it('TC-G021-001: query returns correct aggregation', async () => {
    const { app } = await buildApp();
    const team = await createTeam(app, 'Scorer', 'user-1');
    const group = await createGroup(app, 'Rep Group', team.id);

    // Insert 3 reputation records: +1, +1, -1
    recordReputation(team.id, group.id, 'task_completed', 't1');
    recordReputation(team.id, group.id, 'task_completed', 't2');
    recordReputation(team.id, group.id, 'task_failed', 't3');

    const res = await app.inject({
      method: 'GET',
      url: `/api/groups/${group.id}/reputation/${team.id}`,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.total_score).toBe(1);
    expect(body.event_count).toBe(3);
  });
});

describe('G022: Reputation Threshold', () => {
  it('TC-G022-001: exact threshold returns true', async () => {
    const { app } = await buildApp();
    const team = await createTeam(app, 'Exact', 'user-1');
    const group = await createGroup(app, 'Exact Group', team.id);

    // Score = 5
    for (let i = 0; i < 5; i++) {
      recordReputation(team.id, group.id, 'task_completed', `t${i}`);
    }

    const res = await app.inject({
      method: 'GET',
      url: `/api/groups/${group.id}/reputation/${team.id}`,
    });
    const body = JSON.parse(res.payload);
    expect(body.total_score).toBe(5);
    expect(body.total_score >= 5).toBe(true);
  });

  it('TC-G022-002: below threshold returns false', async () => {
    const { app } = await buildApp();
    const team = await createTeam(app, 'Low', 'user-1');
    const group = await createGroup(app, 'Low Group', team.id);

    // Score = 4
    for (let i = 0; i < 4; i++) {
      recordReputation(team.id, group.id, 'task_completed', `t${i}`);
    }

    const res = await app.inject({
      method: 'GET',
      url: `/api/groups/${group.id}/reputation/${team.id}`,
    });
    const body = JSON.parse(res.payload);
    expect(body.total_score).toBe(4);
    expect(body.total_score >= 5).toBe(false);
  });
});
