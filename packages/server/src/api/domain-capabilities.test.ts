import { describe, it, expect } from 'vitest';
import { buildApp, createTeam, createGroup, createDomain } from '../test-helpers.js';
import type { DatabaseWrapper } from '../db/index.js';

// IDSD Slice 2: domain capability declaration, capability discovery and
// domain-level reputation queries (read-only; reputation updates are slice 3).

/** Join a group into a domain via a direct invite-code setup. */
async function joinDomain(
  app: Awaited<ReturnType<typeof buildApp>>['app'],
  db: DatabaseWrapper,
  domainId: string,
  inviteCode: string,
  groupId: string,
  capabilities?: string[],
) {
  const now = Math.floor(Date.now() / 1000);
  db.run(
    'UPDATE domains SET invite_code = ?, invite_code_expires_at = ?, invite_code_max_uses = ?, invite_code_uses = 0 WHERE id = ?',
    [inviteCode, now + 3600, 10, domainId],
  );
  const res = await app.inject({
    method: 'POST',
    url: '/api/domains/join',
    payload: { invite_code: inviteCode, group_id: groupId, capabilities },
  });
  expect(res.statusCode).toBe(200);
}

/** Insert a reputation record directly (score_delta paired with its event type). */
function insertReputation(
  db: DatabaseWrapper,
  id: string,
  teamId: string,
  groupId: string,
  scoreDelta: number,
  eventType:
    'task_completed' | 'task_failed' | 'review_approved' | 'review_rejected' = 'task_completed',
) {
  db.run(
    `INSERT INTO reputation_records (id, team_id, group_id, event_type, score_delta, task_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, teamId, groupId, eventType, scoreDelta, `task-${id}`, Math.floor(Date.now() / 1000)],
  );
}

describe('IDSD-S2: Capability declaration & listing', () => {
  it('TC-S2-001: member group declares capabilities and list reflects them', async () => {
    const { app } = await buildApp();
    const team = await createTeam(app, 'Alpha', 'user-1');
    const group = await createGroup(app, 'Guild A', team.id);
    const domain = await createDomain(app, 'Alliance', group.id);

    const res = await app.inject({
      method: 'POST',
      url: `/api/domains/${domain.id}/capabilities`,
      payload: { group_id: group.id, capabilities: ['code', 'review', 'test'] },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload)).toEqual({ success: true });

    const listRes = await app.inject({
      method: 'GET',
      url: `/api/domains/${domain.id}/capabilities`,
    });
    expect(listRes.statusCode).toBe(200);
    const list = JSON.parse(listRes.payload);
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual({
      group_id: group.id,
      group_name: 'Guild A',
      capabilities: ['code', 'review', 'test'],
    });
  });

  it('TC-S2-002: updating declaration replaces the previous value', async () => {
    const { app, db } = await buildApp();
    const teamA = await createTeam(app, 'Team A', 'user-a');
    const teamB = await createTeam(app, 'Team B', 'user-b');
    const groupA = await createGroup(app, 'Guild A', teamA.id);
    const groupB = await createGroup(app, 'Guild B', teamB.id);
    const domain = await createDomain(app, 'Open Domain', groupA.id);
    await joinDomain(app, db, domain.id, 'CAPUPD01', groupB.id, ['code']);

    // Group B updates its declaration from ['code'] to ['docs']
    const res = await app.inject({
      method: 'POST',
      url: `/api/domains/${domain.id}/capabilities`,
      payload: { group_id: groupB.id, capabilities: ['docs'] },
    });
    expect(res.statusCode).toBe(200);

    const listRes = await app.inject({
      method: 'GET',
      url: `/api/domains/${domain.id}/capabilities`,
    });
    const list = JSON.parse(listRes.payload);
    const memberB = list.find((m: { group_id: string }) => m.group_id === groupB.id);
    expect(memberB.capabilities).toEqual(['docs']);
    // The owner group (no declaration) still defaults to an empty list
    const memberA = list.find((m: { group_id: string }) => m.group_id === groupA.id);
    expect(memberA.capabilities).toEqual([]);
  });

  it('TC-S2-003: empty array clears the declaration', async () => {
    const { app, db } = await buildApp();
    const teamA = await createTeam(app, 'Team A', 'user-a');
    const teamB = await createTeam(app, 'Team B', 'user-b');
    const groupA = await createGroup(app, 'Guild A', teamA.id);
    const groupB = await createGroup(app, 'Guild B', teamB.id);
    const domain = await createDomain(app, 'Open Domain', groupA.id);
    await joinDomain(app, db, domain.id, 'CAPCLR01', groupB.id, ['code']);

    const res = await app.inject({
      method: 'POST',
      url: `/api/domains/${domain.id}/capabilities`,
      payload: { group_id: groupB.id, capabilities: [] },
    });
    expect(res.statusCode).toBe(200);

    const listRes = await app.inject({
      method: 'GET',
      url: `/api/domains/${domain.id}/capabilities`,
    });
    const list = JSON.parse(listRes.payload);
    const memberB = list.find((m: { group_id: string }) => m.group_id === groupB.id);
    expect(memberB.capabilities).toEqual([]);
  });

  it('TC-S2-004: non-member group cannot declare capabilities (403)', async () => {
    const { app } = await buildApp();
    const teamA = await createTeam(app, 'Team A', 'user-a');
    const teamB = await createTeam(app, 'Team B', 'user-b');
    const groupA = await createGroup(app, 'Guild A', teamA.id);
    const groupB = await createGroup(app, 'Guild B', teamB.id);
    const domain = await createDomain(app, 'Closed Domain', groupA.id);

    const res = await app.inject({
      method: 'POST',
      url: `/api/domains/${domain.id}/capabilities`,
      payload: { group_id: groupB.id, capabilities: ['code'] },
    });
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.payload).error).toContain('not a member');
  });

  it('TC-S2-005: rejects non-array capabilities (400)', async () => {
    const { app } = await buildApp();
    const team = await createTeam(app, 'Alpha', 'user-1');
    const group = await createGroup(app, 'Guild A', team.id);
    const domain = await createDomain(app, 'Alliance', group.id);

    const res = await app.inject({
      method: 'POST',
      url: `/api/domains/${domain.id}/capabilities`,
      payload: { group_id: group.id, capabilities: 'code' },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.payload).error).toContain('array of strings');
  });

  it('TC-S2-006: rejects array with non-string elements (400)', async () => {
    const { app } = await buildApp();
    const team = await createTeam(app, 'Alpha', 'user-1');
    const group = await createGroup(app, 'Guild A', team.id);
    const domain = await createDomain(app, 'Alliance', group.id);

    const res = await app.inject({
      method: 'POST',
      url: `/api/domains/${domain.id}/capabilities`,
      payload: { group_id: group.id, capabilities: ['code', 42] },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.payload).error).toContain('array of strings');
  });

  it('TC-S2-007: rejects missing group_id (400)', async () => {
    const { app } = await buildApp();
    const team = await createTeam(app, 'Alpha', 'user-1');
    const group = await createGroup(app, 'Guild A', team.id);
    const domain = await createDomain(app, 'Alliance', group.id);

    const res = await app.inject({
      method: 'POST',
      url: `/api/domains/${domain.id}/capabilities`,
      payload: { capabilities: ['code'] },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.payload).error).toContain('group_id is required');
  });

  it('TC-S2-008: unknown domain returns 404', async () => {
    const { app } = await buildApp();
    const team = await createTeam(app, 'Alpha', 'user-1');
    const group = await createGroup(app, 'Guild A', team.id);

    const postRes = await app.inject({
      method: 'POST',
      url: '/api/domains/domain-missing/capabilities',
      payload: { group_id: group.id, capabilities: ['code'] },
    });
    expect(postRes.statusCode).toBe(404);
    expect(JSON.parse(postRes.payload).error).toContain('Domain not found');

    const getRes = await app.inject({
      method: 'GET',
      url: '/api/domains/domain-missing/capabilities',
    });
    expect(getRes.statusCode).toBe(404);
  });

  it('TC-S2-009: capabilities list ordered by joined_at ascending', async () => {
    const { app, db } = await buildApp();
    const teamA = await createTeam(app, 'Team A', 'user-a');
    const teamB = await createTeam(app, 'Team B', 'user-b');
    const teamC = await createTeam(app, 'Team C', 'user-c');
    const groupA = await createGroup(app, 'Guild A', teamA.id);
    const groupB = await createGroup(app, 'Guild B', teamB.id);
    const groupC = await createGroup(app, 'Guild C', teamC.id);
    const domain = await createDomain(app, 'Ordered Domain', groupA.id);
    await joinDomain(app, db, domain.id, 'CAPORD01', groupB.id, ['code']);
    await joinDomain(app, db, domain.id, 'CAPORD02', groupC.id, ['test']);

    // Pin join times so ordering is deterministic: B(100) < C(200) < A(now)
    db.run('UPDATE domain_members SET joined_at = ? WHERE domain_id = ? AND group_id = ?', [
      100,
      domain.id,
      groupB.id,
    ]);
    db.run('UPDATE domain_members SET joined_at = ? WHERE domain_id = ? AND group_id = ?', [
      200,
      domain.id,
      groupC.id,
    ]);

    const listRes = await app.inject({
      method: 'GET',
      url: `/api/domains/${domain.id}/capabilities`,
    });
    const list = JSON.parse(listRes.payload);
    expect(list.map((m: { group_id: string }) => m.group_id)).toEqual([
      groupB.id,
      groupC.id,
      groupA.id,
    ]);
  });
});

describe('IDSD-S2: Capability discovery', () => {
  it('TC-S2-010: subset match returns only groups declaring the required capability', async () => {
    const { app, db } = await buildApp();
    const teamA = await createTeam(app, 'Team A', 'user-a');
    const teamB = await createTeam(app, 'Team B', 'user-b');
    const teamC = await createTeam(app, 'Team C', 'user-c');
    const teamD = await createTeam(app, 'Team D', 'user-d');
    const groupA = await createGroup(app, 'Guild A', teamA.id);
    const groupB = await createGroup(app, 'Guild B', teamB.id);
    const groupC = await createGroup(app, 'Guild C', teamC.id);
    const groupD = await createGroup(app, 'Guild D', teamD.id);
    const domain = await createDomain(app, 'Discover Domain', groupA.id);
    await joinDomain(app, db, domain.id, 'DIS00101', groupB.id, ['code']);
    await joinDomain(app, db, domain.id, 'DIS00102', groupC.id, ['test', 'docs']);
    // Group D declares nothing

    await app.inject({
      method: 'POST',
      url: `/api/domains/${domain.id}/capabilities`,
      payload: { group_id: groupA.id, capabilities: ['code', 'review', 'test'] },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/domains/${domain.id}/discover?capabilities=code&group_id=${groupA.id}`,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    const ids = body.map((m: { group_id: string }) => m.group_id).sort();
    expect(ids).toEqual([groupA.id, groupB.id].sort());
    // Group D declared nothing → not matched by a non-empty required
    expect(ids).not.toContain(groupD.id);
    // Every result carries a reputation value (0 when no records exist)
    for (const m of body) {
      expect(typeof m.reputation).toBe('number');
    }
  });

  it('TC-S2-011: multiple required capabilities need all of them', async () => {
    const { app, db } = await buildApp();
    const teamA = await createTeam(app, 'Team A', 'user-a');
    const teamB = await createTeam(app, 'Team B', 'user-b');
    const groupA = await createGroup(app, 'Guild A', teamA.id);
    const groupB = await createGroup(app, 'Guild B', teamB.id);
    const domain = await createDomain(app, 'Discover Domain', groupA.id);
    await joinDomain(app, db, domain.id, 'DIS00201', groupB.id, ['code']);

    await app.inject({
      method: 'POST',
      url: `/api/domains/${domain.id}/capabilities`,
      payload: { group_id: groupA.id, capabilities: ['code', 'review', 'test'] },
    });

    // Only group A has both 'code' and 'test'
    const res = await app.inject({
      method: 'GET',
      url: `/api/domains/${domain.id}/discover?capabilities=code,test&group_id=${groupA.id}`,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.map((m: { group_id: string }) => m.group_id)).toEqual([groupA.id]);

    // Group B alone ('code' only) is excluded
    const resB = await app.inject({
      method: 'GET',
      url: `/api/domains/${domain.id}/discover?capabilities=code,test&group_id=${groupB.id}`,
    });
    expect(JSON.parse(resB.payload).map((m: { group_id: string }) => m.group_id)).toEqual([
      groupA.id,
    ]);
  });

  it('TC-S2-012: empty required matches all members', async () => {
    const { app, db } = await buildApp();
    const teamA = await createTeam(app, 'Team A', 'user-a');
    const teamB = await createTeam(app, 'Team B', 'user-b');
    const groupA = await createGroup(app, 'Guild A', teamA.id);
    const groupB = await createGroup(app, 'Guild B', teamB.id);
    const domain = await createDomain(app, 'Discover Domain', groupA.id);
    await joinDomain(app, db, domain.id, 'DIS00301', groupB.id, ['code']);

    const res = await app.inject({
      method: 'GET',
      url: `/api/domains/${domain.id}/discover?capabilities=&group_id=${groupA.id}`,
    });
    expect(res.statusCode).toBe(200);
    const ids = JSON.parse(res.payload)
      .map((m: { group_id: string }) => m.group_id)
      .sort();
    expect(ids).toEqual([groupA.id, groupB.id].sort());

    // Missing capabilities param behaves the same as empty
    const resNoParam = await app.inject({
      method: 'GET',
      url: `/api/domains/${domain.id}/discover?group_id=${groupA.id}`,
    });
    const idsNoParam = JSON.parse(resNoParam.payload)
      .map((m: { group_id: string }) => m.group_id)
      .sort();
    expect(idsNoParam).toEqual([groupA.id, groupB.id].sort());
  });

  it('TC-S2-013: unknown required capability matches nothing', async () => {
    const { app } = await buildApp();
    const teamA = await createTeam(app, 'Team A', 'user-a');
    const groupA = await createGroup(app, 'Guild A', teamA.id);
    const domain = await createDomain(app, 'Discover Domain', groupA.id);

    const res = await app.inject({
      method: 'GET',
      url: `/api/domains/${domain.id}/discover?capabilities=quantum&group_id=${groupA.id}`,
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload)).toEqual([]);
  });

  it('TC-S2-014: discover rejects missing group_id (400)', async () => {
    const { app } = await buildApp();
    const team = await createTeam(app, 'Alpha', 'user-1');
    const group = await createGroup(app, 'Guild A', team.id);
    const domain = await createDomain(app, 'Alliance', group.id);

    const res = await app.inject({
      method: 'GET',
      url: `/api/domains/${domain.id}/discover?capabilities=code`,
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.payload).error).toContain('group_id query param is required');
  });

  it('TC-S2-015: discover rejects non-member requester (403)', async () => {
    const { app } = await buildApp();
    const teamA = await createTeam(app, 'Team A', 'user-a');
    const teamB = await createTeam(app, 'Team B', 'user-b');
    const groupA = await createGroup(app, 'Guild A', teamA.id);
    const groupB = await createGroup(app, 'Guild B', teamB.id);
    const domain = await createDomain(app, 'Closed Domain', groupA.id);

    const res = await app.inject({
      method: 'GET',
      url: `/api/domains/${domain.id}/discover?capabilities=code&group_id=${groupB.id}`,
    });
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.payload).error).toContain('not a member');
  });

  it('TC-S2-016: discover on unknown domain returns 404', async () => {
    const { app } = await buildApp();
    const team = await createTeam(app, 'Alpha', 'user-1');
    const group = await createGroup(app, 'Guild A', team.id);

    const res = await app.inject({
      method: 'GET',
      url: '/api/domains/domain-missing/discover?group_id=' + group.id,
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.payload).error).toContain('Domain not found');
  });
});

