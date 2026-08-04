import { describe, it, expect } from 'vitest';
import {
  buildApp,
  createTeam,
  createGroup,
  createDomain,
  createMachine,
  createAgent,
} from '../test-helpers.js';
import type { DatabaseWrapper } from '../db/index.js';
import { recordReputation } from '../modules/reputation.js';

// IDSD Slice 4: domain boundary integrity — dissolve / leave / group-delete
// clean up domain data (members + collaboration index) with no orphan rows,
// and domain reputation stays isolated per domain.

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

/** Create an agent that belongs to a team via the PATCH team_id path. */
async function createTeamAgent(
  app: Awaited<ReturnType<typeof buildApp>>['app'],
  teamId: string,
  capabilities: string[] = ['data-analysis'],
) {
  const machine = await createMachine(app, `M-${teamId}`);
  const agent = await createAgent(app, machine.id, `Agent-${teamId}`, 'claude', capabilities);
  const patchRes = await app.inject({
    method: 'PATCH',
    url: `/api/agents/${agent.id}`,
    payload: { team_id: teamId },
  });
  expect(patchRes.statusCode).toBe(200);
  return agent;
}

/** Create a domain collaboration task from the requester group. */
async function createCollabTask(
  app: Awaited<ReturnType<typeof buildApp>>['app'],
  domainId: string,
  requesterGroupId: string,
  requiredCapabilities: string[],
) {
  const res = await app.inject({
    method: 'POST',
    url: `/api/domains/${domainId}/tasks`,
    payload: { requester_group_id: requesterGroupId, required_capabilities: requiredCapabilities },
  });
  expect(res.statusCode).toBe(201);
  return JSON.parse(res.payload) as { task_id: string; target_group_id: string; status: string };
}

/** Count domain_tasks rows matching the given criteria. */
function countDomainTasks(db: DatabaseWrapper, where: string, params: unknown[]): number {
  const stmt = db.prepare(`SELECT COUNT(*) AS count FROM domain_tasks WHERE ${where}`);
  stmt.bind(params);
  stmt.step();
  const row = stmt.getAsObject() as { count: number };
  stmt.free();
  return row.count;
}

/** Build a 2-member domain (owner A + member B declaring data-analysis). */
async function buildTwoMemberDomain() {
  const { app, db } = await buildApp();
  const teamA = await createTeam(app, 'Team A', 'user-a');
  const teamB = await createTeam(app, 'Team B', 'user-b');
  const groupA = await createGroup(app, 'Guild A', teamA.id);
  const groupB = await createGroup(app, 'Guild B', teamB.id);
  const domain = await createDomain(app, 'Boundary Domain', groupA.id);
  await joinDomain(app, db, domain.id, 'BOUND001', groupB.id, ['data-analysis']);
  return { app, db, teamA, teamB, groupA, groupB, domain };
}

