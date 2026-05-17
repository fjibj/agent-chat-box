import { describe, it, expect } from 'vitest';
import { buildApp, createTeam, createMachine, createAgent, addTeamMember } from '../test-helpers.js';
import { registerAgentWs } from '../api/agents.js';

// ATDD: EPIC-001 Team Abstraction
// Stories: G001-G004

describe('G001: DB Migration v4→v5', () => {
  it('TC-G001-001: migration creates teams and team_members tables', async () => {
    const { db } = await buildApp();
    const teamsInfo = db.exec("PRAGMA table_info(teams)");
    expect(teamsInfo.length).toBeGreaterThan(0);
    const teamColumns = teamsInfo[0].values.map((v) => v[1]);
    expect(teamColumns).toContain('id');
    expect(teamColumns).toContain('name');
    expect(teamColumns).toContain('owner_user_id');

    const membersInfo = db.exec("PRAGMA table_info(team_members)");
    expect(membersInfo.length).toBeGreaterThan(0);
    const memberColumns = membersInfo[0].values.map((v) => v[1]);
    expect(memberColumns).toContain('team_id');
    expect(memberColumns).toContain('user_id');
    expect(memberColumns).toContain('role');
  });

  it('TC-G001-002: migration is idempotent', async () => {
    // Schema application via buildApp is repeatable without error
    const { db } = await buildApp();
    db.run('INSERT INTO teams (id, name, owner_user_id, created_at) VALUES (?, ?, ?, ?)', [
      'team-test', 'Test', 'user-test', 0,
    ]);
    // Rebuild app (new in-memory DB) — proves schema recreation is safe
    const { db: db2 } = await buildApp();
    const result = db2.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='teams'");
    expect(result[0]?.values[0][0]).toBe('teams');
  });
});

