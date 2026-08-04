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
import { getReputationScore } from '../modules/reputation.js';

// IDSD Slice 3: domain collaboration initiation (auto-routing), collaboration
// rating (reusing group-layer review semantics) and anomaly detection
// (consecutive review rejections flag a member group in discovery results).

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

/** Insert a reputation record directly with optional created_at control. */
function insertReputation(
  db: DatabaseWrapper,
  id: string,
  teamId: string,
  groupId: string,
  scoreDelta: number,
  eventType: 'task_completed' | 'task_failed' | 'review_approved' | 'review_rejected',
  createdAt?: number,
) {
  db.run(
    `INSERT INTO reputation_records (id, team_id, group_id, event_type, score_delta, task_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      teamId,
      groupId,
      eventType,
      scoreDelta,
      `task-${id}`,
      createdAt ?? Math.floor(Date.now() / 1000),
    ],
  );
}

/** Build a 3-group domain: groupA (owner) + groupB + groupC with pinned join times. */
async function buildCollabDomain() {
  const { app, db } = await buildApp();
  const teamA = await createTeam(app, 'Team A', 'user-a');
  const teamB = await createTeam(app, 'Team B', 'user-b');
  const teamC = await createTeam(app, 'Team C', 'user-c');
  const groupA = await createGroup(app, 'Guild A', teamA.id);
  const groupB = await createGroup(app, 'Guild B', teamB.id);
  const groupC = await createGroup(app, 'Guild C', teamC.id);
  const domain = await createDomain(app, 'Collab Domain', groupA.id);

  // Pin join times: B(100) < C(200) < A(now) for deterministic routing ties
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

  return { app, db, teamA, teamB, teamC, groupA, groupB, groupC, domain };
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

/** Create a domain collaboration task from groupA requiring the given capabilities. */
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

/** Full loop: claim → authorize → force-complete; returns the completed task body. */
async function runFullLoop(
  app: Awaited<ReturnType<typeof buildApp>>['app'],
  taskId: string,
  agentId: string,
  teamId: string,
) {
  const claimRes = await app.inject({
    method: 'POST',
    url: `/api/tasks/${taskId}/group-claim`,
    payload: { agent_id: agentId, team_id: teamId },
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
    url: `/api/tasks/${taskId}/force-complete`,
  });
  expect(completeRes.statusCode).toBe(200);
  return JSON.parse(completeRes.payload);
}

describe('IDSD-S3: Domain collaboration initiation (auto-routing)', () => {
  it('TC-S3-001: routes to the only group declaring the required capability', async () => {
    const { app, db, teamA, groupA, groupB, groupC, domain } = await buildCollabDomain();
    await joinDomain(app, db, domain.id, 'COLAB001', groupB.id, ['data-analysis']);
    await joinDomain(app, db, domain.id, 'COLAB002', groupC.id, ['code']);

    const res = await app.inject({
      method: 'POST',
      url: `/api/domains/${domain.id}/tasks`,
      payload: {
        requester_group_id: groupA.id,
        required_capabilities: ['data-analysis'],
        title: 'Analyze the dataset',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.target_group_id).toBe(groupB.id);
    expect(body.target_group_name).toBe('Guild B');
    expect(body.status).toBe('pending');
    expect(body.task_id).toMatch(/^task-/);

    // domain_tasks index records the collaboration ownership
    const dtStmt = db.prepare(
      'SELECT task_id, domain_id, requester_group_id, target_group_id FROM domain_tasks WHERE task_id = ?',
    );
    dtStmt.bind([body.task_id]);
    expect(dtStmt.step()).toBe(true);
    const dt = dtStmt.getAsObject() as {
      task_id: string;
      domain_id: string;
      requester_group_id: string;
      target_group_id: string;
    };
    dtStmt.free();
    expect(dt.domain_id).toBe(domain.id);
    expect(dt.requester_group_id).toBe(groupA.id);
    expect(dt.target_group_id).toBe(groupB.id);
    // The source team is the requester group's owner team
    const taskStmt = db.prepare('SELECT source_team_id, title FROM tasks WHERE id = ?');
    taskStmt.bind([body.task_id]);
    expect(taskStmt.step()).toBe(true);
    const task = taskStmt.getAsObject() as { source_team_id: string; title: string };
    taskStmt.free();
    expect(task.source_team_id).toBe(teamA.id);
    expect(task.title).toBe('Analyze the dataset');
  });

  it('TC-S3-002: multi-candidate routing picks the highest domain reputation', async () => {
    const { app, db, teamB, teamC, groupA, groupB, groupC, domain } = await buildCollabDomain();
    await joinDomain(app, db, domain.id, 'COLAB003', groupB.id, ['data-analysis']);
    await joinDomain(app, db, domain.id, 'COLAB004', groupC.id, ['data-analysis']);

    // groupB reputation 1, groupC reputation 2 → groupC wins
    insertReputation(db, 'r1', teamB.id, groupB.id, 1, 'task_completed');
    insertReputation(db, 'r2', teamC.id, groupB.id, 2, 'task_completed');

    const res = await app.inject({
      method: 'POST',
      url: `/api/domains/${domain.id}/tasks`,
      payload: { requester_group_id: groupA.id, required_capabilities: ['data-analysis'] },
    });
    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.payload).target_group_id).toBe(groupC.id);
  });

  it('TC-S3-003: equal reputation routes to the earliest joiner', async () => {
    const { app, db, groupA, groupB, groupC, domain } = await buildCollabDomain();
    await joinDomain(app, db, domain.id, 'COLAB005', groupB.id, ['data-analysis']);
    await joinDomain(app, db, domain.id, 'COLAB006', groupC.id, ['data-analysis']);

    // Both have reputation 0 → joined_at asc: B(100) before C(200)
    const res = await app.inject({
      method: 'POST',
      url: `/api/domains/${domain.id}/tasks`,
      payload: { requester_group_id: groupA.id, required_capabilities: ['data-analysis'] },
    });
    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.payload).target_group_id).toBe(groupB.id);
  });

  it('TC-S3-004: excludes the requester itself (self-collaboration blocked)', async () => {
    const { app, db, groupA, groupB, groupC, domain } = await buildCollabDomain();
    await joinDomain(app, db, domain.id, 'COLAB007', groupB.id, ['code']);
    await joinDomain(app, db, domain.id, 'COLAB008', groupC.id, ['test']);

    // Only groupA declares data-analysis
    await app.inject({
      method: 'POST',
      url: `/api/domains/${domain.id}/capabilities`,
      payload: { group_id: groupA.id, capabilities: ['data-analysis'] },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/domains/${domain.id}/tasks`,
      payload: { requester_group_id: groupA.id, required_capabilities: ['data-analysis'] },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.payload).error).toBe('No group with required capabilities found');
  });

  it('TC-S3-005: no matching group returns 400', async () => {
    const { app, db, groupA, groupB, groupC, domain } = await buildCollabDomain();
    await joinDomain(app, db, domain.id, 'COLAB009', groupB.id, ['code']);
    await joinDomain(app, db, domain.id, 'COLAB010', groupC.id, ['test']);

    const res = await app.inject({
      method: 'POST',
      url: `/api/domains/${domain.id}/tasks`,
      payload: { requester_group_id: groupA.id, required_capabilities: ['quantum'] },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.payload).error).toBe('No group with required capabilities found');
  });

  it('TC-S3-006: non-member group cannot initiate (403)', async () => {
    const { app, db, teamA, groupB, domain } = await buildCollabDomain();
    await joinDomain(app, db, domain.id, 'COLAB011', groupB.id, ['data-analysis']);
    const outsider = await createGroup(app, 'Outsider', teamA.id);

    const res = await app.inject({
      method: 'POST',
      url: `/api/domains/${domain.id}/tasks`,
      payload: { requester_group_id: outsider.id, required_capabilities: ['data-analysis'] },
    });
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.payload).error).toContain('not a member');
  });

  it('TC-S3-007: validation errors (400/404)', async () => {
    const { app, db, groupA, groupB, domain } = await buildCollabDomain();
    await joinDomain(app, db, domain.id, 'COLAB012', groupB.id, ['data-analysis']);

    // Missing requester_group_id
    const noRequester = await app.inject({
      method: 'POST',
      url: `/api/domains/${domain.id}/tasks`,
      payload: { required_capabilities: ['data-analysis'] },
    });
    expect(noRequester.statusCode).toBe(400);
    expect(JSON.parse(noRequester.payload).error).toContain('requester_group_id is required');

    // Missing required_capabilities
    const noCaps = await app.inject({
      method: 'POST',
      url: `/api/domains/${domain.id}/tasks`,
      payload: { requester_group_id: groupA.id },
    });
    expect(noCaps.statusCode).toBe(400);
    expect(JSON.parse(noCaps.payload).error).toContain('required_capabilities');

    // Empty required_capabilities
    const emptyCaps = await app.inject({
      method: 'POST',
      url: `/api/domains/${domain.id}/tasks`,
      payload: { requester_group_id: groupA.id, required_capabilities: [] },
    });
    expect(emptyCaps.statusCode).toBe(400);

    // Unknown domain
    const missingDomain = await app.inject({
      method: 'POST',
      url: '/api/domains/domain-missing/tasks',
      payload: { requester_group_id: groupA.id, required_capabilities: ['data-analysis'] },
    });
    expect(missingDomain.statusCode).toBe(404);
    expect(JSON.parse(missingDomain.payload).error).toContain('Domain not found');
  });

  it('TC-S3-008: the task appears in the target group task list', async () => {
    const { app, db, teamA, groupA, groupB, groupC, domain } = await buildCollabDomain();
    await joinDomain(app, db, domain.id, 'COLAB013', groupB.id, ['data-analysis']);
    await joinDomain(app, db, domain.id, 'COLAB014', groupC.id, ['code']);

    const { task_id } = await createCollabTask(app, domain.id, groupA.id, ['data-analysis']);

    const listRes = await app.inject({ method: 'GET', url: `/api/groups/${groupB.id}/tasks` });
    expect(listRes.statusCode).toBe(200);
    const tasks = JSON.parse(listRes.payload);
    const task = tasks.find((t: { id: string }) => t.id === task_id);
    expect(task).toBeDefined();
    expect(task.status).toBe('pending');
    expect(task.isGroupTask).toBe(true);
    expect(task.sourceTeamId).toBe(teamA.id);
  });

  it('TC-S3-009: domain collaboration task list requires a domain member', async () => {
    const { app, db, teamA, groupA, groupB, groupC, domain } = await buildCollabDomain();
    await joinDomain(app, db, domain.id, 'COLAB015', groupB.id, ['data-analysis']);
    await joinDomain(app, db, domain.id, 'COLAB016', groupC.id, ['code']);

    const { task_id } = await createCollabTask(app, domain.id, groupA.id, ['data-analysis']);

    const listRes = await app.inject({
      method: 'GET',
      url: `/api/domains/${domain.id}/tasks?group_id=${groupA.id}`,
    });
    expect(listRes.statusCode).toBe(200);
    const list = JSON.parse(listRes.payload);
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual({
      task_id,
      requester_group_id: groupA.id,
      target_group_id: groupB.id,
      status: 'pending',
      title: 'Domain collaboration task',
      created_at: expect.any(Number),
    });

    // Missing group_id
    const noGroup = await app.inject({
      method: 'GET',
      url: `/api/domains/${domain.id}/tasks`,
    });
    expect(noGroup.statusCode).toBe(400);

    // Non-member group
    const outsider = await createGroup(app, 'Outsider', teamA.id);
    const forbidden = await app.inject({
      method: 'GET',
      url: `/api/domains/${domain.id}/tasks?group_id=${outsider.id}`,
    });
    expect(forbidden.statusCode).toBe(403);
  });
});