describe('IDSD-S4: Dissolve domain cleans the collaboration index', () => {
  it('TC-S4-001: dissolving a domain with collaboration tasks removes all its domain_tasks rows', async () => {
    const { app, db, groupA, groupB, domain } = await buildTwoMemberDomain();
    const { task_id } = await createCollabTask(app, domain.id, groupA.id, ['data-analysis']);
    expect(countDomainTasks(db, 'domain_id = ?', [domain.id])).toBe(1);

    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/domains/${domain.id}`,
    });
    expect(delRes.statusCode).toBe(200);

    // No collaboration index row remains for the dissolved domain
    expect(countDomainTasks(db, 'domain_id = ?', [domain.id])).toBe(0);
    // The task row itself is untouched (tasks are owned by groups, not domains)
    const taskStmt = db.prepare('SELECT id FROM tasks WHERE id = ?');
    taskStmt.bind([task_id]);
    expect(taskStmt.step()).toBe(true);
    taskStmt.free();

    // Domain APIs all return 404
    const getRes = await app.inject({ method: 'GET', url: `/api/domains/${domain.id}` });
    expect(getRes.statusCode).toBe(404);
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/domains/${domain.id}/tasks?group_id=${groupA.id}`,
    });
    expect(listRes.statusCode).toBe(404);
    // The domain is gone from both groups' domain lists
    for (const groupId of [groupA.id, groupB.id]) {
      const domainsRes = await app.inject({
        method: 'GET',
        url: `/api/domains?group_id=${groupId}`,
      });
      expect(JSON.parse(domainsRes.payload)).toEqual([]);
    }
  });

  it('TC-S4-002: dissolving a domain without tasks still cleans members (regression)', async () => {
    const { app, db, groupB, domain } = await buildTwoMemberDomain();
    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/domains/${domain.id}`,
    });
    expect(delRes.statusCode).toBe(200);

    const memberStmt = db.prepare('SELECT group_id FROM domain_members WHERE domain_id = ?');
    memberStmt.bind([domain.id]);
    expect(memberStmt.step()).toBe(false);
    memberStmt.free();
    expect(countDomainTasks(db, 'domain_id = ?', [domain.id])).toBe(0);
    expect(
      (await app.inject({ method: 'GET', url: `/api/domains?group_id=${groupB.id}` })).payload,
    ).toBe('[]');
  });
});

describe('IDSD-S4: Group leaves domain cleans the collaboration index', () => {
  it('TC-S4-003: after leave, domain_tasks has no rows for the group; task list and rating reflect the cleanup', async () => {
    const { app, db, groupA, groupB, domain } = await buildTwoMemberDomain();
    const { task_id } = await createCollabTask(app, domain.id, groupA.id, ['data-analysis']);
    expect(task_id).toBeDefined();

    // Group B leaves the domain
    const leaveRes = await app.inject({
      method: 'POST',
      url: `/api/domains/${domain.id}/leave`,
      payload: { group_id: groupB.id },
    });
    expect(leaveRes.statusCode).toBe(200);

    // No domain_tasks row where B is requester or target
    expect(
      countDomainTasks(db, 'domain_id = ? AND (requester_group_id = ? OR target_group_id = ?)', [
        domain.id,
        groupB.id,
        groupB.id,
      ]),
    ).toBe(0);

    // The task disappears from the domain task list
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/domains/${domain.id}/tasks?group_id=${groupA.id}`,
    });
    expect(listRes.statusCode).toBe(200);
    expect(JSON.parse(listRes.payload)).toEqual([]);

    // Rating the collaboration now returns 404 (index cleaned)
    const rateRes = await app.inject({
      method: 'POST',
      url: `/api/domains/${domain.id}/tasks/${task_id}/rating`,
      payload: { rater_group_id: groupA.id, decision: 'approved' },
    });
    expect(rateRes.statusCode).toBe(404);
    expect(JSON.parse(rateRes.payload).error).toContain('Task not found in this domain');

    // The group task itself is untouched: it still appears in group B's task list
    const groupTasksRes = await app.inject({
      method: 'GET',
      url: `/api/groups/${groupB.id}/tasks`,
    });
    expect(groupTasksRes.statusCode).toBe(200);
    const groupTasks = JSON.parse(groupTasksRes.payload) as Array<{ id: string }>;
    expect(groupTasks.some((t) => t.id === task_id)).toBe(true);
  });

  it('TC-S4-004: owner cannot leave — cleanup not triggered (regression)', async () => {
    const { app, groupA, domain } = await buildTwoMemberDomain();
    const leaveRes = await app.inject({
      method: 'POST',
      url: `/api/domains/${domain.id}/leave`,
      payload: { group_id: groupA.id },
    });
    expect(leaveRes.statusCode).toBe(400);
    expect(JSON.parse(leaveRes.payload).error).toContain('Domain owner cannot leave');

    // The domain still exists and the owner is still a member
    const getRes = await app.inject({ method: 'GET', url: `/api/domains/${domain.id}` });
    expect(getRes.statusCode).toBe(200);
  });
});