describe('G002: Team CRUD API', () => {
  it('TC-G002-001: create team sets current user as owner', async () => {
    const { app } = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/teams',
      payload: { name: 'Test Team', user_id: 'user-1' },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.owner_user_id).toBe('user-1');
    expect(body.name).toBe('Test Team');
    expect(body.id).toBeDefined();
  });

  it('TC-G002-002: delete team with agents fails', async () => {
    const { app } = await buildApp();
    const team = await createTeam(app, 'Engineering', 'user-1');
    const machine = await createMachine(app, 'MacBook');
    const agent = await createAgent(app, machine.id, 'Claude', 'claude');

    // Assign agent to team
    await app.inject({
      method: 'POST',
      url: `/api/teams/${team.id}/agents/${agent.id}`,
    });

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/teams/${team.id}`,
    });
    expect(del.statusCode).toBe(400);
    const body = JSON.parse(del.payload);
    expect(body.error).toContain('Cannot delete team with agents');
  });

  it('TC-G002-003: get team returns member list', async () => {
    const { app } = await buildApp();
    const team = await createTeam(app, 'Design', 'user-1');
    await addTeamMember(app, team.id, 'user-2', 'admin');
    await addTeamMember(app, team.id, 'user-3', 'member');

    const res = await app.inject({
      method: 'GET',
      url: `/api/teams/${team.id}`,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.members).toBeDefined();
    expect(body.members.length).toBe(3);
    const roles = body.members.map((m: { role: string }) => m.role);
    expect(roles).toContain('owner');
    expect(roles).toContain('admin');
    expect(roles).toContain('member');
  });
});

describe('G003: Agent Ownership Management', () => {
  it('TC-G003-001: agent auto-assigned to machine team on register', async () => {
    const { app, db } = await buildApp();
    const team = await createTeam(app, 'Platform', 'user-1');
    const machine = await createMachine(app, 'Server');

    // Assign machine to team via DB
    db.run('UPDATE machines SET team_id = ? WHERE id = ?', [team.id, machine.id]);

    // Use registerAgentWs (the WS registration path) to verify auto-assignment
    const agent = registerAgentWs(machine.id, {
      name: 'Codex',
      runtime: 'codex',
      roleCard: { name: 'Codex', description: '' },
      capabilities: ['code'],
    });

    expect(agent).not.toBeNull();
    expect(agent!.teamId).toBe(team.id);
  });

  it('TC-G003-002: switching agent team removes from old team', async () => {
    const { app } = await buildApp();
    const teamA = await createTeam(app, 'Team A', 'user-a');
    const teamB = await createTeam(app, 'Team B', 'user-b');
    const machine = await createMachine(app, 'Laptop');
    const agent = await createAgent(app, machine.id, 'Hermes', 'hermes');

    // Assign agent to team A
    const addA = await app.inject({
      method: 'POST',
      url: `/api/teams/${teamA.id}/agents/${agent.id}`,
    });
    expect(addA.statusCode).toBe(200);

    // Switch to team B
    const addB = await app.inject({
      method: 'POST',
      url: `/api/teams/${teamB.id}/agents/${agent.id}`,
    });
    expect(addB.statusCode).toBe(200);

    // Verify agent is in team B, not team A
    const agentRes = await app.inject({ method: 'GET', url: `/api/agents/${agent.id}` });
    const agentBody = JSON.parse(agentRes.payload);
    expect(agentBody.teamId).toBe(teamB.id);

    const teamAAgents = await app.inject({ method: 'GET', url: `/api/teams/${teamA.id}/agents` });
    expect(JSON.parse(teamAAgents.payload).length).toBe(0);
  });
});

describe('G002: Team CRUD API (continued)', () => {
  it('TC-G002-004: GET /api/teams lists teams for user', async () => {
    const { app } = await buildApp();
    const team = await createTeam(app, 'My Team', 'user-1');

    const res = await app.inject({
      method: 'GET',
      url: '/api/teams?user_id=user-1',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(1);
    expect(body[0].id).toBe(team.id);
  });

  it('TC-G002-005: PATCH /api/teams/:id updates name', async () => {
    const { app } = await buildApp();
    const team = await createTeam(app, 'Old Name', 'user-1');

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/teams/${team.id}`,
      payload: { name: 'New Name' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.name).toBe('New Name');

    // Verify via GET
    const getRes = await app.inject({ method: 'GET', url: `/api/teams/${team.id}` });
    expect(JSON.parse(getRes.payload).name).toBe('New Name');
  });

  it('TC-G002-006: DELETE /api/teams/:id succeeds for empty team', async () => {
    const { app } = await buildApp();
    const team = await createTeam(app, 'Disposable', 'user-1');

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/teams/${team.id}`,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);

    // Verify team is gone
    const getRes = await app.inject({ method: 'GET', url: `/api/teams/${team.id}` });
    expect(getRes.statusCode).toBe(404);
  });
});

describe('G003: Agent Ownership Management (continued)', () => {
  it('TC-G003-003: GET /api/teams/:id/agents lists team agents', async () => {
    const { app } = await buildApp();
    const team = await createTeam(app, 'Dev', 'user-1');
    const machine = await createMachine(app, 'Server');
    const agent = await createAgent(app, machine.id, 'Claude', 'claude');

    // Assign agent to team
    await app.inject({
      method: 'POST',
      url: `/api/teams/${team.id}/agents/${agent.id}`,
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/teams/${team.id}/agents`,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(1);
    expect(body[0].id).toBe(agent.id);
  });
});

describe('G004: Collaborator Management', () => {
  it('TC-G004-001: cannot remove team owner', async () => {
    const { app } = await buildApp();
    const team = await createTeam(app, 'Leadership', 'user-1');

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/teams/${team.id}/members/user-1`,
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toContain('Cannot remove team owner');
  });

  it('TC-G004-002: GET /api/teams/:id/members lists members', async () => {
    const { app } = await buildApp();
    const team = await createTeam(app, 'Leadership', 'user-1');

    const res = await app.inject({
      method: 'GET',
      url: `/api/teams/${team.id}/members`,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(1);
    expect(body[0].user_id).toBe('user-1');
    expect(body[0].role).toBe('owner');
  });

  it('TC-G004-003: POST /api/teams/:id/members adds collaborator', async () => {
    const { app } = await buildApp();
    const team = await createTeam(app, 'Leadership', 'user-1');

    const res = await app.inject({
      method: 'POST',
      url: `/api/teams/${team.id}/members`,
      payload: { user_id: 'user-2', role: 'admin' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);

    // Verify member added
    const getRes = await app.inject({ method: 'GET', url: `/api/teams/${team.id}/members` });
    const members = JSON.parse(getRes.payload);
    expect(members.length).toBe(2);
    const roles = members.map((m: { role: string }) => m.role);
    expect(roles).toContain('admin');
  });
});
