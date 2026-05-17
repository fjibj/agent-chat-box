import { WebSocket } from 'ws';
import crypto from 'crypto';
import type { WSMessage, Task } from '@agent-chat-box/shared';
import { MSG, HEARTBEAT_INTERVAL_MS } from '@agent-chat-box/shared';
import { findMachineByApiKey } from '../api/machines.js';
import { registerAgentWs, getAgentById } from '../api/agents.js';
import { addChannelMember, removeChannelMember, getChannelMembers } from '../api/channels.js';
import { saveMessage } from '../api/messages.js';
import { sleepAgent, checkAndWakeAgents } from '../modules/wake-engine.js';
import { getDatabase } from '../db/index.js';
import { createTask, claimTask, updateTask, checkParentCompletion } from '../modules/task-queue.js';
import type { RoleCard } from '@agent-chat-box/shared';

export interface Client {
  ws: WebSocket;
  type: 'human' | 'daemon';
  id: string;
  name?: string;
  authenticated: boolean;
  machineId?: string;
  agentIds?: string[];
}

const clients = new Map<string, Client>();

// Group broadcast maps
const groupTeams = new Map<string, Set<string>>(); // groupId → Set<teamId>
const teamClients = new Map<string, Set<string>>(); // teamId → Set<clientId>

/** Get all connected clients. */
export function getClients(): Map<string, Client> {
  return clients;
}

/** Get group teams map (for testing). */
export function getGroupTeams(): Map<string, Set<string>> {
  return groupTeams;
}

/** Get team clients map (for testing). */
export function getTeamClients(): Map<string, Set<string>> {
  return teamClients;
}

/** Get a specific client by id. */
export function getClient(id: string): Client | undefined {
  return clients.get(id);
}

/** Send a WSMessage to a specific client. */
export function sendTo(clientId: string, msg: WSMessage): void {
  const client = clients.get(clientId);
  if (client?.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(msg));
  }
}

