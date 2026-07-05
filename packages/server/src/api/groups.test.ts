import { describe, it, expect } from 'vitest';
import { buildApp, createTeam, createGroup } from '../test-helpers.js';

// ATDD: EPIC-002 Group Contract & Members
// Stories: G005-G009

describe('G005: DB Migration v5→v6', () => {
  it('TC-G005-001: migration creates groups and group_members tables', async () => {
    const { db } = await buildApp();
    const groupsInfo = db.exec("PRAGMA table_info(groups)");
    expect(groupsInfo.length).toBeGreaterThan(0);
    const groupColumns = groupsInfo[0].values.map((v) => v[1]);
    expect(groupColumns).toContain('id');
    expect(groupColumns).toContain('name');
    expect(groupColumns).toContain('contract_yaml');
    expect(groupColumns).toContain('owner_team_id');

    const membersInfo = db.exec("PRAGMA table_info(group_members)");
    expect(membersInfo.length).toBeGreaterThan(0);
    const memberColumns = membersInfo[0].values.map((v) => v[1]);
    expect(memberColumns).toContain('group_id');
    expect(memberColumns).toContain('team_id');
    expect(memberColumns).toContain('role');
  });
});

describe('G006: Group CRUD API', () => {
  it('TC-G006-001: create group auto-adds owner team as member', async () => {
    const { app } = await buildApp();
    const team = await createTeam(app, 'Alpha', 'user-1');

    const res = await app.inject({
      method: 'POST',
      url: '/api/groups',
      payload: { name: 'Engineering Guild', owner_team_id: team.id },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.owner_team_id).toBe(team.id);

    // Verify owner team is in members
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/groups/${body.id}`,
    });
    const group = JSON.parse(getRes.payload);
    const memberTeamIds = group.members.map((m: { team_id: string }) => m.team_id);
    expect(memberTeamIds).toContain(team.id);
    const ownerMember = group.members.find((m: { team_id: string; role: string }) => m.team_id === team.id);
    expect(ownerMember.role).toBe('owner');
  });
});

describe('G007: Group Contract Config', () => {
  it('TC-G007-001: reject invalid authorization value', async () => {
    const { app } = await buildApp();
    const team = await createTeam(app, 'Beta', 'user-1');
    const group = await createGroup(app, 'Contract Test', team.id);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/groups/${group.id}/contract`,
      payload: { contract: { authorization: 'hybrid' } },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toContain('authorization must be auto or manual');
  });

  it('TC-G007-002: reject trust_threshold out of range', async () => {
    const { app } = await buildApp();
    const team = await createTeam(app, 'Gamma', 'user-1');
    const group = await createGroup(app, 'Trust Test', team.id);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/groups/${group.id}/contract`,
      payload: { contract: { trust_threshold: 1.5 } },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toContain('trust_threshold must be between 0 and 1');
  });
});

describe('G008: Invite Codes & Join Group', () => {
  it('TC-G008-001: expired invite code rejected', async () => {
    const { app, db } = await buildApp();
    const team = await createTeam(app, 'Delta', 'user-1');
    const group = await createGroup(app, 'Secret Society', team.id);

    // Generate invite code that expired 1 hour ago
    const now = Math.floor(Date.now() / 1000);
    db.run(
      'UPDATE groups SET invite_code = ?, invite_code_expires_at = ?, invite_code_max_uses = ?, invite_code_uses = 0 WHERE id = ?',
      ['EXPIRED1', now - 3600, null, group.id]
    );

    const otherTeam = await createTeam(app, 'Epsilon', 'user-2');
    const res = await app.inject({
      method: 'POST',
      url: '/api/groups/join',
      payload: { invite_code: 'EXPIRED1', team_id: otherTeam.id },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toContain('expired');
  });

  it('TC-G008-002: max uses invite code rejected after limit', async () => {
    const { app, db } = await buildApp();
    const team = await createTeam(app, 'Zeta', 'user-1');
    const group = await createGroup(app, 'Limited Club', team.id);

    const now = Math.floor(Date.now() / 1000);
    db.run(
      'UPDATE groups SET invite_code = ?, invite_code_expires_at = ?, invite_code_max_uses = ?, invite_code_uses = ? WHERE id = ?',
      ['LIMITED1', now + 3600, 1, 1, group.id]
    );

    const otherTeam = await createTeam(app, 'Eta', 'user-2');
    const res = await app.inject({
      method: 'POST',
      url: '/api/groups/join',
      payload: { invite_code: 'LIMITED1', team_id: otherTeam.id },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toContain('maximum uses');
  });
});

describe('G006: Group CRUD API (continued)', () => {
  it('TC-G006-002: GET /api/groups lists groups for a team', async () => {
    const { app } = await buildApp();
    const team = await createTeam(app, 'Alpha', 'user-1');
    const group = await createGroup(app, 'Guild', team.id);

    const res = await app.inject({
      method: 'GET',
      url: `/api/groups?team_id=${team.id}`,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(1);
    expect(body[0].id).toBe(group.id);
  });

  it('TC-G006-003: PATCH /api/groups/:id updates name and description', async () => {
    const { app } = await buildApp();
    const team = await createTeam(app, 'Alpha', 'user-1');
    const group = await createGroup(app, 'Old Name', team.id, 'old desc');

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/groups/${group.id}`,
      payload: { name: 'New Name', description: 'new desc' },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).success).toBe(true);

    // Verify via GET
    const getRes = await app.inject({ method: 'GET', url: `/api/groups/${group.id}` });
    const body = JSON.parse(getRes.payload);
    expect(body.name).toBe('New Name');
    expect(body.description).toBe('new desc');
  });
});