/** Build a 4-group domain: G1 (owner) with teams A-D and pinned join times. */
async function buildReputationDomain() {
  const { app, db } = await buildApp();
  const teamA = await createTeam(app, 'Team A', 'user-a');
  const teamB = await createTeam(app, 'Team B', 'user-b');
  const teamC = await createTeam(app, 'Team C', 'user-c');
  const teamD = await createTeam(app, 'Team D', 'user-d');
  const groupA = await createGroup(app, 'Guild A', teamA.id);
  const groupB = await createGroup(app, 'Guild B', teamB.id);
  const groupC = await createGroup(app, 'Guild C', teamC.id);
  const groupD = await createGroup(app, 'Guild D', teamD.id);
  const domain = await createDomain(app, 'Reputation Domain', groupA.id);
  await joinDomain(app, db, domain.id, 'REP00001', groupB.id);
  await joinDomain(app, db, domain.id, 'REP00002', groupC.id);
  await joinDomain(app, db, domain.id, 'REP00003', groupD.id);

  // Pin join times: B(100) < C(200) < D(300) < A(now) for deterministic ties
  db.run('UPDATE domain_members SET joined_at = ? WHERE domain_id = ? AND group_id = ?', [
    100,
    domain.id,
    groupB.id,
  ]);
  db.run('UPDATE domain_members SET joined_at = ? WHERE domain_id = ? AND group_id = ?', [
    200,
    domain.id,
    groupC.id,
  ]);
  db.run('UPDATE domain_members SET joined_at = ? WHERE domain_id = ? AND group_id = ?', [
    300,
    domain.id,
    groupD.id,
  ]);

  return { app, db, teamA, teamB, teamC, teamD, groupA, groupB, groupC, groupD, domain };
}