/** Broadcast a WSMessage to all authenticated clients. */
export function broadcast(msg: WSMessage): void {
  const payload = JSON.stringify(msg);
  for (const client of clients.values()) {
    if (client.authenticated && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
}

/** Send error response to a client. */
export function sendError(
  client: Client,
  id: string | undefined,
  code: string,
  message: string,
): void {
  const msg: WSMessage = {
    v: 1,
    id,
    type: MSG.ERROR,
    ts: Date.now(),
    data: { code, message },
  };
  client.ws.send(JSON.stringify(msg));
}

/**
 * Handle a new WebSocket connection.
 * Sets up message parsing, heartbeat, and cleanup.
 */
export function handleConnection(ws: WebSocket, type: 'human' | 'daemon'): Client {
  const clientId = crypto.randomUUID();
  // Human clients auto-authenticate (no auth system for humans in MVP)
  const client: Client = { ws, type, id: clientId, authenticated: type === 'human' };
  clients.set(clientId, client);

  console.log(`[ws] ${type} connected: ${clientId} (total: ${clients.size})`);

  // Auto-join human clients to default channel
  if (type === 'human') {
    autoJoinDefaultChannel(clientId);
  }

  // Message handler
  ws.on('message', (data) => {
    try {
      const msg: WSMessage = JSON.parse(data.toString());
      if (!isValidEnvelope(msg)) {
        sendError(client, undefined, 'INVALID_MESSAGE', 'Invalid message envelope');
        return;
      }
      handleMessage(client, msg);
    } catch (_err) {
      sendError(client, undefined, 'PARSE_ERROR', 'Invalid JSON');
    }
  });

  // Close handler
  ws.on('close', () => {
    // Set machine offline only if no other active connection for same machine
    if (client.machineId) {
      const hasOtherConnection = Array.from(clients.values()).some(
        (c) =>
          c.id !== clientId &&
          c.machineId === client.machineId &&
          c.ws.readyState === WebSocket.OPEN,
      );
      if (!hasOtherConnection) {
        const db = getDatabase();
        db.run('UPDATE machines SET status = ? WHERE id = ?', ['offline', client.machineId]);
        db.save();
        console.log(`[ws] Machine offline: ${client.machineId}`);
      } else {
        console.log(`[ws] Machine ${client.machineId} still has active connection, staying online`);
      }
    }

    // Clean up human members from channels on disconnect
    if (type === 'human') {
      const db = getDatabase();
      db.run('DELETE FROM channel_members WHERE member_id = ? AND member_kind = ?', [
        clientId,
        'human',
      ]);
      db.save();
      console.log(`[ws] Cleaned up human member: ${clientId}`);
    }

    // Release group tasks claimed by this client's agents on disconnect
    if (client.agentIds && client.agentIds.length > 0) {
      const db = getDatabase();
      for (const agentId of client.agentIds) {
        // Find group tasks claimed by this agent
        const stmt = db.prepare(`
          SELECT t.id, gt.group_id FROM tasks t
          JOIN group_tasks gt ON t.id = gt.task_id
          WHERE t.assignee_id = ? AND t.status IN ('claimed', 'running')
        `);
        stmt.bind([agentId]);
        const tasks: Array<{ id: string; group_id: string }> = [];
        while (stmt.step()) {
          tasks.push(stmt.getAsObject() as { id: string; group_id: string });
        }
        stmt.free();

        for (const task of tasks) {
          db.run("UPDATE tasks SET status = 'pending', assignee_id = NULL WHERE id = ?", [task.id]);
          db.run("UPDATE group_tasks SET authorization_status = 'none' WHERE task_id = ?", [task.id]);
          console.log(`[ws] Released group task ${task.id} from disconnected agent ${agentId}`);
        }
        if (tasks.length > 0) {
          db.save();
        }
      }
    }

    // Clean up team-clients mapping
    updateTeamClientsMapping(clientId, null);

    clients.delete(clientId);
    console.log(`[ws] ${type} disconnected: ${clientId} (total: ${clients.size})`);
  });

  // Error handler
  ws.on('error', (err) => {
    console.error(`[ws] Error from ${clientId}:`, err.message);
  });

  // Heartbeat: server pings client every 30s
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    } else {
      clearInterval(pingInterval);
    }
  }, HEARTBEAT_INTERVAL_MS);

  ws.on('close', () => clearInterval(pingInterval));

  // Send welcome
  sendTo(clientId, {
    v: 1,
    type: 'system.welcome',
    ts: Date.now(),
    data: { clientId, message: 'Connected to Agent Chat Box' },
  });

  return client;
}

/** Validate WSMessage envelope structure. */
function isValidEnvelope(msg: any): msg is WSMessage {
  // eslint-disable-line @typescript-eslint/no-explicit-any -- type guard needs any for narrowing
  return (
    typeof msg === 'object' &&
    msg !== null &&
    msg.v === 1 &&
    typeof msg.type === 'string' &&
    typeof msg.ts === 'number'
  );
}

/** Route incoming message to handler. */
function handleMessage(client: Client, msg: WSMessage): void {
  // Auth check: only auth messages allowed before authentication
  if (!client.authenticated && !isAuthMessage(msg.type)) {
    sendError(client, msg.id, 'AUTH_REQUIRED', 'Authenticate first');
    return;
  }

  // Route by message type
  switch (msg.type) {
    case MSG.PING:
      sendTo(client.id, { v: 1, id: msg.id, type: MSG.PONG, ts: Date.now(), data: {} });
      break;

    case 'machine.auth':
      handleMachineAuth(client, msg);
      break;

    case MSG.AGENT_HELLO:
      handleAgentHello(client, msg);
      break;

    case MSG.AGENT_SLEEP:
      handleAgentSleep(client, msg);
      break;

    case MSG.CHANNEL_JOIN:
      handleChannelJoin(client, msg);
      break;

    case MSG.CHANNEL_LEAVE:
      handleChannelLeave(client, msg);
      break;

    case MSG.HUMAN_IDENTIFY:
      handleHumanIdentify(client, msg);
      break;

    case MSG.MSG_SEND:
      handleMessageSend(client, msg);
      break;

    case MSG.TASK_CREATE:
      handleTaskCreate(client, msg);
      break;

    case MSG.TASK_CLAIM:
      handleTaskClaim(client, msg);
      break;

    case MSG.TASK_UPDATE:
      handleTaskUpdate(client, msg);
      break;

    default:
      // Unhandled — will be routed in future stories
      console.log(`[ws] Unhandled message type: ${msg.type} from ${client.id}`);
      sendError(client, msg.id, 'UNHANDLED', `No handler for ${msg.type}`);
      break;
  }
}