describe('IDSD-S4: Group deletion cascades domain cleanup', () => {
  it('TC-S4-005: deleting a member group removes it from domain_members, domain_tasks and capability list', async () => {
    const { app, db, groupA, groupB, domain } = await buildTwoMemberDomain();
    // Group B declares a capability and is the target of a collaboration
    await app.inject({
      method: 'POST',
      url: `/api/domains/${domain.id}/capabilities`,
      payload: { group_id: groupB.id, capabilities: ['data-analysis', 'code'] },
    });
    const { task_id } = await createCollabTask(app, domain.id, groupA.id, ['data-analysis']);

    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/groups/${groupB.id}`,
    });
    expect(delRes.statusCode).toBe(200);

    // No domain membership row for the deleted group
    const memberStmt = db.prepare('SELECT domain_id FROM domain_members WHERE group_id = ?');
    memberStmt.bind([groupB.id]);
    expect(memberStmt.step()).toBe(false);
    memberStmt.free();

    // No collaboration index row where B is requester or target
    expect(
      countDomainTasks(db, 'requester_group_id = ? OR target_group_id = ?', [groupB.id, groupB.id]),
    ).toBe(0);

    // B is gone from the capability list; the domain itself survives
    const capsRes = await app.inject({
      method: 'GET',
      url: `/api/domains/${domain.id}/capabilities`,
    });
    const caps = JSON.parse(capsRes.payload) as Array<{ group_id: string }>;
    expect(caps.some((c) => c.group_id === groupB.id)).toBe(false);

    const getRes = await app.inject({ method: 'GET', url: `/api/domains/${domain.id}` });
    expect(getRes.statusCode).toBe(200);
    expect(task_id).toBeDefined();
  });

  it('TC-S4-006: deleting the owner group dissolves its domains (domains/domain_members/domain_tasks all cleared)', async () => {
    const { app, db, groupA, groupB, domain } = await buildTwoMemberDomain();
    const { task_id } = await createCollabTask(app, domain.id, groupA.id, ['data-analysis']);

    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/groups/${groupA.id}`,
    });
    expect(delRes.statusCode).toBe(200);

    // Domain row gone
    const domainStmt = db.prepare('SELECT id FROM domains WHERE id = ?');
    domainStmt.bind([domain.id]);
    expect(domainStmt.step()).toBe(false);
    domainStmt.free();

    // Domain members gone
    const memberStmt = db.prepare('SELECT group_id FROM domain_members WHERE domain_id = ?');
    memberStmt.bind([domain.id]);
    expect(memberStmt.step()).toBe(false);
    memberStmt.free();

    // Collaboration index gone
    expect(countDomainTasks(db, 'domain_id = ?', [domain.id])).toBe(0);
    expect(
      countDomainTasks(db, 'requester_group_id = ? OR target_group_id = ?', [groupA.id, groupA.id]),
    ).toBe(0);

    // Domain API returns 404
    const getRes = await app.inject({ method: 'GET', url: `/api/domains/${domain.id}` });
    expect(getRes.statusCode).toBe(404);

    // The remaining member group no longer lists the dissolved domain
    const listRes = await app.inject({ method: 'GET', url: `/api/domains?group_id=${groupB.id}` });
    expect(JSON.parse(listRes.payload)).toEqual([]);
    expect(task_id).toBeDefined();
  });

  it('TC-S4-007: deleting a plain group with no domains still works (regression)', async () => {
    const { app } = await buildApp();
    const team = await createTeam(app, 'Solo', 'user-1');
    const group = await createGroup(app, 'Plain Group', team.id);

    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/groups/${group.id}`,
    });
    expect(delRes.statusCode).toBe(200);
    expect(JSON.parse(delRes.payload).success).toBe(true);

    const getRes = await app.inject({ method: 'GET', url: `/api/groups/${group.id}` });
    expect(getRes.statusCode).toBe(404);
  });
});

describe('IDSD-S4: Reputation isolation across domains', () => {
  it('TC-S4-008: domain collaboration events are tagged per domain — a rejected rating in D1 does not pollute B in D2', async () => {
    const { app, db } = await buildApp();
    const teamA = await createTeam(app, 'Team A', 'user-a');
    const teamB = await createTeam(app, 'Team B', 'user-b');
    const groupA = await createGroup(app, 'Guild A', teamA.id);
    const groupB = await createGroup(app, 'Guild B', teamB.id);

    // B belongs to D1 and D2; B is the execution target of the D1 task, so the
    // reputation events are recorded against B itself — a member of both domains.
    const d1 = await createDomain(app, 'Domain 1', groupA.id);
    const d2 = await createDomain(app, 'Domain 2', groupA.id);
    await joinDomain(app, db, d1.id, 'ISO1D101', groupB.id, ['data-analysis']);
    await joinDomain(app, db, d2.id, 'ISO2D101', groupB.id, ['data-analysis']);

    // A initiates a collaboration in D1 routed to B (only candidate)
    const { task_id } = await createCollabTask(app, d1.id, groupA.id, ['data-analysis']);

    // B's agent executes the task
    const agent = await createTeamAgent(app, teamB.id, ['data-analysis']);
    const claimRes = await app.inject({
      method: 'POST',
      url: `/api/tasks/${task_id}/group-claim`,
      payload: { agent_id: agent.id, team_id: teamB.id },
    });
    expect(claimRes.statusCode).toBe(200);
    const claimBody = JSON.parse(claimRes.payload);
    expect(claimBody.status).toBe('pending_authorization');
    const approveRes = await app.inject({
      method: 'POST',
      url: `/api/authorizations/${claimBody.authorization_request_id}/approve`,
    });
    expect(approveRes.statusCode).toBe(200);
    const completeRes = await app.inject({
      method: 'POST',
      url: `/api/tasks/${task_id}/force-complete`,
    });
    expect(completeRes.statusCode).toBe(200);

    // The completion event is tagged with the owning domain D1
    const compStmt = db.prepare(
      "SELECT domain_id FROM reputation_records WHERE task_id = ? AND event_type = 'task_completed'",
    );
    compStmt.bind([task_id]);
    expect(compStmt.step()).toBe(true);
    const compRow = compStmt.getAsObject() as { domain_id: string | null };
    compStmt.free();
    expect(compRow.domain_id).toBe(d1.id);

    // A rejects the collaboration in D1
    const rateRes = await app.inject({
      method: 'POST',
      url: `/api/domains/${d1.id}/tasks/${task_id}/rating`,
      payload: { rater_group_id: groupA.id, decision: 'rejected' },
    });
    expect(rateRes.statusCode).toBe(200);

    // The rating event is tagged with the owning domain D1 as well
    const rejStmt = db.prepare(
      "SELECT domain_id FROM reputation_records WHERE task_id = ? AND event_type = 'review_rejected'",
    );
    rejStmt.bind([task_id]);
    expect(rejStmt.step()).toBe(true);
    const rejRow = rejStmt.getAsObject() as { domain_id: string | null };
    rejStmt.free();
    expect(rejRow.domain_id).toBe(d1.id);

    // B's D1 reputation reflects both D1-tagged events (+1 then -2 → -1)
    const rep1Res = await app.inject({
      method: 'GET',
      url: `/api/domains/${d1.id}/reputation?group_id=${groupA.id}`,
    });
    const rep1 = JSON.parse(rep1Res.payload) as Array<{ group_id: string; reputation: number }>;
    expect(rep1.find((m) => m.group_id === groupB.id)?.reputation).toBe(-1);

    // B's D2 reputation is untouched: D1-tagged events are filtered out
    const rep2Res = await app.inject({
      method: 'GET',
      url: `/api/domains/${d2.id}/reputation?group_id=${groupA.id}`,
    });
    const rep2 = JSON.parse(rep2Res.payload) as Array<{ group_id: string; reputation: number }>;
    expect(rep2.find((m) => m.group_id === groupB.id)?.reputation).toBe(0);
  });

  it('TC-S4-010: group-level reputation events (no domain tag) count in every domain the group belongs to', async () => {
    const { app, db } = await buildApp();
    const teamA = await createTeam(app, 'Team A', 'user-a');
    const teamB = await createTeam(app, 'Team B', 'user-b');
    const groupA = await createGroup(app, 'Guild A', teamA.id);
    const groupB = await createGroup(app, 'Guild B', teamB.id);

    const d1 = await createDomain(app, 'Domain 1', groupA.id);
    const d2 = await createDomain(app, 'Domain 2', groupA.id);
    await joinDomain(app, db, d1.id, 'ISO1D201', groupB.id, ['data-analysis']);
    await joinDomain(app, db, d2.id, 'ISO2D201', groupB.id, ['data-analysis']);

    // A plain group-level event (no domain tag → NULL domain_id)
    recordReputation(teamB.id, groupB.id, 'task_completed', 'plain-task-1');
    const plainStmt = db.prepare('SELECT domain_id FROM reputation_records WHERE task_id = ?');
    plainStmt.bind(['plain-task-1']);
    expect(plainStmt.step()).toBe(true);
    const plainRow = plainStmt.getAsObject() as { domain_id: string | null };
    plainStmt.free();
    expect(plainRow.domain_id).toBeNull();

    // Counted in D1 and D2 alike
    const rep1Res = await app.inject({
      method: 'GET',
      url: `/api/domains/${d1.id}/reputation?group_id=${groupA.id}`,
    });
    const rep1 = JSON.parse(rep1Res.payload) as Array<{ group_id: string; reputation: number }>;
    expect(rep1.find((m) => m.group_id === groupB.id)?.reputation).toBe(1);

    const rep2Res = await app.inject({
      method: 'GET',
      url: `/api/domains/${d2.id}/reputation?group_id=${groupA.id}`,
    });
    const rep2 = JSON.parse(rep2Res.payload) as Array<{ group_id: string; reputation: number }>;
    expect(rep2.find((m) => m.group_id === groupB.id)?.reputation).toBe(1);
  });
});

describe('IDSD-S4: Cross-domain invisibility', () => {
  it('TC-S4-009: a collaboration in D1 is invisible in D2; a D2-only member gets 403 on D1 tasks', async () => {
    const { app, db } = await buildApp();
    const teamA = await createTeam(app, 'Team A', 'user-a');
    const teamB = await createTeam(app, 'Team B', 'user-b');
    const teamC = await createTeam(app, 'Team C', 'user-c');
    const groupA = await createGroup(app, 'Guild A', teamA.id);
    const groupB = await createGroup(app, 'Guild B', teamB.id);
    const groupC2 = await createGroup(app, 'Guild C2', teamC.id);

    const d1 = await createDomain(app, 'Domain 1', groupA.id);
    const d2 = await createDomain(app, 'Domain 2', groupA.id);
    await joinDomain(app, db, d1.id, 'VIS1D101', groupB.id, ['data-analysis']);
    await joinDomain(app, db, d2.id, 'VIS2D101', groupB.id, ['data-analysis']);
    await joinDomain(app, db, d2.id, 'VIS2D102', groupC2.id, ['code']);

    const { task_id } = await createCollabTask(app, d1.id, groupA.id, ['data-analysis']);

    // Visible in D1 to a D1 member
    const d1List = await app.inject({
      method: 'GET',
      url: `/api/domains/${d1.id}/tasks?group_id=${groupB.id}`,
    });
    expect(d1List.statusCode).toBe(200);
    const d1Tasks = JSON.parse(d1List.payload) as Array<{ task_id: string }>;
    expect(d1Tasks.some((t) => t.task_id === task_id)).toBe(true);

    // Not visible in D2 (task index belongs to D1 only)
    const d2List = await app.inject({
      method: 'GET',
      url: `/api/domains/${d2.id}/tasks?group_id=${groupB.id}`,
    });
    expect(d2List.statusCode).toBe(200);
    expect(JSON.parse(d2List.payload)).toEqual([]);

    // A D2-only member cannot access D1's collaboration task list
    const forbidden = await app.inject({
      method: 'GET',
      url: `/api/domains/${d1.id}/tasks?group_id=${groupC2.id}`,
    });
    expect(forbidden.statusCode).toBe(403);
    expect(JSON.parse(forbidden.payload).error).toContain('not a member');
  });
});
