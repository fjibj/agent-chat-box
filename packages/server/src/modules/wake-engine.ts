import { getDatabase } from '../db/index.js';
import { getRecentMessages } from '../api/messages.js';
import { getClients } from '../ws/handler.js';
import type { Agent, Message, WSMessage } from '@agent-chat-box/shared';

export type WakeTrigger = 'mention' | 'dm' | 'task_assigned' | 'manual' | 'federation_claim';

export interface WakeContext {
  trigger: WakeTrigger;
  channelId?: string;
  taskId?: string;
  recentMessages: Message[];
  sourceTeamId?: string;
  title?: string;
}

/** Update agent status in database */
export function updateAgentStatus(agentId: string, status: Agent['status']): void {
  const db = getDatabase();
  const now = Date.now();

  if (status === 'sleeping') {
    db.run('UPDATE agents SET status = ?, last_sleep_at = ? WHERE id = ?', [status, now, agentId]);
  } else if (status === 'awake') {
    db.run('UPDATE agents SET status = ?, last_wake_at = ? WHERE id = ?', [status, now, agentId]);
  } else {
    db.run('UPDATE agents SET status = ? WHERE id = ?', [status, agentId]);
  }
  db.save();
}

/** Get agent by ID */
function getAgent(agentId: string): Agent | null {
  const db = getDatabase();
  const stmt = db.prepare(
    'SELECT id, machine_id, name, runtime, status, capabilities, role_card, labels, current_task_id, last_sleep_at, last_wake_at FROM agents WHERE id = ?',
  );
  stmt.bind([agentId]);

  if (!stmt.step()) {
    stmt.free();
    return null;
  }

  const row = stmt.getAsObject() as Record<string, unknown>;
  stmt.free();

  return {
    id: row.id as string,
    machineId: row.machine_id as string,
    name: row.name as string,
    runtime: row.runtime as Agent['runtime'],
    status: row.status as Agent['status'],
    roleCard: JSON.parse(row.role_card as string),
    capabilities: JSON.parse((row.capabilities as string) || '[]'),
    labels: JSON.parse((row.labels as string) || '[]'),
    currentTaskId: row.current_task_id as string | undefined,
    lastSleepAt: row.last_sleep_at as number | undefined,
    lastWakeAt: row.last_wake_at as number | undefined,
  };
}

/** Check if agent should be woken up based on message */
export function shouldWakeAgent(agentId: string, message: Message): boolean {
  const agent = getAgent(agentId);
  if (!agent) return false;
  if (agent.status !== 'sleeping') return false;

  // @mention
  if (message.mentions?.includes(agentId) || message.mentions?.includes(agent.name)) {
    return true;
  }

  // DM channel
  if (message.channelId.includes(agentId)) {
    return true;
  }

  return false;
}

/** Wake an agent with context */
export function wakeAgent(
  agentId: string,
  trigger: WakeTrigger,
  channelId?: string,
  taskId?: string,
  extraContext?: { title?: string; sourceTeamId?: string },
): void {
  const agent = getAgent(agentId);
  if (!agent) return;

  // Update status
  updateAgentStatus(agentId, 'awake');

  // Build context
  const recentMessages = channelId ? getRecentMessages(channelId, 20) : [];
  const context: WakeContext = {
    trigger,
    channelId,
    taskId,
    recentMessages,
    title: extraContext?.title,
    sourceTeamId: extraContext?.sourceTeamId,
  };

  // Find daemon client for this agent's machine
  const clients = getClients();
  for (const [, client] of clients) {
    if (client.machineId === agent.machineId && client.authenticated) {
      const wakeMsg: WSMessage = {
        v: 1,
        type: 'agent.wake',
        ts: Date.now(),
        data: {
          agentId: agent.id,
          agentName: agent.name,
          context,
        },
      };
      client.ws.send(JSON.stringify(wakeMsg));
      console.log(`[wake] Agent ${agent.name} (${agentId}) woken by ${trigger}`);
      return;
    }
  }

  console.log(`[wake] No daemon client found for agent ${agentId} on machine ${agent.machineId}`);
}

/** Sleep an agent */
export function sleepAgent(agentId: string): void {
  const agent = getAgent(agentId);
  if (!agent) return;

  updateAgentStatus(agentId, 'sleeping');

  // Notify daemon
  const clients = getClients();
  for (const [, client] of clients) {
    if (client.machineId === agent.machineId && client.authenticated) {
      const sleepMsg: WSMessage = {
        v: 1,
        type: 'agent.sleep',
        ts: Date.now(),
        data: {
          agentId: agent.id,
          agentName: agent.name,
        },
      };
      client.ws.send(JSON.stringify(sleepMsg));
      console.log(`[sleep] Agent ${agent.name} (${agentId}) put to sleep`);
      return;
    }
  }
}

/** Check all agents in a channel and wake sleeping ones if mentioned */
export function checkAndWakeAgents(channelId: string, message: Message): void {
  const db = getDatabase();

  // Get all agents in this channel
  const stmt = db.prepare(`
    SELECT a.id FROM agents a
    JOIN channel_members cm ON a.id = cm.member_id
    WHERE cm.channel_id = ? AND a.status = 'sleeping'
  `);
  stmt.bind([channelId]);

  const sleepingAgents: string[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as { id: string };
    sleepingAgents.push(row.id);
  }
  stmt.free();

  // Check each sleeping agent
  for (const agentId of sleepingAgents) {
    if (shouldWakeAgent(agentId, message)) {
      wakeAgent(agentId, 'mention', channelId);
    }
  }
}