/** Handle machine authentication */
function handleMachineAuth(client: Client, msg: WSMessage): void {
  // Only daemon clients can authenticate as machines
  if (client.type !== 'daemon') {
    sendError(client, msg.id, 'AUTH_INVALID', 'Only daemon clients can authenticate as machines');
    return;
  }

  const data = msg.data as { machine_token?: string };
  if (!data.machine_token || typeof data.machine_token !== 'string') {
    sendError(client, msg.id, 'AUTH_INVALID', 'machine_token is required');
    return;
  }

  const machine = findMachineByApiKey(data.machine_token);
  if (!machine) {
    sendError(client, msg.id, 'AUTH_INVALID', 'Invalid API key');
    client.ws.close();
    return;
  }

  // Close old connection for same machine (prevent duplicate daemons)
  for (const [existingId, existing] of clients.entries()) {
    if (existingId !== client.id && existing.machineId === machine.id) {
      console.log(`[ws] Closing stale daemon connection: ${existingId} for machine ${machine.id}`);
      existing.ws.close();
      clients.delete(existingId);
    }
  }

  // Success — mark authenticated
  client.authenticated = true;
  client.machineId = machine.id;

  // Update machine status to online
  const db = getDatabase();
  db.run('UPDATE machines SET status = ?, last_heartbeat = ? WHERE id = ?', [
    'online',
    Date.now(),
    machine.id,
  ]);
  db.save();

  console.log(`[ws] Machine authenticated: ${machine.name} (${machine.id})`);

  // Send machine.welcome
  sendTo(client.id, {
    v: 1,
    id: msg.id,
    type: 'machine.welcome',
    ts: Date.now(),
    data: {
      machineId: machine.id,
      machineName: machine.name,
      message: `Welcome, ${machine.name}`,
    },
  });
}

/** Handle agent registration (agent.hello) */
function handleAgentHello(client: Client, msg: WSMessage): void {
  if (client.type !== 'daemon') {
    sendError(client, msg.id, 'AUTH_INVALID', 'Only daemon clients can register agents');
    return;
  }

  if (!client.machineId) {
    sendError(client, msg.id, 'AUTH_REQUIRED', 'Authenticate machine first');
    return;
  }

  const data = msg.data as {
    name?: string;
    runtime?: string;
    role_card?: RoleCard;
    capabilities?: string[];
    labels?: string[];
  };

  if (!data.name || !data.runtime || !data.role_card) {
    sendError(client, msg.id, 'INVALID_PAYLOAD', 'name, runtime, and role_card are required');
    return;
  }

  const agent = registerAgentWs(client.machineId, {
    name: data.name,
    runtime: data.runtime,
    roleCard: data.role_card,
    capabilities: data.capabilities || [],
    labels: data.labels || [],
  });

  if (!agent) {
    sendError(client, msg.id, 'REGISTER_FAILED', 'Failed to register agent');
    return;
  }

  // Track agent on client
  if (!client.agentIds) client.agentIds = [];
  if (!client.agentIds.includes(agent.id)) {
    client.agentIds.push(agent.id);
  }

  // Update team-clients mapping for group broadcast
  if (agent.teamId) {
    updateTeamClientsMapping(client.id, agent.teamId);
  }

  console.log(`[ws] Agent registered: ${agent.name} (${agent.id}) on machine ${client.machineId}`);

  // Send agent.welcome
  sendTo(client.id, {
    v: 1,
    id: msg.id,
    type: 'agent.welcome',
    ts: Date.now(),
    data: {
      agent,
      message: `Welcome, ${agent.name}`,
    },
  });
}