describe('IDSD-S2: Domain-level reputation', () => {
  it('TC-S2-017: reputation is the mean of per (team, member-group) score sums', async () => {
    const { app, db, teamA, teamB, teamC, groupA, groupB, groupC, groupD, domain } =
      await buildReputationDomain();

    // Group A's team (teamA) has scores in member groups A, B, C: 2 + 1 + 1 → avg 4/3 = 1.33
    insertReputation(db, 'r1', teamA.id, groupA.id, 1);
    insertReputation(db, 'r2', teamA.id, groupA.id, 1);
    insertReputation(db, 'r3', teamA.id, groupB.id, 1);
    insertReputation(db, 'r4', teamA.id, groupC.id, 1);
    // Group B's team (teamB) has scores in B and C: 1 + 1 → avg 1
    insertReputation(db, 'r5', teamB.id, groupB.id, 1);
    insertReputation(db, 'r6', teamB.id, groupC.id, 1);
    // Group C's team (teamC) has one score in C: 1
    insertReputation(db, 'r7', teamC.id, groupC.id, 1);
    // Group D has no records → 0

    const res = await app.inject({
      method: 'GET',
      url: `/api/domains/${domain.id}/reputation?group_id=${groupA.id}`,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload) as Array<{
      group_id: string;
      group_name: string;
      reputation: number;
    }>;

    // Sorted by reputation desc; ties (B vs C at 1) broken by joined_at asc
    expect(body.map((m) => m.group_id)).toEqual([groupA.id, groupB.id, groupC.id, groupD.id]);
    const byId = new Map(body.map((m) => [m.group_id, m]));
    expect(byId.get(groupA.id)?.reputation).toBe(1.33); // 4/3 rounded to 2 decimals
    expect(byId.get(groupB.id)?.reputation).toBe(1);
    expect(byId.get(groupC.id)?.reputation).toBe(1);
    expect(byId.get(groupD.id)?.reputation).toBe(0);
    expect(byId.get(groupA.id)?.group_name).toBe('Guild A');
  });

  it('TC-S2-018: no records yields reputation 0 for every member', async () => {
    const { app, groupA, groupB, domain } = await buildReputationDomain();

    const res = await app.inject({
      method: 'GET',
      url: `/api/domains/${domain.id}/reputation?group_id=${groupA.id}`,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload) as Array<{ group_id: string; reputation: number }>;
    expect(body).toHaveLength(4);
    for (const m of body) {
      expect(m.reputation).toBe(0);
    }
    expect(body.map((m) => m.group_id)).toContain(groupB.id);
  });

  it('TC-S2-019: records outside the domain do not count', async () => {
    const { app, db, teamA, teamB, groupA, groupB, domain } = await buildReputationDomain();

    // Legitimate record: teamA in member group B
    insertReputation(db, 'r1', teamA.id, groupB.id, 1);
    // Outside records: teamA in a non-member group; unknown team in member group B
    const outsider = await createGroup(app, 'Outsider', teamB.id);
    insertReputation(db, 'r2', teamA.id, outsider.id, 5);
    insertReputation(db, 'r3', 'team-ghost', groupB.id, 5);

    const res = await app.inject({
      method: 'GET',
      url: `/api/domains/${domain.id}/reputation?group_id=${groupA.id}`,
    });
    const body = JSON.parse(res.payload) as Array<{ group_id: string; reputation: number }>;
    // teamA scores: only (teamA, B) = 1 counts → avg 1
    expect(body.find((m) => m.group_id === groupA.id)?.reputation).toBe(1);
    // teamB has no qualifying records → 0
    expect(body.find((m) => m.group_id === groupB.id)?.reputation).toBe(0);
  });

  it('TC-S2-020: reputation rejects missing group_id (400)', async () => {
    const { app } = await buildApp();
    const team = await createTeam(app, 'Alpha', 'user-1');
    const group = await createGroup(app, 'Guild A', team.id);
    const domain = await createDomain(app, 'Alliance', group.id);

    const res = await app.inject({ method: 'GET', url: `/api/domains/${domain.id}/reputation` });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.payload).error).toContain('group_id query param is required');
  });

  it('TC-S2-021: reputation rejects non-member requester (403)', async () => {
    const { app } = await buildApp();
    const teamA = await createTeam(app, 'Team A', 'user-a');
    const teamB = await createTeam(app, 'Team B', 'user-b');
    const groupA = await createGroup(app, 'Guild A', teamA.id);
    const groupB = await createGroup(app, 'Guild B', teamB.id);
    const domain = await createDomain(app, 'Closed Domain', groupA.id);

    const res = await app.inject({
      method: 'GET',
      url: `/api/domains/${domain.id}/reputation?group_id=${groupB.id}`,
    });
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.payload).error).toContain('not a member');
  });

  it('TC-S2-022: reputation on unknown domain returns 404', async () => {
    const { app } = await buildApp();
    const team = await createTeam(app, 'Alpha', 'user-1');
    const group = await createGroup(app, 'Guild A', team.id);

    const res = await app.inject({
      method: 'GET',
      url: '/api/domains/domain-missing/reputation?group_id=' + group.id,
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.payload).error).toContain('Domain not found');
  });
});

