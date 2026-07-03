// Federation Hub — Owner team's server accepts reverse connections from member Runners.
// Inspired by GitHub Self-Hosted Runners: only the Hub needs a public endpoint.

import { WebSocket } from 'ws';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDatabase } from '../db/index.js';
import {
  type FederationMessage,
  type FederationRegisterPayload,
  type FederationHeartbeatPayload,
  type FederationTaskClaimPayload,
  type FederationMemberJoinedPayload,
  type FederationMemberLeftPayload,
  type FederationAgentWakePayload,
  buildFedMsg,
  parseFedMsg,
} from './protocol.js';

// ---------------------------------------------------------------------------
// In-memory peer registry
// ---------------------------------------------------------------------------

interface Peer {
  ws: WebSocket;
  teamId: string;
  groupId: string;
  labels: string[];
  lastHeartbeat: number;
}

const peers = new Map<string, Peer>(); // teamId → Peer

/** Get all connected peers (for testing / introspection). */
export function getPeers(): Map<string, Peer> {
  return peers;
}

// ---------------------------------------------------------------------------
// Heartbeat / timeout checker
// ---------------------------------------------------------------------------

const HEARTBEAT_INTERVAL_MS = 30000;
const HEARTBEAT_TIMEOUT_MS = 120000;
let heartbeatTimer: NodeJS.Timeout | null = null;

export function startHubHeartbeat(): void {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    const now = Date.now();
    for (const [teamId, peer] of peers.entries()) {
      if (now - peer.lastHeartbeat > HEARTBEAT_TIMEOUT_MS) {
        console.log(`[federation-hub] Peer ${teamId} heartbeat timeout, disconnecting`);
        disconnectPeer(teamId, 'heartbeat_timeout');
      }
    }
  }, HEARTBEAT_INTERVAL_MS);
}

export function stopHubHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

// ---------------------------------------------------------------------------
// Peer lifecycle
// ---------------------------------------------------------------------------

function registerPeer(ws: WebSocket, teamId: string, groupId: string, labels: string[]): void {
  // Disconnect existing peer for same team if any
  const existing = peers.get(teamId);
  if (existing) {
    existing.ws.close(1000, 'replaced_by_new_connection');
  }

  const peer: Peer = { ws, teamId, groupId, labels, lastHeartbeat: Date.now() };
  peers.set(teamId, peer);

  // Update DB
  const db = getDatabase();
  db.run(
    `INSERT OR REPLACE INTO federation_peers
     (id, group_id, team_id, hub_url, status, labels, connected_at, last_heartbeat)
     VALUES (?, ?, ?, ?, 'connected', ?, ?, ?)`,
    [teamId + '-' + groupId, groupId, teamId, '', JSON.stringify(labels), Date.now(), Date.now()],
  );
  db.save();

  // Broadcast member.joined to all peers
  const db2 = getDatabase();
  const teamStmt = db2.prepare('SELECT name FROM teams WHERE id = ?');
  teamStmt.bind([teamId]);
  let teamName = teamId;
  if (teamStmt.step()) {
    const row = teamStmt.getAsObject() as { name: string };
    teamName = row.name;
  }
  teamStmt.free();

  broadcastToPeers(
    groupId,
    buildFedMsg('federation.member.joined', 'hub', { teamId, teamName } as FederationMemberJoinedPayload),
    teamId,
  );

  console.log(`[federation-hub] Peer registered: ${teamId} (group: ${groupId}, total peers: ${peers.size})`);
}

function disconnectPeer(teamId: string, reason: string): void {
  const peer = peers.get(teamId);
  if (!peer) return;

  peer.ws.close(1000, reason);
  peers.delete(teamId);

  // Update DB
  const db = getDatabase();
  db.run(
    `UPDATE federation_peers SET status = 'disconnected', disconnected_at = ? WHERE team_id = ?`,
    [Date.now(), teamId],
  );
  db.save();

  // Broadcast member.left
  broadcastToPeers(
    peer.groupId,
    buildFedMsg('federation.member.left', 'hub', { teamId } as FederationMemberLeftPayload),
    teamId,
  );

  // Reset uncompleted tasks claimed by this team
  db.run(
    `UPDATE federation_task_index SET status = 'open', claimed_by_team_id = NULL, claimed_at = NULL
     WHERE claimed_by_team_id = ? AND status = 'claimed'`,
    [teamId],
  );
  db.save();

  console.log(`[federation-hub] Peer disconnected: ${teamId} (reason: ${reason})`);
}

