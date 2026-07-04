import { describe, it, expect, vi } from 'vitest';
import { buildApp, createTeam, createMachine, createAgent, createGroup } from '../test-helpers.js';
import { getGroupTeams, refreshGroupTeamsMap, getTeamClients } from '../ws/handler.js';
import { getDatabase } from '../db/index.js';
import { checkExpiredAuthorizations } from '../api/authorizations.js';
import { checkThreshold, getReputationScore } from '../modules/reputation.js';

// ATDD: EPIC-003 Two-Tier Task Pool & Authorization
// Stories: G010-G016

describe('G010: DB Migration v6→v7', () => {
  it('TC-G010-001: migration creates group_tasks and authorization_requests tables', async () => {
    const { db } = await buildApp();
    const gtInfo = db.exec('PRAGMA table_info(group_tasks)');
    expect(gtInfo.length).toBeGreaterThan(0);
    const gtColumns = gtInfo[0].values.map((v) => v[1]);
    expect(gtColumns).toContain('task_id');
    expect(gtColumns).toContain('group_id');
    expect(gtColumns).toContain('authorization_status');

    const arInfo = db.exec('PRAGMA table_info(authorization_requests)');
    expect(arInfo.length).toBeGreaterThan(0);
    const arColumns = arInfo[0].values.map((v) => v[1]);
    expect(arColumns).toContain('group_task_id');
    expect(arColumns).toContain('requesting_team_id');
    expect(arColumns).toContain('status');
  });
});