describe('IDSD-S3: Full loop — reputation flowback', () => {
  it('TC-S3-010: claim → approve → force-complete records +1 for the executing team', async () => {
    const { app, db, teamB, groupA, groupB, groupC, domain } = await buildCollabDomain();
    await joinDomain(app, db, domain.id, 'COLAB017', groupB.id, ['data-analysis']);
    await joinDomain(app, db, domain.id, 'COLAB018', groupC.id, ['code']);

    const agent = await createTeamAgent(app, teamB.id, ['data-analysis']);
    const { task_id } = await createCollabTask(app, domain.id, groupA.id, ['data-analysis']);

    const completed = await runFullLoop(app, task_id, agent.id, teamB.id);
    expect(completed.status).toBe('completed');

    // task_completed → +1 for teamB in the target group
    expect(getReputationScore(teamB.id, groupB.id)).toBe(1);

    // The domain-level reputation query reflects it immediately
    const repRes = await app.inject({
      method: 'GET',
      url: `/api/domains/${domain.id}/reputation?group_id=${groupA.id}`,
    });
    const rep = JSON.parse(repRes.payload) as Array<{ group_id: string; reputation: number }>;
    expect(rep.find((m) => m.group_id === groupB.id)?.reputation).toBe(1);
  });
});

describe('IDSD-S3: Collaboration rating (reuses review semantics)', () => {
  it('TC-S3-011: rating approved adds +1 (cumulative +2)', async () => {
    const { app, db, teamB, groupA, groupB, groupC, domain } = await buildCollabDomain();
    await joinDomain(app, db, domain.id, 'COLAB019', groupB.id, ['data-analysis']);
    await joinDomain(app, db, domain.id, 'COLAB020', groupC.id, ['code']);

    const agent = await createTeamAgent(app, teamB.id, ['data-analysis']);
    const { task_id } = await createCollabTask(app, domain.id, groupA.id, ['data-analysis']);
    await runFullLoop(app, task_id, agent.id, teamB.id);
    expect(getReputationScore(teamB.id, groupB.id)).toBe(1);

    const rateRes = await app.inject({
      method: 'POST',
      url: `/api/domains/${domain.id}/tasks/${task_id}/rating`,
      payload: { rater_group_id: groupA.id, decision: 'approved' },
    });
    expect(rateRes.statusCode).toBe(200);
    expect(JSON.parse(rateRes.payload)).toEqual({ success: true, decision: 'approved' });

    // review_approved → +1, cumulative 2; domain reputation reflects it right away
    expect(getReputationScore(teamB.id, groupB.id)).toBe(2);
    const repRes = await app.inject({
      method: 'GET',
      url: `/api/domains/${domain.id}/reputation?group_id=${groupA.id}`,
    });
    const rep = JSON.parse(repRes.payload) as Array<{ group_id: string; reputation: number }>;
    expect(rep.find((m) => m.group_id === groupB.id)?.reputation).toBe(2);
  });

  it('TC-S3-012: rating rejected adds -2', async () => {
    const { app, db, teamB, groupA, groupB, groupC, domain } = await buildCollabDomain();
    await joinDomain(app, db, domain.id, 'COLAB021', groupB.id, ['data-analysis']);
    await joinDomain(app, db, domain.id, 'COLAB022', groupC.id, ['code']);

    const agent = await createTeamAgent(app, teamB.id, ['data-analysis']);
    const { task_id } = await createCollabTask(app, domain.id, groupA.id, ['data-analysis']);
    await runFullLoop(app, task_id, agent.id, teamB.id);

    const rateRes = await app.inject({
      method: 'POST',
      url: `/api/domains/${domain.id}/tasks/${task_id}/rating`,
      payload: { rater_group_id: groupA.id, decision: 'rejected' },
    });
    expect(rateRes.statusCode).toBe(200);
    expect(JSON.parse(rateRes.payload)).toEqual({ success: true, decision: 'rejected' });

    // task_completed +1 then review_rejected -2 → -1
    expect(getReputationScore(teamB.id, groupB.id)).toBe(-1);
  });

  it('TC-S3-013: non-requester group cannot rate (403)', async () => {
    const { app, db, teamB, groupA, groupB, groupC, domain } = await buildCollabDomain();
    await joinDomain(app, db, domain.id, 'COLAB023', groupB.id, ['data-analysis']);
    await joinDomain(app, db, domain.id, 'COLAB024', groupC.id, ['code']);

    const agent = await createTeamAgent(app, teamB.id, ['data-analysis']);
    const { task_id } = await createCollabTask(app, domain.id, groupA.id, ['data-analysis']);
    await runFullLoop(app, task_id, agent.id, teamB.id);

    const res = await app.inject({
      method: 'POST',
      url: `/api/domains/${domain.id}/tasks/${task_id}/rating`,
      payload: { rater_group_id: groupC.id, decision: 'approved' },
    });
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.payload).error).toContain('requester group');

    // The reputation was not touched
    expect(getReputationScore(teamB.id, groupB.id)).toBe(1);
  });

  it('TC-S3-014: incomplete task cannot be rated (400)', async () => {
    const { app, db, groupA, groupB, groupC, domain } = await buildCollabDomain();
    await joinDomain(app, db, domain.id, 'COLAB025', groupB.id, ['data-analysis']);
    await joinDomain(app, db, domain.id, 'COLAB026', groupC.id, ['code']);

    const { task_id } = await createCollabTask(app, domain.id, groupA.id, ['data-analysis']);

    const res = await app.inject({
      method: 'POST',
      url: `/api/domains/${domain.id}/tasks/${task_id}/rating`,
      payload: { rater_group_id: groupA.id, decision: 'approved' },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.payload).error).toContain('must be completed');
  });

  it('TC-S3-015: a task can only be rated once (400)', async () => {
    const { app, db, teamB, groupA, groupB, groupC, domain } = await buildCollabDomain();
    await joinDomain(app, db, domain.id, 'COLAB027', groupB.id, ['data-analysis']);
    await joinDomain(app, db, domain.id, 'COLAB028', groupC.id, ['code']);

    const agent = await createTeamAgent(app, teamB.id, ['data-analysis']);
    const { task_id } = await createCollabTask(app, domain.id, groupA.id, ['data-analysis']);
    await runFullLoop(app, task_id, agent.id, teamB.id);

    const first = await app.inject({
      method: 'POST',
      url: `/api/domains/${domain.id}/tasks/${task_id}/rating`,
      payload: { rater_group_id: groupA.id, decision: 'approved' },
    });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({
      method: 'POST',
      url: `/api/domains/${domain.id}/tasks/${task_id}/rating`,
      payload: { rater_group_id: groupA.id, decision: 'rejected' },
    });
    expect(second.statusCode).toBe(400);
    expect(JSON.parse(second.payload).error).toBe('Task already rated');
    // Second rating did not apply
    expect(getReputationScore(teamB.id, groupB.id)).toBe(2);
  });

  it('TC-S3-016: rating a task that is not a collaboration of this domain → 404', async () => {
    const { app, db, groupA, groupB, groupC, domain } = await buildCollabDomain();
    await joinDomain(app, db, domain.id, 'COLAB029', groupB.id, ['data-analysis']);
    await joinDomain(app, db, domain.id, 'COLAB030', groupC.id, ['code']);

    const res = await app.inject({
      method: 'POST',
      url: `/api/domains/${domain.id}/tasks/task-not-in-domain/rating`,
      payload: { rater_group_id: groupA.id, decision: 'approved' },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.payload).error).toContain('Task not found in this domain');
  });

  it('TC-S3-017: rating requires a valid decision and member rater (400/403)', async () => {
    const { app, db, teamA, groupA, groupB, domain } = await buildCollabDomain();
    await joinDomain(app, db, domain.id, 'COLAB031', groupB.id, ['data-analysis']);

    const { task_id } = await createCollabTask(app, domain.id, groupA.id, ['data-analysis']);

    // Invalid decision
    const badDecision = await app.inject({
      method: 'POST',
      url: `/api/domains/${domain.id}/tasks/${task_id}/rating`,
      payload: { rater_group_id: groupA.id, decision: 'meh' },
    });
    expect(badDecision.statusCode).toBe(400);

    // Missing rater_group_id
    const noRater = await app.inject({
      method: 'POST',
      url: `/api/domains/${domain.id}/tasks/${task_id}/rating`,
      payload: { decision: 'approved' },
    });
    expect(noRater.statusCode).toBe(400);

    // Non-member rater
    const outsider = await createGroup(app, 'Outsider', teamA.id);
    const forbidden = await app.inject({
      method: 'POST',
      url: `/api/domains/${domain.id}/tasks/${task_id}/rating`,
      payload: { rater_group_id: outsider.id, decision: 'approved' },
    });
    expect(forbidden.statusCode).toBe(403);
  });
});