function updateHeartbeat(teamId: string): void {
  const peer = peers.get(teamId);
  if (peer) {
    peer.lastHeartbeat = Date.now();
    const db = getDatabase();
    db.run('UPDATE federation_peers SET last_heartbeat = ? WHERE team_id = ?', [Date.now(), teamId]);
    db.save();
  }
}

// ---------------------------------------------------------------------------
// Messaging
// ---------------------------------------------------------------------------

function sendToPeer(teamId: string, msg: FederationMessage): boolean {
  const peer = peers.get(teamId);
  if (peer && peer.ws.readyState === WebSocket.OPEN) {
    peer.ws.send(JSON.stringify(msg));
    return true;
  }
  return false;
}

function broadcastToPeers(groupId: string, msg: FederationMessage, excludeTeamId?: string): void {
  const payload = JSON.stringify(msg);
  for (const [teamId, peer] of peers.entries()) {
    if (peer.groupId === groupId && teamId !== excludeTeamId && peer.ws.readyState === WebSocket.OPEN) {
      peer.ws.send(payload);
    }
  }
}

// ---------------------------------------------------------------------------
// Invite code validation (reuses GroupManager logic)
// ---------------------------------------------------------------------------

function validateInviteCode(inviteCode: string): { valid: boolean; groupId?: string; error?: string } {
  const db = getDatabase();
  const stmt = db.prepare(
    'SELECT id, invite_code_expires_at, invite_code_max_uses, invite_code_uses FROM groups WHERE invite_code = ?',
  );
  stmt.bind([inviteCode.toUpperCase()]);

  if (!stmt.step()) {
    stmt.free();
    return { valid: false, error: 'Invalid invite code' };
  }

  const group = stmt.getAsObject() as {
    id: string;
    invite_code_expires_at: number | null;
    invite_code_max_uses: number | null;
    invite_code_uses: number;
  };
  stmt.free();

  const now = Math.floor(Date.now() / 1000);
  if (group.invite_code_expires_at && group.invite_code_expires_at < now) {
    return { valid: false, error: 'Invite code expired' };
  }
  if (group.invite_code_max_uses && group.invite_code_uses >= group.invite_code_max_uses) {
    return { valid: false, error: 'Invite code max uses reached' };
  }

  // Increment uses
  db.run('UPDATE groups SET invite_code_uses = invite_code_uses + 1 WHERE id = ?', [group.id]);
  db.save();

  return { valid: true, groupId: group.id };
}

// ---------------------------------------------------------------------------
// WSS message handler (per-connection)
// ---------------------------------------------------------------------------

function handleFederationMessage(ws: WebSocket, raw: string): void {
  const msg = parseFedMsg(raw);
  if (!msg) {
    ws.send(JSON.stringify(buildFedMsg('federation.register.result', 'hub', { success: false, error: 'Invalid message format' })));
    return;
  }

  switch (msg.type) {
    case 'federation.register': {
      const data = msg.data as FederationRegisterPayload;
      if (!data.inviteCode || !data.teamId) {
        ws.send(JSON.stringify(buildFedMsg('federation.register.result', 'hub', { success: false, error: 'inviteCode and teamId are required' })));
        return;
      }

      const validation = validateInviteCode(data.inviteCode);
      if (!validation.valid) {
        ws.send(JSON.stringify(buildFedMsg('federation.register.result', 'hub', { success: false, error: validation.error })));
        return;
      }

      registerPeer(ws, data.teamId, validation.groupId!, data.labels || []);
      ws.send(JSON.stringify(buildFedMsg('federation.register.result', 'hub', { success: true, groupId: validation.groupId })));
      break;
    }

    case 'federation.heartbeat': {
      const data = msg.data as FederationHeartbeatPayload;
      if (data.teamId) {
        updateHeartbeat(data.teamId);
      }
      break;
    }

    case 'federation.task.claim': {
      const data = msg.data as FederationTaskClaimPayload;
      handleClaim(ws, data);
      break;
    }

    case 'federation.member.leave': {
      const data = msg.data as { teamId?: string };
      if (data.teamId) {
        disconnectPeer(data.teamId, 'member_leave');
      }
      break;
    }

    default:
      console.log(`[federation-hub] Unknown message type: ${msg.type}`);
  }
}

