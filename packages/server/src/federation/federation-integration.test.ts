import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildApp, createTeam, createGroup, createMachine } from '../test-helpers.js';
import { getDatabase, resetDatabase } from '../db/index.js';
import {
  registerFederationHubRoutes,
  getPeers,
  indexGroupTask,
} from './hub.js';

/** Create a mock WebSocket for peer registration. */
function createMockWs(): any {
  return {
    send: vi.fn(),
    on: vi.fn(),
    readyState: 1,
    close: vi.fn(),
  };
}

function registerMockPeer(teamId: string, groupId: string, labels: string[] = []): void {
  const peers = getPeers();
  peers.set(teamId, {
    ws: createMockWs(),
    teamId,
    groupId,
    labels,
    lastHeartbeat: Date.now(),
  });
}

describe('Federation Integration — Full Flow', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app'];

  beforeEach(async () => {
    resetDatabase();
    const built = await buildApp();
    app = built.app;
    await registerFederationHubRoutes(app);
  });

  afterEach(async () => {
    const peers = getPeers();
    for (const [teamId] of peers) {
      peers.delete(teamId);
    }
    await app.close();
  });

  it('F010: publish group task → index → poll → claim flow', async () => {
    // --- Step 1: Create Team A (owner), Team B (member) ---
    const teamA = await createTeam(app, 'Team A', 'user-a');
    const teamB = await createTeam(app, 'Team B', 'user-b');

    // --- Step 2: Create group and invite code ---
    const group = await createGroup(app, 'Fed Group', teamA.id);

    const inviteRes = await app.inject({
      method: 'POST',
      url: `/api/groups/${group.id}/invite`,
      payload: { max_uses: 10, expires_in_hours: 24 },
    });
    expect(inviteRes.statusCode).toBe(200);
    const { invite_code: inviteCode } = JSON.parse(inviteRes.payload);

    // --- Step 3: Team B joins group ---
    const joinRes = await app.inject({
      method: 'POST',
      url: '/api/groups/join',
      payload: { invite_code: inviteCode, team_id: teamB.id },
    });
    expect(joinRes.statusCode).toBe(200);

    // --- Step 4: Update group contract to include python ---
    const contractRes = await app.inject({
      method: 'PATCH',
      url: `/api/groups/${group.id}/contract`,
      payload: {
        contract: {
          shared_capabilities: ['code', 'review', 'test', 'python'],
          authorization: 'manual',
          trust_threshold: 0.5,
        },
      },
    });
    expect(contractRes.statusCode).toBe(200);

    // --- Step 5: Publish group task with required capabilities ---
    const taskRes = await app.inject({
      method: 'POST',
      url: `/api/groups/${group.id}/tasks`,
      payload: {
        title: 'Review PR #42',
        source_team_id: teamA.id,
        creator_id: 'user-a',
        required_capabilities: ['python', 'review'],
      },
    });
    expect(taskRes.statusCode).toBe(201);
    const task = JSON.parse(taskRes.payload);
    expect(task.id).toBeDefined();
    expect(task.status).toBe('pending');

    // Verify task is indexed in federation_task_index
    const db = getDatabase();
    const idxStmt = db.prepare('SELECT * FROM federation_task_index WHERE task_id = ?');
    idxStmt.bind([task.id]);
    expect(idxStmt.step()).toBe(true);
    const idxRow = idxStmt.getAsObject() as { status: string; required_labels: string };
    expect(idxRow.status).toBe('open');
    expect(JSON.parse(idxRow.required_labels)).toEqual(['python', 'review']);
    idxStmt.free();

    // --- Step 6: Register Team B as a peer (simulating Runner connection) ---
    registerMockPeer(teamB.id, group.id, ['python', 'review', 'linux']);

    // --- Step 7: Poll with matching labels ---
    const pollRes = await app.inject({
      method: 'GET',
      url: `/api/federation/poll?team_id=${teamB.id}&labels=python,review,linux`,
    });
    expect(pollRes.statusCode).toBe(200);
    const pollBody = JSON.parse(pollRes.payload);
    expect(pollBody.tasks.length).toBe(1);
    expect(pollBody.tasks[0].taskId).toBe(task.id);
    expect(pollBody.tasks[0].title).toBe('Review PR #42');
    expect(pollBody.tasks[0].requiredLabels).toEqual(['python', 'review']);

    // --- Step 8: Poll with non-matching labels ---
    const pollNoMatchRes = await app.inject({
      method: 'GET',
      url: `/api/federation/poll?team_id=${teamB.id}&labels=java,go`,
    });
    expect(pollNoMatchRes.statusCode).toBe(200);
    const pollNoMatchBody = JSON.parse(pollNoMatchRes.payload);
    expect(pollNoMatchBody.tasks.length).toBe(0);

    // --- Step 9: Claim task ---
    const machine = await createMachine(app, 'Runner-Machine');
    const agentRes = await app.inject({
      method: 'POST',
      url: '/api/agents',
      payload: {
        machineId: machine.id,
        name: 'CodeReviewer-B',
        runtime: 'claude',
        capabilities: ['code_review'],
        labels: ['python', 'review', 'linux'],
      },
    });
    expect(agentRes.statusCode).toBe(201);
    const agent = JSON.parse(agentRes.payload);

    const claimRes = await app.inject({
      method: 'POST',
      url: '/api/federation/claim',
      payload: {
        task_id: task.id,
        agent_id: agent.id,
        team_id: teamB.id,
      },
    });
    expect(claimRes.statusCode).toBe(200);
    const claimBody = JSON.parse(claimRes.payload);
    expect(claimBody.status).toBe('pending_authorization');
  });

  it('poll returns empty when runner has no peer registration', async () => {
    const teamA = await createTeam(app, 'Team A', 'user-a');
    const group = await createGroup(app, 'Fed Group', teamA.id);

    const taskRes = await app.inject({
      method: 'POST',
      url: `/api/groups/${group.id}/tasks`,
      payload: {
        title: 'Test Task',
        source_team_id: teamA.id,
        creator_id: 'user-a',
        required_capabilities: [],
      },
    });
    expect(taskRes.statusCode).toBe(201);
    const task = JSON.parse(taskRes.payload);

    // Do NOT register mock peer
    const pollRes = await app.inject({
      method: 'GET',
      url: `/api/federation/poll?team_id=unregistered-team`,
    });
    expect(pollRes.statusCode).toBe(403);
  });

  it('discover mode: runner with empty labels sees all tasks', async () => {
    const teamA = await createTeam(app, 'Team A', 'user-a');
    const teamB = await createTeam(app, 'Team B', 'user-b');
    const group = await createGroup(app, 'Fed Group', teamA.id);

    // Team B joins
    const inviteRes = await app.inject({
      method: 'POST',
      url: `/api/groups/${group.id}/invite`,
      payload: { max_uses: 10, expires_in_hours: 24 },
    });
    const { invite_code: inviteCode } = JSON.parse(inviteRes.payload);
    await app.inject({
      method: 'POST',
      url: '/api/groups/join',
      payload: { invite_code: inviteCode, team_id: teamB.id },
    });

    // Publish task with labels
    const taskRes = await app.inject({
      method: 'POST',
      url: `/api/groups/${group.id}/tasks`,
      payload: {
        title: 'Labelled Task',
        source_team_id: teamA.id,
        creator_id: 'user-a',
        required_capabilities: ['code'],
      },
    });
    expect(taskRes.statusCode).toBe(201);
    const task = JSON.parse(taskRes.payload);

    // Register peer with NO labels
    registerMockPeer(teamB.id, group.id, []);

    // Poll without labels parameter
    const pollRes = await app.inject({
      method: 'GET',
      url: `/api/federation/poll?team_id=${teamB.id}`,
    });
    expect(pollRes.statusCode).toBe(200);
    const pollBody = JSON.parse(pollRes.payload);
    expect(pollBody.tasks.length).toBe(1);
    expect(pollBody.tasks[0].taskId).toBe(task.id);
  });
});
