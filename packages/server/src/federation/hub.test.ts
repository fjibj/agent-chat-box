import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { buildApp, createTeam, createGroup } from '../test-helpers.js';
import { getDatabase, setDatabase, resetDatabase } from '../db/index.js';
import {
  registerFederationHubRoutes,
  getPeers,
  startHubHeartbeat,
  stopHubHeartbeat,
  indexGroupTask,
  handleFederationConnection,
} from './hub.js';
import { buildFedMsg } from './protocol.js';

/** Create a mock WebSocket for peer registration. */
function createMockWs(): any {
  return {
    send: vi.fn(),
    on: vi.fn(),
    readyState: 1, // OPEN
    close: vi.fn(),
  };
}

/** Manually register a peer in the hub's peer map for testing HTTP routes. */
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

describe('Federation Hub', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app'];
  let db: Awaited<ReturnType<typeof buildApp>>['db'];

  beforeEach(async () => {
    resetDatabase();
    const built = await buildApp();
    app = built.app;
    db = built.db;
    await registerFederationHubRoutes(app);
  });

  afterEach(async () => {
    // Clean up peers
    const peers = getPeers();
    for (const [teamId] of peers) {
      peers.delete(teamId);
    }
    stopHubHeartbeat();
    await app.close();
  });

  describe('GET /api/federation/poll', () => {
    it('returns 400 when team_id is missing', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/federation/poll',
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.error).toContain('team_id is required');
    });

    it('returns 403 when team is not registered', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/federation/poll?team_id=unregistered-team',
      });
      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.payload);
      expect(body.error).toContain('not registered');
    });

    it('returns empty tasks when no indexed tasks exist', async () => {
      const teamA = await createTeam(app, 'Team A', 'user-a');
      const group = await createGroup(app, 'Test Group', teamA.id);
      registerMockPeer(teamA.id, group.id, ['python']);

      const res = await app.inject({
        method: 'GET',
        url: `/api/federation/poll?team_id=${teamA.id}&labels=python`,
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.tasks).toEqual([]);
    });

    it('returns matching tasks by label subset', async () => {
      const teamA = await createTeam(app, 'Team A', 'user-a');
      const teamB = await createTeam(app, 'Team B', 'user-b');
      const group = await createGroup(app, 'Test Group', teamA.id);

      // Register team B as a peer
      registerMockPeer(teamB.id, group.id, ['python', 'review']);

      // Index a task with required labels
      const taskId = 'task-' + Date.now();
      indexGroupTask(taskId, group.id, teamA.id, ['python', 'review']);

      const res = await app.inject({
        method: 'GET',
        url: `/api/federation/poll?team_id=${teamB.id}&labels=python,review,linux`,
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.tasks.length).toBe(1);
      expect(body.tasks[0].taskId).toBe(taskId);
      expect(body.tasks[0].requiredLabels).toEqual(['python', 'review']);
      expect(body.tasks[0].sourceTeamId).toBe(teamA.id);
    });

    it('filters tasks when agent labels do not match required labels', async () => {
      const teamA = await createTeam(app, 'Team A', 'user-a');
      const teamB = await createTeam(app, 'Team B', 'user-b');
      const group = await createGroup(app, 'Test Group', teamA.id);

      registerMockPeer(teamB.id, group.id, ['java', 'go']);

      const taskId = 'task-' + Date.now();
      indexGroupTask(taskId, group.id, teamA.id, ['python', 'review']);

      const res = await app.inject({
        method: 'GET',
        url: `/api/federation/poll?team_id=${teamB.id}&labels=java,go`,
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.tasks.length).toBe(0);
    });

    it('shows all tasks when runner has no agent labels (discovery mode)', async () => {
      const teamA = await createTeam(app, 'Team A', 'user-a');
      const teamB = await createTeam(app, 'Team B', 'user-b');
      const group = await createGroup(app, 'Test Group', teamA.id);

      registerMockPeer(teamB.id, group.id, []);

      const taskId = 'task-' + Date.now();
      indexGroupTask(taskId, group.id, teamA.id, ['python']);

      const res = await app.inject({
        method: 'GET',
        url: `/api/federation/poll?team_id=${teamB.id}`,
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.tasks.length).toBe(1);
    });

    it('shows tasks with empty required_labels regardless of agent labels', async () => {
      const teamA = await createTeam(app, 'Team A', 'user-a');
      const teamB = await createTeam(app, 'Team B', 'user-b');
      const group = await createGroup(app, 'Test Group', teamA.id);

      registerMockPeer(teamB.id, group.id, ['java']);

      const taskId = 'task-' + Date.now();
      indexGroupTask(taskId, group.id, teamA.id, []);

      const res = await app.inject({
        method: 'GET',
        url: `/api/federation/poll?team_id=${teamB.id}&labels=java`,
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.tasks.length).toBe(1);
    });
  });

  describe('POST /api/federation/claim', () => {
    it('returns 400 when required fields are missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/federation/claim',
        payload: {},
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.error).toContain('task_id, agent_id, and team_id are required');
    });

    it('returns pending_authorization status', async () => {
      const teamA = await createTeam(app, 'Source', 'user-a');
      const teamB = await createTeam(app, 'Runner', 'user-b');
      const group = await createGroup(app, 'Federation Claim Group', teamA.id);
      db.run('INSERT INTO group_members (group_id, team_id, role, joined_at) VALUES (?, ?, ?, ?)', [group.id, teamB.id, 'member', 0]);
      db.run(
        `INSERT INTO tasks (id, title, priority, mode, status, creator_id, is_group_task, source_team_id, created_at, timeout_seconds, max_retries, retry_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['task-123', 'Federated task', 'normal', 'compete', 'pending', 'user-a', 1, teamA.id, 1000, 3600, 0, 0],
      );
      db.run(
        'INSERT INTO group_tasks (task_id, group_id, source_team_id, authorization_status, created_at) VALUES (?, ?, ?, ?, ?)',
        ['task-123', group.id, teamA.id, 'none', 1000],
      );
      db.save();
      indexGroupTask('task-123', group.id, teamA.id, []);

      const res = await app.inject({
        method: 'POST',
        url: '/api/federation/claim',
        payload: {
          task_id: 'task-123',
          agent_id: 'agent-456',
          team_id: teamB.id,
        },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.status).toBe('pending_authorization');

      registerMockPeer(teamB.id, group.id);
      const pollRes = await app.inject({ method: 'GET', url: `/api/federation/poll?team_id=${teamB.id}` });
      expect(JSON.parse(pollRes.payload).tasks).toHaveLength(0);
    });
  });

  describe('Hub heartbeat', () => {
    it('starts and stops without error', () => {
      startHubHeartbeat();
      stopHubHeartbeat();
    });

    it('disconnects peers with expired heartbeat', () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      const teamA = { id: 'team-a' };
      const ws = createMockWs();
      const peers = getPeers();
      peers.set(teamA.id, {
        ws,
        teamId: teamA.id,
        groupId: 'group-1',
        labels: [],
        lastHeartbeat: Date.now() - 200000, // 200s ago, exceeds 120s timeout
      });

      startHubHeartbeat();
      vi.advanceTimersByTime(35000);
      expect(peers.has(teamA.id)).toBe(false);

      vi.useRealTimers();
      stopHubHeartbeat();
    });
  });

  describe('Peer broadcasts', () => {
    it('broadcasts federation.member.joined to existing peers on new registration', async () => {
      const teamA = await createTeam(app, 'Team A', 'user-a');
      const teamB = await createTeam(app, 'Team B', 'user-b');
      const group = await createGroup(app, 'Broadcast Group', teamA.id);
      const inviteCode = 'ABCD1234';

      db.run('UPDATE groups SET invite_code = ? WHERE id = ?', [inviteCode, group.id]);
      db.save();

      // Register peer A manually as an existing peer
      const wsA = createMockWs();
      const peers = getPeers();
      peers.set(teamA.id, {
        ws: wsA,
        teamId: teamA.id,
        groupId: group.id,
        labels: [],
        lastHeartbeat: Date.now(),
      });

      // Connect peer B and send federation.register
      const wsB = createMockWs();
      handleFederationConnection(wsB);
      const messageHandler = wsB.on.mock.calls.find((call: unknown[]) => call[0] === 'message')![1];
      messageHandler(
        Buffer.from(
          JSON.stringify(
            buildFedMsg('federation.register', 'hub', {
              inviteCode,
              teamId: teamB.id,
              labels: [],
            }),
          ),
        ),
      );

      expect(wsA.send).toHaveBeenCalled();
      const calls = wsA.send.mock.calls.map((call: unknown[]) => JSON.parse(call[0] as string));
      const joined = calls.find((msg: { type: string; data: { teamId: string } }) => msg.type === 'federation.member.joined');
      expect(joined).toBeDefined();
      expect(joined!.data.teamId).toBe(teamB.id);
    });
  });

  describe('indexGroupTask', () => {
    it('creates a federation_task_index record', () => {
      const teamA = { id: 'team-a' };
      const groupId = 'group-' + Date.now();
      const taskId = 'task-' + Date.now();

      indexGroupTask(taskId, groupId, teamA.id, ['python', 'review']);

      const db = getDatabase();
      const stmt = db.prepare('SELECT * FROM federation_task_index WHERE task_id = ?');
      stmt.bind([taskId]);
      expect(stmt.step()).toBe(true);
      const row = stmt.getAsObject() as { group_id: string; required_labels: string; status: string };
      expect(row.group_id).toBe(groupId);
      expect(row.status).toBe('open');
      const labels = JSON.parse(row.required_labels) as string[];
      expect(labels).toEqual(['python', 'review']);
      stmt.free();
    });
  });
});