/** Handle channel join (channel.join) */
function handleChannelJoin(client: Client, msg: WSMessage): void {
  const data = msg.data as { channel_id?: string };
  if (!data.channel_id) {
    sendError(client, msg.id, 'INVALID_PAYLOAD', 'channel_id is required');
    return;
  }

  // Determine member ID and kind
  const memberId =
    client.type === 'daemon' ? client.agentIds?.[0] || client.machineId || client.id : client.id;
  const memberKind = client.type === 'daemon' ? 'agent' : 'human';

  addChannelMember(data.channel_id, memberId, memberKind);

  const members = getChannelMembers(data.channel_id);
  console.log(`[ws] ${memberKind} ${memberId} joined channel ${data.channel_id}`);

  sendTo(client.id, {
    v: 1,
    id: msg.id,
    type: 'channel.subscribed',
    ts: Date.now(),
    data: {
      channelId: data.channel_id,
      members,
    },
  });
}

/** Handle channel leave (channel.leave) */
function handleChannelLeave(client: Client, msg: WSMessage): void {
  const data = msg.data as { channel_id?: string };
  if (!data.channel_id) {
    sendError(client, msg.id, 'INVALID_PAYLOAD', 'channel_id is required');
    return;
  }

  const memberId =
    client.type === 'daemon' ? client.agentIds?.[0] || client.machineId || client.id : client.id;
  removeChannelMember(data.channel_id, memberId);

  console.log(`[ws] ${client.type} ${memberId} left channel ${data.channel_id}`);

  sendTo(client.id, {
    v: 1,
    id: msg.id,
    type: 'channel.left',
    ts: Date.now(),
    data: {
      channelId: data.channel_id,
    },
  });
}

/** Handle agent sleep (agent.sleep) */
function handleAgentSleep(client: Client, msg: WSMessage): void {
  if (client.type !== 'daemon') {
    sendError(client, msg.id, 'AUTH_INVALID', 'Only daemon clients can put agents to sleep');
    return;
  }

  const data = msg.data as { agent_id?: string };
  if (!data.agent_id) {
    sendError(client, msg.id, 'INVALID_PAYLOAD', 'agent_id is required');
    return;
  }

  sleepAgent(data.agent_id);

  sendTo(client.id, {
    v: 1,
    id: msg.id,
    type: 'agent.sleeping',
    ts: Date.now(),
    data: { agentId: data.agent_id },
  });
}

/** Handle human identity (human.identify) */
function handleHumanIdentify(client: Client, msg: WSMessage): void {
  if (client.type !== 'human') {
    sendError(client, msg.id, 'AUTH_INVALID', 'Only human clients can identify');
    return;
  }

  const data = msg.data as { name?: string; client_id?: string };
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    sendError(client, msg.id, 'INVALID_PAYLOAD', 'name is required');
    return;
  }

  client.name = data.name.trim();

  // Use client-provided stable ID if available (for persistence across refreshes)
  if (data.client_id && typeof data.client_id === 'string' && data.client_id !== client.id) {
    const oldId = client.id;
    clients.delete(oldId);
    client.id = data.client_id;
    clients.set(client.id, client);

    // Update channel_members to use new ID
    const db = getDatabase();
    db.run('UPDATE channel_members SET member_id = ? WHERE member_id = ? AND member_kind = ?', [
      client.id,
      oldId,
      'human',
    ]);
    db.save();

    console.log(`[ws] Human ${oldId} → ${client.id} identified as: ${client.name}`);
  } else {
    console.log(`[ws] Human ${client.id} identified as: ${client.name}`);
  }

  sendTo(client.id, {
    v: 1,
    id: msg.id,
    type: MSG.HUMAN_IDENTIFIED,
    ts: Date.now(),
    data: { id: client.id, name: client.name },
  });
}

