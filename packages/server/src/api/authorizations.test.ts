import { describe, it, expect } from 'vitest';
import { buildApp, createTeam, createMachine, createAgent, createGroup } from '../test-helpers.js';

// ATDD: G014 Manual Authorization
// Additional auth-specific tests

describe('Authorization API', () => {
  it('TC-G014-004: list pending authorizations for team', async () => {
    const { app, db } = await buildApp();
    const teamA = await createTeam(app, 'Source', 'user-a');
    const teamB = await createTeam(app, 'Claimer', 'user-b');
    const group = await createGroup(app, 'List Group', teamA.id);

    db.run('INSERT INTO group_members (group_id, team_id, role, joined_at) VALUES (?, ?, ?, ?)', [group.id, teamB.id, 'member', 0]);

    const mB = await createMachine(app, 'MB');
    const aB = await createAgent(app, mB.id, 'Agent B', 'claude');

    // Publish and claim a task to create an authorization request
    const pubRes = await app.inject({
      method: 'POST',
      url: `/api/groups/${group.id}/tasks`,
      payload: { title: 'List Auth Task', source_team_id: teamA.id, creator_id: 'user-a' },
    });
    const task = JSON.parse(pubRes.payload);

    await app.inject({
      method: 'POST',
      url: `/api/tasks/${task.id}/group-claim`,
      payload: { agent_id: aB.id, team_id: teamB.id },
    });

    // List pending authorizations for source team
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/authorizations/pending?team_id=${teamA.id}`,
    });
    expect(listRes.statusCode).toBe(200);
    const body = JSON.parse(listRes.payload);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0].source_team_id).toBe(teamA.id);
  });

  it('TC-G014-005: approve already-resolved request fails', async () => {
    const { app, db } = await buildApp();
    const teamA = await createTeam(app, 'Source', 'user-a');
    const teamB = await createTeam(app, 'Claimer', 'user-b');
    const group = await createGroup(app, 'Double Group', teamA.id);

    db.run('INSERT INTO group_members (group_id, team_id, role, joined_at) VALUES (?, ?, ?, ?)', [group.id, teamB.id, 'member', 0]);

    const mB = await createMachine(app, 'MB');
    const aB = await createAgent(app, mB.id, 'Agent B', 'claude');

    const pubRes = await app.inject({
      method: 'POST',
      url: `/api/groups/${group.id}/tasks`,
      payload: { title: 'Double Auth Task', source_team_id: teamA.id, creator_id: 'user-a' },
    });
    const task = JSON.parse(pubRes.payload);

    const claimRes = await app.inject({
      method: 'POST',
      url: `/api/tasks/${task.id}/group-claim`,
      payload: { agent_id: aB.id, team_id: teamB.id },
    });
    const claimBody = JSON.parse(claimRes.payload);

    // First approve
    const first = await app.inject({
      method: 'POST',
      url: `/api/authorizations/${claimBody.authorization_request_id}/approve`,
    });
    expect(first.statusCode).toBe(200);

    // Second approve should fail
    const second = await app.inject({
      method: 'POST',
      url: `/api/authorizations/${claimBody.authorization_request_id}/approve`,
    });
    expect(second.statusCode).toBe(400);
    const body = JSON.parse(second.payload);
    expect(body.error).toContain('already');
  });
});