describe('G008: Invite Codes & Join Group (continued)', () => {
  it('TC-G008-003: POST /api/groups/:id/invite generates invite code', async () => {
    const { app } = await buildApp();
    const team = await createTeam(app, 'Host', 'user-1');
    const group = await createGroup(app, 'Invite Group', team.id);

    const res = await app.inject({
      method: 'POST',
      url: `/api/groups/${group.id}/invite`,
      payload: { max_uses: 5, expires_in_hours: 48 },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.invite_code).toBeDefined();
    expect(body.invite_code.length).toBe(8);
    expect(body.max_uses).toBe(5);
    expect(body.expires_at).toBeDefined();
  });

  it('TC-G008-004: POST /api/groups/join succeeds with valid invite code', async () => {
    const { app, db } = await buildApp();
    const teamA = await createTeam(app, 'Team A', 'user-a');
    const teamB = await createTeam(app, 'Team B', 'user-b');
    const group = await createGroup(app, 'Open Group', teamA.id);

    // Generate invite code directly
    const now = Math.floor(Date.now() / 1000);
    db.run(
      'UPDATE groups SET invite_code = ?, invite_code_expires_at = ?, invite_code_max_uses = ?, invite_code_uses = 0 WHERE id = ?',
      ['VALID001', now + 3600, 5, group.id]
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/groups/join',
      payload: { invite_code: 'VALID001', team_id: teamB.id },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.group_id).toBe(group.id);

    // Verify team B is now a member
    const getRes = await app.inject({ method: 'GET', url: `/api/groups/${group.id}` });
    const grp = JSON.parse(getRes.payload);
    const memberIds = grp.members.map((m: { team_id: string }) => m.team_id);
    expect(memberIds).toContain(teamB.id);
  });

  it('TC-G008-005: duplicate join is rejected', async () => {
    const { app, db } = await buildApp();
    const teamA = await createTeam(app, 'Team A', 'user-a');
    const teamB = await createTeam(app, 'Team B', 'user-b');
    const group = await createGroup(app, 'Closed Group', teamA.id);

    const now = Math.floor(Date.now() / 1000);
    db.run(
      'UPDATE groups SET invite_code = ?, invite_code_expires_at = ?, invite_code_max_uses = ?, invite_code_uses = 0 WHERE id = ?',
      ['DUP001', now + 3600, 5, group.id]
    );

    // First join
    await app.inject({
      method: 'POST',
      url: '/api/groups/join',
      payload: { invite_code: 'DUP001', team_id: teamB.id },
    });

    // Second join attempt
    const res = await app.inject({
      method: 'POST',
      url: '/api/groups/join',
      payload: { invite_code: 'DUP001', team_id: teamB.id },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toContain('already in this group');
  });
});

describe('G009: Leave Group', () => {
  it('TC-G009-001: leaving resets pending tasks to pool', async () => {
    const { app, db } = await buildApp();
    const teamA = await createTeam(app, 'Team A', 'user-a');
    const teamB = await createTeam(app, 'Team B', 'user-b');
    const group = await createGroup(app, 'Collaboration', teamA.id);

    // Add team B to group
    db.run('INSERT INTO group_members (group_id, team_id, role, joined_at) VALUES (?, ?, ?, ?)', [
      group.id, teamB.id, 'member', Math.floor(Date.now() / 1000),
    ]);

    // Create a pending group task claimed by team B
    const taskId = 'task-test-001';
    db.run(
      `INSERT INTO tasks (id, title, status, creator_id, is_group_task, source_team_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [taskId, 'Test Task', 'pending', 'user-a', 1, teamA.id, Date.now()]
    );
    db.run(
      `INSERT INTO group_tasks (task_id, group_id, source_team_id, authorization_status)
       VALUES (?, ?, ?, ?)`,
      [taskId, group.id, teamA.id, 'none']
    );

    // Team B leaves
    const leaveRes = await app.inject({
      method: 'POST',
      url: `/api/groups/${group.id}/leave`,
      payload: { team_id: teamB.id },
    });
    expect(leaveRes.statusCode).toBe(200);

    // Verify team B is removed
    const getRes = await app.inject({ method: 'GET', url: `/api/groups/${group.id}` });
    const grp = JSON.parse(getRes.payload);
    const memberIds = grp.members.map((m: { team_id: string }) => m.team_id);
    expect(memberIds).not.toContain(teamB.id);
  });

  it('TC-G009-002 (GAP-13): leaving resets claimed tasks and expires pending auth requests', async () => {
    const { app, db } = await buildApp();
    const teamA = await createTeam(app, 'Team A', 'user-a');
    const teamB = await createTeam(app, 'Team B', 'user-b');
    const group = await createGroup(app, 'Collaboration', teamA.id);

    // Add team B to group
    db.run('INSERT INTO group_members (group_id, team_id, role, joined_at) VALUES (?, ?, ?, ?)', [
      group.id, teamB.id, 'member', Math.floor(Date.now() / 1000),
    ]);

    // Register an agent for team B
    const agentId = 'agent-b-001';
    db.run(
      `INSERT INTO agents (id, name, runtime, team_id, status, labels)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [agentId, 'Agent B', 'claude', teamB.id, 'awake', '[]']
    );

    // Create a claimed group task assigned to team B's agent
    const taskId = 'task-claimed-001';
    db.run(
      `INSERT INTO tasks (id, title, status, assignee_id, creator_id, is_group_task, source_team_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [taskId, 'Claimed Task', 'claimed', agentId, 'user-a', 1, teamA.id, Date.now()]
    );
    db.run(
      `INSERT INTO group_tasks (task_id, group_id, source_team_id, authorization_status)
       VALUES (?, ?, ?, ?)`,
      [taskId, group.id, teamA.id, 'approved']
    );

    // Create a pending authorization request from team B
    const authId = 'auth-001';
    const now = Math.floor(Date.now() / 1000);
    db.run(
      `INSERT INTO authorization_requests (id, group_task_id, requesting_team_id, requesting_agent_id, status, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [authId, taskId, teamB.id, agentId, 'pending', now, now + 300]
    );
    db.run("UPDATE group_tasks SET authorization_status = 'pending' WHERE task_id = ?", [taskId]);
    db.run("UPDATE tasks SET status = 'pending_authorization' WHERE id = ?", [taskId]);

    // Team B leaves
    const leaveRes = await app.inject({
      method: 'POST',
      url: `/api/groups/${group.id}/leave`,
      payload: { team_id: teamB.id },
    });
    expect(leaveRes.statusCode).toBe(200);

    // Verify task is back in pending pool
    const taskStmt = db.prepare('SELECT status, assignee_id FROM tasks WHERE id = ?');
    taskStmt.bind([taskId]);
    taskStmt.step();
    const taskRow = taskStmt.getAsObject() as { status: string; assignee_id: string | null };
    taskStmt.free();
    expect(taskRow.status).toBe('pending');
    expect(taskRow.assignee_id).toBeNull();

    // Verify auth request is expired
    const authStmt = db.prepare('SELECT status FROM authorization_requests WHERE id = ?');
    authStmt.bind([authId]);
    authStmt.step();
    const authRow = authStmt.getAsObject() as { status: string };
    authStmt.free();
    expect(authRow.status).toBe('expired');
  });
});