describe('IDSD-S2: Leave domain removes group from results', () => {
  it('TC-S2-023: after leaving, capabilities/discover/reputation no longer show the group', async () => {
    const { app, db, teamA, teamB, teamC, groupA, groupB, groupC, groupD, domain } =
      await buildReputationDomain();

    // Declarations: A = [code, review, test], B = [code], C = [test, docs], D = []
    await app.inject({
      method: 'POST',
      url: `/api/domains/${domain.id}/capabilities`,
      payload: { group_id: groupA.id, capabilities: ['code', 'review', 'test'] },
    });
    await app.inject({
      method: 'POST',
      url: `/api/domains/${domain.id}/capabilities`,
      payload: { group_id: groupB.id, capabilities: ['code'] },
    });
    await app.inject({
      method: 'POST',
      url: `/api/domains/${domain.id}/capabilities`,
      payload: { group_id: groupC.id, capabilities: ['test', 'docs'] },
    });

    // Reputation: A = (teamA in A: 2, teamA in B: 1, teamA in C: 1) → 1.33
    insertReputation(db, 'r1', teamA.id, groupA.id, 1);
    insertReputation(db, 'r2', teamA.id, groupA.id, 1);
    insertReputation(db, 'r3', teamA.id, groupB.id, 1);
    insertReputation(db, 'r4', teamA.id, groupC.id, 1);
    // B = (teamB in B: 1, teamB in C: 1) → 1
    insertReputation(db, 'r5', teamB.id, groupB.id, 1);
    insertReputation(db, 'r6', teamB.id, groupC.id, 1);
    // C = (teamC in C: 1) → 1
    insertReputation(db, 'r7', teamC.id, groupC.id, 1);

    // Group C leaves the domain
    const leaveRes = await app.inject({
      method: 'POST',
      url: `/api/domains/${domain.id}/leave`,
      payload: { group_id: groupC.id },
    });
    expect(leaveRes.statusCode).toBe(200);

    // Capabilities list no longer contains group C
    const capsRes = await app.inject({
      method: 'GET',
      url: `/api/domains/${domain.id}/capabilities`,
    });
    const caps = JSON.parse(capsRes.payload) as Array<{ group_id: string }>;
    expect(caps.map((m) => m.group_id)).not.toContain(groupC.id);
    expect(caps.map((m) => m.group_id)).toContain(groupD.id);

    // Discovery for 'test' no longer returns group C (group A still matches)
    const discRes = await app.inject({
      method: 'GET',
      url: `/api/domains/${domain.id}/discover?capabilities=test&group_id=${groupA.id}`,
    });
    const disc = JSON.parse(discRes.payload) as Array<{ group_id: string }>;
    expect(disc.map((m) => m.group_id)).toEqual([groupA.id]);

    // Reputation list no longer contains group C, and group A's score is
    // recalculated without records in the departed group C: (2, 1) → 1.5
    const repRes = await app.inject({
      method: 'GET',
      url: `/api/domains/${domain.id}/reputation?group_id=${groupA.id}`,
    });
    const rep = JSON.parse(repRes.payload) as Array<{ group_id: string; reputation: number }>;
    expect(rep.map((m) => m.group_id)).not.toContain(groupC.id);
    expect(rep.find((m) => m.group_id === groupA.id)?.reputation).toBe(1.5);
    expect(rep.find((m) => m.group_id === groupB.id)?.reputation).toBe(1);
  });
});