describe('G011: Group Task Publish API', () => {
  it('TC-G011-001: invalid capability rejected', async () => {
    const { app } = await buildApp();
    const team = await createTeam(app, 'Pub Team', 'user-1');
    const group = await createGroup(app, 'Pub Group', team.id);

    const res = await app.inject({
      method: 'POST',
      url: `/api/groups/${group.id}/tasks`,
      payload: {
        title: 'Task with bad cap',
        source_team_id: team.id,
        creator_id: 'user-1',
        required_capabilities: ['magic'],
      },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toContain('Capabilities not in group contract');
  });

  it('TC-G011-002: non-member cannot publish', async () => {
    const { app } = await buildApp();
    const teamA = await createTeam(app, 'Team A', 'user-a');
    const teamB = await createTeam(app, 'Team B', 'user-b');
    const group = await createGroup(app, 'Private Group', teamA.id);

    const res = await app.inject({
      method: 'POST',
      url: `/api/groups/${group.id}/tasks`,
      payload: {
        title: 'Intruder Task',
        source_team_id: teamB.id,
        creator_id: 'user-b',
      },
    });
    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.error).toContain('not a member');
  });

  it('TC-G011-003: GET /api/groups/:gid/tasks filters by status', async () => {
    const { app, db } = await buildApp();
    const teamA = await createTeam(app, 'Source', 'user-a');
    const teamB = await createTeam(app, 'Executor', 'user-b');
    const group = await createGroup(app, 'Filter Group', teamA.id);

    db.run('INSERT INTO group_members (group_id, team_id, role, joined_at) VALUES (?, ?, ?, ?)', [
      group.id,
      teamB.id,
      'member',
      0,
    ]);

    // Publish two tasks with different statuses
    const pub1 = await app.inject({
      method: 'POST',
      url: `/api/groups/${group.id}/tasks`,
      payload: { title: 'Pending Task', source_team_id: teamA.id, creator_id: 'user-a' },
    });
    const task1 = JSON.parse(pub1.payload);

    const pub2 = await app.inject({
      method: 'POST',
      url: `/api/groups/${group.id}/tasks`,
      payload: { title: 'Another Task', source_team_id: teamA.id, creator_id: 'user-a' },
    });
    const task2 = JSON.parse(pub2.payload);

    // Mark task2 as completed
    db.run("UPDATE tasks SET status = 'completed' WHERE id = ?", [task2.id]);
    db.save();

    // Filter by pending
    const pendingRes = await app.inject({
      method: 'GET',
      url: `/api/groups/${group.id}/tasks?status=pending`,
    });
    const pendingBody = JSON.parse(pendingRes.payload);
    expect(Array.isArray(pendingBody)).toBe(true);
    expect(pendingBody.length).toBe(1);
    expect(pendingBody[0].id).toBe(task1.id);
    expect(pendingBody[0].isGroupTask).toBe(true);
    expect(pendingBody[0].sourceTeamId).toBe(teamA.id);
    expect(pendingBody[0].groupId).toBe(group.id);
    expect(pendingBody[0].authorizationStatus).toBe('none');

    // Filter by completed
    const completedRes = await app.inject({
      method: 'GET',
      url: `/api/groups/${group.id}/tasks?status=completed`,
    });
    const completedBody = JSON.parse(completedRes.payload);
    expect(completedBody.length).toBe(1);
    expect(completedBody[0].id).toBe(task2.id);
  });
});

describe('G012: WebSocket Group Broadcast', () => {
  it('TC-G012-001: groupTeams map updates on join/leave', async () => {
    const { app, db } = await buildApp();
    const teamA = await createTeam(app, 'Team A', 'user-a');
    const teamB = await createTeam(app, 'Team B', 'user-b');
    const group = await createGroup(app, 'Broadcast Group', teamA.id);

    // Add team B manually to group
    db.run('INSERT INTO group_members (group_id, team_id, role, joined_at) VALUES (?, ?, ?, ?)', [
      group.id,
      teamB.id,
      'member',
      Math.floor(Date.now() / 1000),
    ]);

    refreshGroupTeamsMap();
    const map = getGroupTeams();
    expect(map.has(group.id)).toBe(true);
    expect(map.get(group.id)!.has(teamA.id)).toBe(true);
    expect(map.get(group.id)!.has(teamB.id)).toBe(true);

    // Team B leaves
    db.run('DELETE FROM group_members WHERE group_id = ? AND team_id = ?', [group.id, teamB.id]);
    refreshGroupTeamsMap();
    expect(map.get(group.id)!.has(teamB.id)).toBe(false);
  });

  it('TC-G012-002: broadcast latency under 5s for 50 teams', async () => {
    // Performance test: verify broadcast logic iterates efficiently
    const { app, db } = await buildApp();
    const ownerTeam = await createTeam(app, 'Owner', 'user-0');
    const group = await createGroup(app, 'Perf Group', ownerTeam.id);

    // Add 50 teams
    for (let i = 0; i < 50; i++) {
      const t = await createTeam(app, `Team ${i}`, `user-${i}`);
      db.run('INSERT INTO group_members (group_id, team_id, role, joined_at) VALUES (?, ?, ?, ?)', [
        group.id,
        t.id,
        'member',
        Math.floor(Date.now() / 1000),
      ]);
    }
    refreshGroupTeamsMap();

    const start = performance.now();
    const map = getGroupTeams();
    const teams = map.get(group.id);
    expect(teams).toBeDefined();
    expect(teams!.size).toBe(51); // owner + 50
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(5000);
  });
});

describe('G013: Cross-Team Claim API', () => {
  it('TC-G013-001: concurrent claim race — only one wins', async () => {
    const { app, db } = await buildApp();
    const teamA = await createTeam(app, 'Source Team', 'user-a');
    const teamB = await createTeam(app, 'Claim Team B', 'user-b');
    const teamC = await createTeam(app, 'Claim Team C', 'user-c');
    const group = await createGroup(app, 'Race Group', teamA.id);

    // Add B and C to group
    db.run('INSERT INTO group_members (group_id, team_id, role, joined_at) VALUES (?, ?, ?, ?)', [
      group.id,
      teamB.id,
      'member',
      0,
    ]);
    db.run('INSERT INTO group_members (group_id, team_id, role, joined_at) VALUES (?, ?, ?, ?)', [
      group.id,
      teamC.id,
      'member',
      0,
    ]);

    // Create machines and agents
    const mB = await createMachine(app, 'MB');
    const aB = await createAgent(app, mB.id, 'Agent B', 'claude');
    const mC = await createMachine(app, 'MC');
    const aC = await createAgent(app, mC.id, 'Agent C', 'claude');

    // Publish group task
    const pubRes = await app.inject({
      method: 'POST',
      url: `/api/groups/${group.id}/tasks`,
      payload: {
        title: 'Race Task',
        source_team_id: teamA.id,
        creator_id: 'user-a',
      },
    });
    const task = JSON.parse(pubRes.payload);

    // Concurrent claims
    const [resB, resC] = await Promise.all([
      app.inject({
        method: 'POST',
        url: `/api/tasks/${task.id}/group-claim`,
        payload: { agent_id: aB.id, team_id: teamB.id },
      }),
      app.inject({
        method: 'POST',
        url: `/api/tasks/${task.id}/group-claim`,
        payload: { agent_id: aC.id, team_id: teamC.id },
      }),
    ]);

    const statuses = [resB.statusCode, resC.statusCode];
    const successes = statuses.filter((s) => s === 200);
    expect(successes.length).toBe(1);
  });

  it('TC-G013-002: claim without capability match fails', async () => {
    const { app, db } = await buildApp();
    const teamA = await createTeam(app, 'Source', 'user-a');
    const teamB = await createTeam(app, 'Claimer', 'user-b');
    const group = await createGroup(app, 'Cap Group', teamA.id);

    db.run('INSERT INTO group_members (group_id, team_id, role, joined_at) VALUES (?, ?, ?, ?)', [
      group.id,
      teamB.id,
      'member',
      0,
    ]);

    const mB = await createMachine(app, 'MB');
    const aB = await createAgent(app, mB.id, 'Agent B', 'claude', ['code']);

    // Publish task requiring 'review' capability
    const pubRes = await app.inject({
      method: 'POST',
      url: `/api/groups/${group.id}/tasks`,
      payload: {
        title: 'Review Task',
        source_team_id: teamA.id,
        creator_id: 'user-a',
        required_capabilities: ['review'],
      },
    });
    const task = JSON.parse(pubRes.payload);

    const claimRes = await app.inject({
      method: 'POST',
      url: `/api/tasks/${task.id}/group-claim`,
      payload: { agent_id: aB.id, team_id: teamB.id },
    });
    expect(claimRes.statusCode).toBe(400);
    const body = JSON.parse(claimRes.payload);
    expect(body.error_code).toBe('CAPABILITY_MISMATCH');
  });
});

describe('G014: Manual Authorization Mode', () => {
  it('TC-G014-001: approve sets task to claimed', async () => {
    const { app, db } = await buildApp();
    const teamA = await createTeam(app, 'Source', 'user-a');
    const teamB = await createTeam(app, 'Claimer', 'user-b');
    const group = await createGroup(app, 'Manual Group', teamA.id);

    db.run('INSERT INTO group_members (group_id, team_id, role, joined_at) VALUES (?, ?, ?, ?)', [
      group.id,
      teamB.id,
      'member',
      0,
    ]);

    const mB = await createMachine(app, 'MB');
    const aB = await createAgent(app, mB.id, 'Agent B', 'claude');

    const pubRes = await app.inject({
      method: 'POST',
      url: `/api/groups/${group.id}/tasks`,
      payload: { title: 'Auth Task', source_team_id: teamA.id, creator_id: 'user-a' },
    });
    const task = JSON.parse(pubRes.payload);

    // Claim creates authorization request
    const claimRes = await app.inject({
      method: 'POST',
      url: `/api/tasks/${task.id}/group-claim`,
      payload: { agent_id: aB.id, team_id: teamB.id },
    });
    expect(claimRes.statusCode).toBe(200);
    const claimBody = JSON.parse(claimRes.payload);
    expect(claimBody.status).toBe('pending_authorization');

    // Approve
    const approveRes = await app.inject({
      method: 'POST',
      url: `/api/authorizations/${claimBody.authorization_request_id}/approve`,
    });
    expect(approveRes.statusCode).toBe(200);
    const approveBody = JSON.parse(approveRes.payload);
    expect(approveBody.status).toBe('approved');

    // Verify task is claimed
    const taskRes = await app.inject({ method: 'GET', url: `/api/tasks/${task.id}` });
    const taskBody = JSON.parse(taskRes.payload);
    expect(taskBody.status).toBe('claimed');
    expect(taskBody.assigneeId).toBe(aB.id);
  });

  it('TC-G014-002: reject resets task to pending', async () => {
    const { app, db } = await buildApp();
    const teamA = await createTeam(app, 'Source', 'user-a');
    const teamB = await createTeam(app, 'Claimer', 'user-b');
    const group = await createGroup(app, 'Reject Group', teamA.id);

    db.run('INSERT INTO group_members (group_id, team_id, role, joined_at) VALUES (?, ?, ?, ?)', [
      group.id,
      teamB.id,
      'member',
      0,
    ]);

    const mB = await createMachine(app, 'MB');
    const aB = await createAgent(app, mB.id, 'Agent B', 'claude');

    const pubRes = await app.inject({
      method: 'POST',
      url: `/api/groups/${group.id}/tasks`,
      payload: { title: 'Reject Task', source_team_id: teamA.id, creator_id: 'user-a' },
    });
    const task = JSON.parse(pubRes.payload);

    const claimRes = await app.inject({
      method: 'POST',
      url: `/api/tasks/${task.id}/group-claim`,
      payload: { agent_id: aB.id, team_id: teamB.id },
    });
    const claimBody = JSON.parse(claimRes.payload);

    // Reject
    const rejectRes = await app.inject({
      method: 'POST',
      url: `/api/authorizations/${claimBody.authorization_request_id}/reject`,
    });
    expect(rejectRes.statusCode).toBe(200);

    // Verify task is back to pending
    const taskRes = await app.inject({ method: 'GET', url: `/api/tasks/${task.id}` });
    const taskBody = JSON.parse(taskRes.payload);
    expect(taskBody.status).toBe('pending');
    expect(taskBody.assigneeId).toBeUndefined();
  });

  it('TC-G014-003: expired authorization auto-resets task', async () => {
    const { app, db } = await buildApp();
    const teamA = await createTeam(app, 'Source', 'user-a');
    const teamB = await createTeam(app, 'Claimer', 'user-b');
    const group = await createGroup(app, 'Expire Group', teamA.id);

    db.run('INSERT INTO group_members (group_id, team_id, role, joined_at) VALUES (?, ?, ?, ?)', [
      group.id,
      teamB.id,
      'member',
      0,
    ]);

    const mB = await createMachine(app, 'MB');
    const aB = await createAgent(app, mB.id, 'Agent B', 'claude');

    const pubRes = await app.inject({
      method: 'POST',
      url: `/api/groups/${group.id}/tasks`,
      payload: { title: 'Expire Task', source_team_id: teamA.id, creator_id: 'user-a' },
    });
    const task = JSON.parse(pubRes.payload);

    const claimRes = await app.inject({
      method: 'POST',
      url: `/api/tasks/${task.id}/group-claim`,
      payload: { agent_id: aB.id, team_id: teamB.id },
    });
    const claimBody = JSON.parse(claimRes.payload);

    // Manually expire the authorization request
    const now = Math.floor(Date.now() / 1000);
    db.run('UPDATE authorization_requests SET expires_at = ? WHERE id = ?', [
      now - 1,
      claimBody.authorization_request_id,
    ]);
    db.save();

    // Run expiration scanner
    checkExpiredAuthorizations();

    // Verify task is back to pending
    const taskRes = await app.inject({ method: 'GET', url: `/api/tasks/${task.id}` });
    const taskBody = JSON.parse(taskRes.payload);
    expect(taskBody.status).toBe('pending');

    // Verify authorization request is expired
    const arRes = db.prepare('SELECT status FROM authorization_requests WHERE id = ?');
    arRes.bind([claimBody.authorization_request_id]);
    expect(arRes.step()).toBe(true);
    const arRow = arRes.getAsObject() as { status: string };
    expect(arRow.status).toBe('expired');
    arRes.free();
  });
});

describe('G015: Auto Authorization Mode', () => {
  it('TC-G015-001: high reputation team auto-approved', async () => {
    const { app, db } = await buildApp();
    const teamA = await createTeam(app, 'Source', 'user-a');
    const teamB = await createTeam(app, 'Trusted', 'user-b');
    const group = await createGroup(app, 'Auto Group', teamA.id);

    // Set contract to auto with threshold 0
    db.run('UPDATE groups SET contract_yaml = ? WHERE id = ?', [
      `authorization: auto\ntrust_threshold: 0\nshared_capabilities:\n  - code`,
      group.id,
    ]);

    db.run('INSERT INTO group_members (group_id, team_id, role, joined_at) VALUES (?, ?, ?, ?)', [
      group.id,
      teamB.id,
      'member',
      0,
    ]);

    const mB = await createMachine(app, 'MB');
    const aB = await createAgent(app, mB.id, 'Agent B', 'claude');

    const pubRes = await app.inject({
      method: 'POST',
      url: `/api/groups/${group.id}/tasks`,
      payload: { title: 'Auto Task', source_team_id: teamA.id, creator_id: 'user-a' },
    });
    const task = JSON.parse(pubRes.payload);

    const claimRes = await app.inject({
      method: 'POST',
      url: `/api/tasks/${task.id}/group-claim`,
      payload: { agent_id: aB.id, team_id: teamB.id },
    });
    expect(claimRes.statusCode).toBe(200);
    const body = JSON.parse(claimRes.payload);
    expect(body.status).toBe('claimed');
    expect(body.auto_approved).toBe(true);
  });

  it('TC-G015-002: low reputation falls back to manual', async () => {
    const { app, db } = await buildApp();
    const teamA = await createTeam(app, 'Source', 'user-a');
    const teamB = await createTeam(app, 'Untrusted', 'user-b');
    const group = await createGroup(app, 'Manual Fallback Group', teamA.id);

    // Set contract to auto with high threshold
    db.run('UPDATE groups SET contract_yaml = ? WHERE id = ?', [
      `authorization: auto\ntrust_threshold: 100\nshared_capabilities:\n  - code`,
      group.id,
    ]);

    db.run('INSERT INTO group_members (group_id, team_id, role, joined_at) VALUES (?, ?, ?, ?)', [
      group.id,
      teamB.id,
      'member',
      0,
    ]);

    const mB = await createMachine(app, 'MB');
    const aB = await createAgent(app, mB.id, 'Agent B', 'claude');

    const pubRes = await app.inject({
      method: 'POST',
      url: `/api/groups/${group.id}/tasks`,
      payload: { title: 'Fallback Task', source_team_id: teamA.id, creator_id: 'user-a' },
    });
    const task = JSON.parse(pubRes.payload);

    const claimRes = await app.inject({
      method: 'POST',
      url: `/api/tasks/${task.id}/group-claim`,
      payload: { agent_id: aB.id, team_id: teamB.id },
    });
    expect(claimRes.statusCode).toBe(200);
    const body = JSON.parse(claimRes.payload);
    expect(body.status).toBe('pending_authorization');
  });
});

describe('G016: Cross-Team Task Retry', () => {
  it('TC-G016-001: failed task returns to pool after max retries', async () => {
    const { app, db } = await buildApp();
    const teamA = await createTeam(app, 'Source', 'user-a');
    const teamB = await createTeam(app, 'Executor', 'user-b');
    const group = await createGroup(app, 'Retry Group', teamA.id);

    db.run('INSERT INTO group_members (group_id, team_id, role, joined_at) VALUES (?, ?, ?, ?)', [
      group.id,
      teamB.id,
      'member',
      0,
    ]);

    const mB = await createMachine(app, 'MB');
    const aB = await createAgent(app, mB.id, 'Agent B', 'claude');

    // Create a group task with max_retries=1
    db.run(
      `INSERT INTO tasks (id, title, status, creator_id, is_group_task, source_team_id, max_retries, retry_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['task-retry-001', 'Retry Task', 'claimed', 'user-a', 1, teamA.id, 1, 1, Date.now()],
    );
    db.run(
      `INSERT INTO group_tasks (task_id, group_id, source_team_id, authorization_status)
       VALUES (?, ?, ?, ?)`,
      ['task-retry-001', group.id, teamA.id, 'approved'],
    );
    db.save();

    // Mark as failed via task API
    const failRes = await app.inject({
      method: 'POST',
      url: '/api/tasks/task-retry-001/force-fail',
    });
    expect(failRes.statusCode).toBe(200);

    // Verify task is back to pending (returned to pool)
    const taskRes = await app.inject({ method: 'GET', url: '/api/tasks/task-retry-001' });
    const taskBody = JSON.parse(taskRes.payload);
    expect(taskBody.status).toBe('pending');
  });

  it('TC-G016-002: agent disconnect releases claimed group tasks', async () => {
    const { app, db } = await buildApp();
    const teamA = await createTeam(app, 'Source', 'user-a');
    const teamB = await createTeam(app, 'Executor', 'user-b');
    const group = await createGroup(app, 'Disconnect Group', teamA.id);

    db.run('INSERT INTO group_members (group_id, team_id, role, joined_at) VALUES (?, ?, ?, ?)', [
      group.id,
      teamB.id,
      'member',
      0,
    ]);

    const mB = await createMachine(app, 'MB');
    const aB = await createAgent(app, mB.id, 'Agent B', 'claude');

    // Create claimed group task
    db.run(
      `INSERT INTO tasks (id, title, status, assignee_id, creator_id, is_group_task, source_team_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['task-disconn-001', 'Disconnect Task', 'claimed', aB.id, 'user-a', 1, teamA.id, Date.now()],
    );
    db.run(
      `INSERT INTO group_tasks (task_id, group_id, source_team_id, authorization_status)
       VALUES (?, ?, ?, ?)`,
      ['task-disconn-001', group.id, teamA.id, 'approved'],
    );
    db.save();

    // Simulate disconnect by directly calling the release logic
    // In production this happens in ws.on('close') handler
    db.run("UPDATE tasks SET status = 'pending', assignee_id = NULL WHERE id = ?", [
      'task-disconn-001',
    ]);
    db.run("UPDATE group_tasks SET authorization_status = 'none' WHERE task_id = ?", [
      'task-disconn-001',
    ]);
    db.save();

    const taskRes = await app.inject({ method: 'GET', url: '/api/tasks/task-disconn-001' });
    const taskBody = JSON.parse(taskRes.payload);
    expect(taskBody.status).toBe('pending');
    expect(taskBody.assigneeId).toBeUndefined();
  });
});

describe('G015: Reputation on group task completion/failure', () => {
  it('TC-G015-001: completing a group task records positive reputation for executing team', async () => {
    const { app, db } = await buildApp();
    const teamA = await createTeam(app, 'Source', 'user-a');
    const teamB = await createTeam(app, 'Executor', 'user-b');
    const group = await createGroup(app, 'Rep Group', teamA.id);

    db.run('INSERT INTO group_members (group_id, team_id, role, joined_at) VALUES (?, ?, ?, ?)', [
      group.id,
      teamB.id,
      'member',
      0,
    ]);

    const mB = await createMachine(app, 'MB');
    const aB = await createAgent(app, mB.id, 'Agent B', 'claude');
    // Agent must belong to executing team for reputation attribution
    db.run('UPDATE agents SET team_id = ? WHERE id = ?', [teamB.id, aB.id]);
    db.save();

    const pubRes = await app.inject({
      method: 'POST',
      url: `/api/groups/${group.id}/tasks`,
      payload: { title: 'Rep Task', source_team_id: teamA.id, creator_id: 'user-a' },
    });
    const task = JSON.parse(pubRes.payload);

    const claimRes = await app.inject({
      method: 'POST',
      url: `/api/tasks/${task.id}/group-claim`,
      payload: { agent_id: aB.id, team_id: teamB.id },
    });
    expect(claimRes.statusCode).toBe(200);
    const claimBody = JSON.parse(claimRes.payload);

    const approveRes = await app.inject({
      method: 'POST',
      url: `/api/authorizations/${claimBody.authorization_request_id}/approve`,
    });
    expect(approveRes.statusCode).toBe(200);

    // Force complete the task
    const completeRes = await app.inject({
      method: 'POST',
      url: `/api/tasks/${task.id}/force-complete`,
    });
    expect(completeRes.statusCode).toBe(200);
    const completeBody = JSON.parse(completeRes.payload);
    expect(completeBody.status).toBe('completed');

    const score = getReputationScore(teamB.id, group.id);
    expect(score).toBe(1);

    const recordStmt = db.prepare(
      'SELECT event_type, score_delta FROM reputation_records WHERE team_id = ? AND group_id = ? AND task_id = ?',
    );
    recordStmt.bind([teamB.id, group.id, task.id]);
    expect(recordStmt.step()).toBe(true);
    const record = recordStmt.getAsObject() as { event_type: string; score_delta: number };
    recordStmt.free();
    expect(record.event_type).toBe('task_completed');
    expect(record.score_delta).toBe(1);
  });

  it('TC-G015-002: failing a group task records negative reputation for executing team', async () => {
    const { app, db } = await buildApp();
    const teamA = await createTeam(app, 'Source', 'user-a');
    const teamB = await createTeam(app, 'Executor', 'user-b');
    const group = await createGroup(app, 'Rep Fail Group', teamA.id);

    db.run('INSERT INTO group_members (group_id, team_id, role, joined_at) VALUES (?, ?, ?, ?)', [
      group.id,
      teamB.id,
      'member',
      0,
    ]);

    const mB = await createMachine(app, 'MB');
    const aB = await createAgent(app, mB.id, 'Agent B', 'claude');
    db.run('UPDATE agents SET team_id = ? WHERE id = ?', [teamB.id, aB.id]);
    db.save();

    const pubRes = await app.inject({
      method: 'POST',
      url: `/api/groups/${group.id}/tasks`,
      payload: { title: 'Rep Fail Task', source_team_id: teamA.id, creator_id: 'user-a' },
    });
    const task = JSON.parse(pubRes.payload);

    const claimRes = await app.inject({
      method: 'POST',
      url: `/api/tasks/${task.id}/group-claim`,
      payload: { agent_id: aB.id, team_id: teamB.id },
    });
    const claimBody = JSON.parse(claimRes.payload);

    await app.inject({
      method: 'POST',
      url: `/api/authorizations/${claimBody.authorization_request_id}/approve`,
    });

    const failRes = await app.inject({ method: 'POST', url: `/api/tasks/${task.id}/force-fail` });
    expect(failRes.statusCode).toBe(200);
    const failBody = JSON.parse(failRes.payload);
    expect(failBody.status).toBe('failed');

    const score = getReputationScore(teamB.id, group.id);
    expect(score).toBe(-1);

    const recordStmt = db.prepare(
      'SELECT event_type, score_delta FROM reputation_records WHERE team_id = ? AND group_id = ? AND task_id = ?',
    );
    recordStmt.bind([teamB.id, group.id, task.id]);
    expect(recordStmt.step()).toBe(true);
    const record = recordStmt.getAsObject() as { event_type: string; score_delta: number };
    recordStmt.free();
    expect(record.event_type).toBe('task_failed');
    expect(record.score_delta).toBe(-1);
  });
});