describe('IDSD-S3: Anomaly detection — consecutive rejections', () => {
  it('TC-S3-018: 5 consecutive rejections flag the group in discover and reputation', async () => {
    const { app, db, teamB, groupA, groupB, groupC, domain } = await buildCollabDomain();
    await joinDomain(app, db, domain.id, 'COLAB032', groupB.id, ['data-analysis']);
    await joinDomain(app, db, domain.id, 'COLAB033', groupC.id, ['data-analysis', 'code']);

    for (let i = 1; i <= 5; i++) {
      insertReputation(db, `rej${i}`, teamB.id, groupB.id, -2, 'review_rejected', 100 + i * 100);
    }

    const discRes = await app.inject({
      method: 'GET',
      url: `/api/domains/${domain.id}/discover?capabilities=data-analysis&group_id=${groupA.id}`,
    });
    expect(discRes.statusCode).toBe(200);
    const disc = JSON.parse(discRes.payload) as Array<{ group_id: string; flagged: boolean }>;
    const bInDisc = disc.find((m) => m.group_id === groupB.id);
    expect(bInDisc).toBeDefined();
    expect(bInDisc!.flagged).toBe(true);
    expect(disc.find((m) => m.group_id === groupC.id)?.flagged).toBe(false);

    const repRes = await app.inject({
      method: 'GET',
      url: `/api/domains/${domain.id}/reputation?group_id=${groupA.id}`,
    });
    const rep = JSON.parse(repRes.payload) as Array<{ group_id: string; flagged: boolean }>;
    expect(rep.find((m) => m.group_id === groupB.id)?.flagged).toBe(true);
  });

  it('TC-S3-019: a single rejection does not flag', async () => {
    const { app, db, teamB, groupA, groupB, groupC, domain } = await buildCollabDomain();
    await joinDomain(app, db, domain.id, 'COLAB034', groupB.id, ['data-analysis']);
    await joinDomain(app, db, domain.id, 'COLAB035', groupC.id, ['code']);

    insertReputation(db, 'rej1', teamB.id, groupB.id, -2, 'review_rejected');

    const discRes = await app.inject({
      method: 'GET',
      url: `/api/domains/${domain.id}/discover?capabilities=data-analysis&group_id=${groupA.id}`,
    });
    const disc = JSON.parse(discRes.payload) as Array<{ group_id: string; flagged: boolean }>;
    expect(disc.find((m) => m.group_id === groupB.id)?.flagged).toBe(false);
  });

  it('TC-S3-020: an approved review breaks the consecutive streak', async () => {
    const { app, db, teamB, groupA, groupB, groupC, domain } = await buildCollabDomain();
    await joinDomain(app, db, domain.id, 'COLAB036', groupB.id, ['data-analysis']);
    await joinDomain(app, db, domain.id, 'COLAB037', groupC.id, ['code']);

    // Oldest → newest: rejected(300), rejected(200), rejected(100),
    // approved(400) breaks the streak, newest rejected(500) restarts at 1
    insertReputation(db, 'rej1', teamB.id, groupB.id, -2, 'review_rejected', 100);
    insertReputation(db, 'rej2', teamB.id, groupB.id, -2, 'review_rejected', 200);
    insertReputation(db, 'rej3', teamB.id, groupB.id, -2, 'review_rejected', 300);
    insertReputation(db, 'apr1', teamB.id, groupB.id, 1, 'review_approved', 400);
    insertReputation(db, 'rej4', teamB.id, groupB.id, -2, 'review_rejected', 500);

    const discRes = await app.inject({
      method: 'GET',
      url: `/api/domains/${domain.id}/discover?capabilities=data-analysis&group_id=${groupA.id}`,
    });
    const disc = JSON.parse(discRes.payload) as Array<{ group_id: string; flagged: boolean }>;
    expect(disc.find((m) => m.group_id === groupB.id)?.flagged).toBe(false);
  });

  it('TC-S3-021: review events outside the domain do not count', async () => {
    const { app, db, teamB, teamC, groupA, groupB, groupC, domain } = await buildCollabDomain();
    await joinDomain(app, db, domain.id, 'COLAB038', groupB.id, ['data-analysis']);
    await joinDomain(app, db, domain.id, 'COLAB039', groupC.id, ['code']);

    // 5 rejections for teamB in an outsider group (not a domain member)
    const outsider = await createGroup(app, 'Outsider', teamC.id);
    for (let i = 1; i <= 5; i++) {
      insertReputation(db, `out${i}`, teamB.id, outsider.id, -2, 'review_rejected', i * 100);
    }

    const discRes = await app.inject({
      method: 'GET',
      url: `/api/domains/${domain.id}/discover?capabilities=data-analysis&group_id=${groupA.id}`,
    });
    const disc = JSON.parse(discRes.payload) as Array<{ group_id: string; flagged: boolean }>;
    expect(disc.find((m) => m.group_id === groupB.id)?.flagged).toBe(false);
  });
});

describe('IDSD-S3: Agent team assignment (PATCH team_id)', () => {
  it('TC-S3-022: PATCH /api/agents/:id team_id updates the agent', async () => {
    const { app } = await buildApp();
    const team = await createTeam(app, 'Target Team', 'user-1');
    const machine = await createMachine(app, 'M-Patch');
    const agent = await createAgent(app, machine.id, 'Patch Agent', 'claude');

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/agents/${agent.id}`,
      payload: { team_id: team.id },
    });
    expect(res.statusCode).toBe(200);

    const getRes = await app.inject({ method: 'GET', url: `/api/agents/${agent.id}` });
    expect(JSON.parse(getRes.payload).teamId).toBe(team.id);
  });

  it('TC-S3-023: PATCH team_id of an unknown team returns 404', async () => {
    const { app } = await buildApp();
    const machine = await createMachine(app, 'M-Patch404');
    const agent = await createAgent(app, machine.id, 'Patch Agent 404', 'claude');

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/agents/${agent.id}`,
      payload: { team_id: 'team-missing' },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.payload).error).toBe('Team not found');
  });
});