/** Handle message send (message.send) */
function handleMessageSend(client: Client, msg: WSMessage): void {
  const data = msg.data as {
    channel_id?: string;
    content?: string;
    mentions?: string[];
    reply_to?: string;
    attachments?: Array<{ id: string; url: string; name: string; mime: string; size: number }>;
  };

  if (!data.channel_id || !data.content) {
    sendError(client, msg.id, 'INVALID_PAYLOAD', 'channel_id and content are required');
    return;
  }

  // Determine sender ID and name
  const senderId =
    client.type === 'daemon' ? client.agentIds?.[0] || client.machineId || client.id : client.id;
  const senderKind = client.type === 'daemon' ? 'agent' : 'human';

  // Resolve senderName before saving
  let senderName: string | undefined;
  if (client.type === 'human') {
    senderName = client.name || client.id;
  } else {
    const agentId = client.agentIds?.[0];
    if (agentId) {
      const agent = getAgentById(agentId);
      senderName = agent?.name || agentId;
    }
  }

  // Save message (with senderName persisted to DB)
  const message = saveMessage({
    channelId: data.channel_id,
    senderId,
    senderKind,
    senderName,
    content: data.content,
    mentions: data.mentions,
    replyTo: data.reply_to,
    attachments: data.attachments,
  });

  // Send ack to sender
  sendTo(client.id, {
    v: 1,
    id: msg.id,
    type: MSG.MSG_ACK,
    ts: Date.now(),
    data: {
      clientMsgId: msg.id,
      messageId: message.id,
    },
  });

  // Broadcast to all channel members (including sender for real-time display)
  broadcastToChannel(data.channel_id, MSG.MSG_NEW, { message });

  // Check and wake sleeping agents if mentioned
  checkAndWakeAgents(data.channel_id, message);

  console.log(`[ws] Message sent to channel ${data.channel_id} by ${senderKind} ${senderId}`);
}

/** Handle task create (task.create) */
function handleTaskCreate(client: Client, msg: WSMessage): void {
  const data = msg.data as {
    channel_id?: string;
    title?: string;
    description?: string;
    priority?: string;
    mode?: string;
    tags?: string[];
    required_capabilities?: string[];
    timeout_seconds?: number;
    max_retries?: number;
  };

  if (!data.channel_id || !data.title) {
    sendError(client, msg.id, 'INVALID_PAYLOAD', 'channel_id and title are required');
    return;
  }

  const creatorId =
    client.type === 'daemon' ? client.agentIds?.[0] || client.machineId || client.id : client.id;

  const task = createTask(
    {
      channelId: data.channel_id,
      title: data.title,
      description: data.description,
      priority: data.priority as Task['priority'],
      mode: data.mode as Task['mode'],
      tags: data.tags,
      requiredCapabilities: data.required_capabilities,
      timeoutSeconds: data.timeout_seconds,
      maxRetries: data.max_retries,
    },
    creatorId,
  );

  sendTo(client.id, {
    v: 1,
    id: msg.id,
    type: MSG.TASK_CREATED,
    ts: Date.now(),
    data: { task },
  });

  console.log(`[ws] Task created: ${task.id} - ${task.title}`);
}

/** Handle task claim (task.claim) */
function handleTaskClaim(client: Client, msg: WSMessage): void {
  const data = msg.data as { task_id?: string };
  if (!data.task_id) {
    sendError(client, msg.id, 'INVALID_PAYLOAD', 'task_id is required');
    return;
  }

  const agentId =
    client.type === 'daemon' ? client.agentIds?.[0] || client.machineId || client.id : client.id;
  const result = claimTask(data.task_id, agentId);

  if (result.success) {
    sendTo(client.id, {
      v: 1,
      id: msg.id,
      type: MSG.TASK_CLAIMED,
      ts: Date.now(),
      data: { task: result.task },
    });
    console.log(`[ws] Task claimed: ${data.task_id} by agent ${agentId}`);
  } else {
    sendError(
      client,
      msg.id,
      result.error || 'CLAIM_FAILED',
      `Failed to claim task: ${result.error}`,
    );
  }
}