function handleClaim(ws: WebSocket, data: FederationTaskClaimPayload): void {
  // TODO: Route claim to source team server (implemented in F006/F007)
  console.log(`[federation-hub] Claim received: task=${data.taskId}, agent=${data.agentId}, team=${data.teamId}`);
}

// ---------------------------------------------------------------------------
// WebSocket upgrade handler
// ---------------------------------------------------------------------------

export function handleFederationConnection(ws: WebSocket): void {
  console.log('[federation-hub] New Runner connection');

  ws.on('message', (data) => {
    handleFederationMessage(ws, data.toString());
  });

  ws.on('close', (code, reason) => {
    // Find and remove peer
    for (const [teamId, peer] of peers.entries()) {
      if (peer.ws === ws) {
        disconnectPeer(teamId, `ws_close:${code}:${reason.toString()}`);
        break;
      }
    }
  });

  ws.on('error', (err) => {
    console.error('[federation-hub] WS error:', err);
  });
}

// ---------------------------------------------------------------------------
// HTTP API routes (poll, claim)
// ---------------------------------------------------------------------------

export async function registerFederationHubRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/federation/peers — list registered federation peers
  app.get('/api/federation/peers', async (request: FastifyRequest) => {
    const query = request.query as { group_id?: string };
    const db = getDatabase();
    let sql = `
      SELECT fp.*, t.name as team_name, g.name as group_name
      FROM federation_peers fp
      LEFT JOIN teams t ON fp.team_id = t.id
      LEFT JOIN groups g ON fp.group_id = g.id
    `;
    const params: unknown[] = [];
    if (query.group_id) {
      sql += ' WHERE fp.group_id = ?';
      params.push(query.group_id);
    }
    sql += ' ORDER BY fp.connected_at DESC';

    const stmt = db.prepare(sql);
    if (params.length > 0) stmt.bind(params);
    const peers: Array<Record<string, unknown>> = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as Record<string, unknown>;
      peers.push({
        id: row.id,
        groupId: row.group_id,
        groupName: row.group_name,
        teamId: row.team_id,
        teamName: row.team_name,
        hubUrl: row.hub_url,
        status: row.status,
        labels: row.labels ? JSON.parse(row.labels as string) : [],
        roleCard: row.role_card ? JSON.parse(row.role_card as string) : null,
        lastHeartbeat: row.last_heartbeat,
        connectedAt: row.connected_at,
        disconnectedAt: row.disconnected_at,
      });
    }
    stmt.free();
    return { peers };
  });

  // GET /api/federation/poll — Runner pulls available tasks
  app.get('/api/federation/poll', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { team_id?: string; labels?: string };
    if (!query.team_id) {
      return reply.status(400).send({ error: 'team_id is required' });
    }

    const db = getDatabase();
    const peer = peers.get(query.team_id);
    if (!peer) {
      return reply.status(403).send({ error: 'Team not registered with this hub' });
    }

    // Parse agent labels from query (comma-separated)
    const agentLabels: string[] = query.labels ? query.labels.split(',').map((l) => l.trim()).filter(Boolean) : [];

    // Query open tasks for this group
    const stmt = db.prepare(
      `SELECT id, task_id, required_labels, source_team_id, created_at
       FROM federation_task_index
       WHERE group_id = ? AND status = 'open'
       ORDER BY created_at DESC LIMIT 50`,
    );
    stmt.bind([peer.groupId]);

    interface TaskRow {
      id: string;
      task_id: string;
      required_labels: string | null;
      source_team_id: string;
      created_at: number;
    }

    const tasks: Array<{ taskId: string; title: string; requiredLabels: string[]; sourceTeamId: string; createdAt: number }> = [];

    while (stmt.step()) {
      const row = stmt.getAsObject() as unknown as TaskRow;
      const requiredLabels: string[] = row.required_labels ? JSON.parse(row.required_labels) : [];

      // Label subset match: requiredLabels ⊆ agentLabels
      // If runner has no agents yet (empty labels), show all tasks for discovery
      const matches = agentLabels.length === 0 || requiredLabels.length === 0 || requiredLabels.every((r) => agentLabels.includes(r));
      if (matches) {
        // Fetch task title
        const titleStmt = db.prepare('SELECT title FROM tasks WHERE id = ?');
        titleStmt.bind([row.task_id]);
        let title = '';
        if (titleStmt.step()) {
          const t = titleStmt.getAsObject() as { title: string };
          title = t.title;
        }
        titleStmt.free();

        tasks.push({
          taskId: row.task_id,
          title,
          requiredLabels,
          sourceTeamId: row.source_team_id,
          createdAt: row.created_at,
        });
      }
    }
    stmt.free();

    return { tasks };
  });

  // POST /api/federation/claim — Runner claims a task
  app.post('/api/federation/claim', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { task_id?: string; agent_id?: string; team_id?: string };
    if (!body.task_id || !body.agent_id || !body.team_id) {
      return reply.status(400).send({ error: 'task_id, agent_id, and team_id are required' });
    }

    const db = getDatabase();
    const now = Math.floor(Date.now() / 1000);
    const authRequestId = crypto.randomUUID();

    try {
      db.run('BEGIN TRANSACTION');

      const idxStmt = db.prepare(
        `SELECT id, group_id, source_team_id FROM federation_task_index
         WHERE task_id = ? AND status = 'open'`,
      );
      idxStmt.bind([body.task_id]);
      if (!idxStmt.step()) {
        idxStmt.free();
        db.run('ROLLBACK');
        return reply.status(409).send({ error: 'Task is not available for federation claim' });
      }
      const indexRow = idxStmt.getAsObject() as { id: string; group_id: string; source_team_id: string };
      idxStmt.free();

      if (indexRow.source_team_id === body.team_id) {
        db.run('ROLLBACK');
        return reply.status(400).send({ error: 'Cannot claim your own team\'s task' });
      }

      db.run(
        `UPDATE federation_task_index
         SET status = 'claimed', claimed_by_team_id = ?, claimed_at = ?
         WHERE id = ? AND status = 'open'`,
        [body.team_id, now, indexRow.id],
      );
      const changes = db.exec('SELECT changes() as changes')[0]?.values[0][0] as number;
      if (changes === 0) {
        db.run('ROLLBACK');
        return reply.status(409).send({ error: 'Task is already claimed' });
      }

      db.run('UPDATE tasks SET status = ? WHERE id = ?', ['pending_authorization', body.task_id]);
      db.run('UPDATE group_tasks SET authorization_status = ? WHERE task_id = ?', ['pending', body.task_id]);
      db.run(
        `INSERT INTO authorization_requests
         (id, group_task_id, requesting_team_id, requesting_agent_id, status, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [authRequestId, body.task_id, body.team_id, body.agent_id, 'pending', now, now + 300],
      );

      db.run('COMMIT');
      db.save();

      return {
        success: true,
        authorization_request_id: authRequestId,
        status: 'pending_authorization',
        expires_at: now + 300,
      };
    } catch (err) {
      db.run('ROLLBACK');
      const error = err as Error;
      return reply.status(500).send({ error: error.message });
    }
  });
}

// ---------------------------------------------------------------------------
// Wake agent on a Runner (called by authorization approval)
// ---------------------------------------------------------------------------

export function wakeFederationAgent(
  teamId: string,
  agentId: string,
  taskId: string,
  context: FederationAgentWakePayload['context'],
): boolean {
  const peer = peers.get(teamId);
  if (!peer) {
    console.warn(`[federation-hub] Cannot wake agent: team ${teamId} not connected`);
    return false;
  }

  const msg = buildFedMsg('federation.agent.wake', 'hub', {
    agentId,
    taskId,
    context,
  } as FederationAgentWakePayload);

  return sendToPeer(teamId, msg);
}

// ---------------------------------------------------------------------------
// Index a new group task (called by TaskQueue when a group task is created)
// ---------------------------------------------------------------------------

export function indexGroupTask(
  taskId: string,
  groupId: string,
  sourceTeamId: string,
  requiredLabels: string[],
): void {
  const db = getDatabase();
  const id = crypto.randomUUID();
  db.run(
    `INSERT INTO federation_task_index (id, task_id, group_id, source_team_id, required_labels, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'open', ?)`,
    [id, taskId, groupId, sourceTeamId, JSON.stringify(requiredLabels), Date.now()],
  );
  db.save();

  // Optionally broadcast to all peers (push notification in addition to poll)
  broadcastToPeers(
    groupId,
    buildFedMsg('federation.task.broadcast', 'hub', {
      taskId,
      title: '', // title will be fetched by Runner if needed
      requiredLabels,
      sourceTeamId,
    }),
  );
}