/** Handle task update (task.update) */
function handleTaskUpdate(client: Client, msg: WSMessage): void {
  const data = msg.data as {
    task_id?: string;
    status?: string;
    output?: string;
    retry_count?: number;
  };

  if (!data.task_id) {
    sendError(client, msg.id, 'INVALID_PAYLOAD', 'task_id is required');
    return;
  }

  const task = updateTask(data.task_id, {
    status: data.status as Task['status'],
    output: data.output,
    retry_count: data.retry_count,
  });

  if (!task) {
    sendError(client, msg.id, 'NOT_FOUND', 'Task not found');
    return;
  }

  sendTo(client.id, {
    v: 1,
    id: msg.id,
    type: MSG.TASK_UPDATED,
    ts: Date.now(),
    data: { task },
  });

  console.log(`[ws] Task updated: ${data.task_id} status=${data.status}`);

  // Check parent completion when subtask finishes
  if ((data.status === 'completed' || data.status === 'failed') && task?.parentTaskId) {
    checkParentCompletion(task.parentTaskId);
  }
}

/** Broadcast message to all clients in a channel (except excludeId) */
export function broadcastToChannel(
  channelId: string,
  type: string,
  data: unknown,
  excludeId?: string,
): void {
  const members = getChannelMembers(channelId);
  const memberIds = new Set(members.map((m) => m.memberId));

  for (const [clientId, client] of clients.entries()) {
    if (clientId === excludeId) continue;
    if (client.ws.readyState !== WebSocket.OPEN) continue;

    // Check if client is a member (human or daemon with agent in channel)
    const clientMemberId =
      client.type === 'daemon' ? client.agentIds?.[0] || client.machineId || client.id : client.id;
    if (memberIds.has(clientMemberId)) {
      sendTo(clientId, {
        v: 1,
        type,
        ts: Date.now(),
        data,
      });
    }
  }
}

/** Broadcast message to all clients in a group */
export function broadcastToGroup(
  groupId: string,
  type: string,
  data: unknown,
  excludeId?: string,
): void {
  const teamIds = groupTeams.get(groupId);
  if (!teamIds) return;

  const payload = JSON.stringify({
    v: 1,
    type,
    ts: Date.now(),
    data,
  });

  for (const teamId of teamIds) {
    const clientIds = teamClients.get(teamId);
    if (!clientIds) continue;

    for (const clientId of clientIds) {
      if (clientId === excludeId) continue;
      const client = clients.get(clientId);
      if (client?.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
  }
}

/** Update group-teams mapping from database */
export function refreshGroupTeamsMap(): void {
  const db = getDatabase();
  groupTeams.clear();

  const stmt = db.prepare('SELECT group_id, team_id FROM group_members');
  while (stmt.step()) {
    const row = stmt.getAsObject() as { group_id: string; team_id: string };
    if (!groupTeams.has(row.group_id)) {
      groupTeams.set(row.group_id, new Set());
    }
    groupTeams.get(row.group_id)!.add(row.team_id);
  }
  stmt.free();
}

/** Update team-clients mapping for a daemon client */
export function updateTeamClientsMapping(clientId: string, teamId: string | null): void {
  // Remove from old team mapping
  for (const [tid, cids] of teamClients.entries()) {
    cids.delete(clientId);
    if (cids.size === 0) {
      teamClients.delete(tid);
    }
  }

  // Add to new team mapping
  if (teamId) {
    if (!teamClients.has(teamId)) {
      teamClients.set(teamId, new Set());
    }
    teamClients.get(teamId)!.add(clientId);
  }
}

/** Auto-join a human client to the default 'general' channel */
function autoJoinDefaultChannel(clientId: string): void {
  const db = getDatabase();
  const stmt = db.prepare("SELECT id FROM channels WHERE name = 'general' AND type = 'group'");
  if (stmt.step()) {
    const row = stmt.getAsObject() as { id: string };
    stmt.free();
    addChannelMember(row.id, clientId, 'human');
    console.log(`[ws] Human ${clientId} auto-joined #general`);
  } else {
    stmt.free();
  }
}

function isAuthMessage(type: string): boolean {
  return type === 'machine.auth' || type === 'auth.login';
}
