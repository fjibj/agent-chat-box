// Federation Runner — Member team's server connects to a remote Hub.
// Inspired by GitHub Self-Hosted Runners: reverse connection, no public IP needed.

import { WebSocket } from 'ws';
import {
  type FederationMessage,
  type FederationRegisterPayload,
  type FederationHeartbeatPayload,
  type FederationTaskClaimPayload,
  type FederationTaskClaimResultPayload,
  type FederationAgentWakePayload,
  buildFedMsg,
  parseFedMsg,
} from './protocol.js';
import { getDatabase } from '../db/index.js';

// ---------------------------------------------------------------------------
// Runner config
// ---------------------------------------------------------------------------

interface RunnerConfig {
  hubUrl: string;
  inviteCode: string;
  teamId: string;
}

let runnerConfig: RunnerConfig | null = null;
let runnerWs: WebSocket | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let heartbeatTimer: NodeJS.Timeout | null = null;
let pollTimer: NodeJS.Timeout | null = null;
let _connected = false;

/** Check if runner is currently connected to a hub. */
export function isRunnerConnected(): boolean {
  return _connected;
}

// ---------------------------------------------------------------------------
// Reconnect logic (exponential backoff)
// ---------------------------------------------------------------------------

const RECONNECT_BASE_MS = 5000;
const RECONNECT_MAX_MS = 60000;
let reconnectDelay = RECONNECT_BASE_MS;

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (runnerConfig) {
      console.log(`[federation-runner] Reconnecting in ${reconnectDelay}ms...`);
      connect(runnerConfig);
    }
  }, reconnectDelay);
  reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS);
}

function resetReconnectDelay(): void {
  reconnectDelay = RECONNECT_BASE_MS;
}

// ---------------------------------------------------------------------------
// Connection lifecycle
// ---------------------------------------------------------------------------

export function initFederationRunner(config: RunnerConfig): void {
  runnerConfig = config;
  connect(config);
}

function connect(config: RunnerConfig): void {
  if (runnerWs) {
    try { runnerWs.close(); } catch { /* ignore */ }
    runnerWs = null;
  }

  console.log(`[federation-runner] Connecting to Hub: ${config.hubUrl}`);

  try {
    const ws = new WebSocket(config.hubUrl);
    runnerWs = ws;

    ws.on('open', () => {
      console.log('[federation-runner] Connected to Hub');
      _connected = true;
      resetReconnectDelay();

      // Send registration
      const db = getDatabase();
      const labelsStmt = db.prepare('SELECT labels FROM agents WHERE team_id = ? LIMIT 1');
      labelsStmt.bind([config.teamId]);
      let labels: string[] = [];
      if (labelsStmt.step()) {
        const row = labelsStmt.getAsObject() as { labels: string };
        labels = row.labels ? JSON.parse(row.labels) : [];
      }
      labelsStmt.free();

      const registerMsg = buildFedMsg('federation.register', config.teamId, {
        inviteCode: config.inviteCode,
        teamId: config.teamId,
        labels,
      } as FederationRegisterPayload);
      ws.send(JSON.stringify(registerMsg));

      // Start heartbeat
      startHeartbeat(config.teamId);
      // Start polling
      startPolling(config);
    });

    ws.on('message', (data) => {
      handleMessage(data.toString());
    });

    ws.on('close', (code, reason) => {
      console.log(`[federation-runner] Connection closed: ${code} ${reason.toString()}`);
      _connected = false;
      stopHeartbeat();
      stopPolling();
      scheduleReconnect();
    });

    ws.on('error', (err) => {
      console.error('[federation-runner] WS error:', err.message);
      // on('close') will fire after error
    });
  } catch (err) {
    console.error('[federation-runner] Failed to create WebSocket:', err);
    scheduleReconnect();
  }
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

function handleMessage(raw: string): void {
  const msg = parseFedMsg(raw);
  if (!msg) {
    console.warn('[federation-runner] Received invalid federation message');
    return;
  }

  switch (msg.type) {
    case 'federation.register.result': {
      const data = msg.data as { success: boolean; error?: string; groupId?: string };
      if (data.success) {
        console.log(`[federation-runner] Registered with group: ${data.groupId}`);
      } else {
        console.error(`[federation-runner] Registration failed: ${data.error}`);
      }
      break;
    }

    case 'federation.member.joined': {
      const data = msg.data as { teamId: string; teamName: string };
      console.log(`[federation-runner] Member joined: ${data.teamName} (${data.teamId})`);
      break;
    }

    case 'federation.member.left': {
      const data = msg.data as { teamId: string };
      console.log(`[federation-runner] Member left: ${data.teamId}`);
      break;
    }

    case 'federation.task.broadcast': {
      const data = msg.data as { taskId: string; title: string; requiredLabels: string[] };
      console.log(`[federation-runner] Task broadcast: ${data.title} (${data.taskId})`);
      break;
    }

    case 'federation.agent.wake': {
      const data = msg.data as FederationAgentWakePayload;
      handleWake(data);
      break;
    }

    case 'federation.task.claim.result': {
      const data = msg.data as FederationTaskClaimResultPayload;
      if (data.success) {
        console.log(
          `[federation-runner] Claim accepted: task=${data.taskId}, status=${data.status}`,
        );
        if (data.autoApproved && data.taskId) {
          // The Hub already woke the agent, so just log here to avoid double wake
          console.log(`[federation-runner] Claim auto-approved, agent will be woken by hub`);
        }
      } else {
        console.warn(`[federation-runner] Claim failed: ${data.error}`);
      }
      break;
    }

    default:
      console.log(`[federation-runner] Unknown message type: ${msg.type}`);
  }
}

// ---------------------------------------------------------------------------
// Heartbeat
// ---------------------------------------------------------------------------

function startHeartbeat(teamId: string): void {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    if (runnerWs?.readyState === WebSocket.OPEN) {
      const msg = buildFedMsg('federation.heartbeat', teamId, {
        teamId,
        timestamp: Date.now(),
      } as FederationHeartbeatPayload);
      runnerWs.send(JSON.stringify(msg));
    }
  }, 30000);
}

function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

// ---------------------------------------------------------------------------
// Poll loop
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 8000; // 8 seconds (jittered slightly by natural drift)

function startPolling(config: RunnerConfig): void {
  if (pollTimer) return;

  let lastTaskCount = -1;

  const doPoll = async () => {
    if (!runnerConfig) return;
    try {
      // Aggregate all labels from local agents
      const db = getDatabase();
      const stmt = db.prepare('SELECT labels FROM agents WHERE team_id = ?');
      stmt.bind([config.teamId]);
      const allLabels = new Set<string>();
      while (stmt.step()) {
        const row = stmt.getAsObject() as { labels: string };
        if (row.labels) {
          try {
            const labels: string[] = JSON.parse(row.labels);
            labels.forEach((l) => allLabels.add(l));
          } catch { /* ignore invalid json */ }
        }
      }
      stmt.free();

      const labelParam = Array.from(allLabels).join(',');
      // Derive HTTP base URL from WSS URL (strip trailing /federation path)
      const hubBaseUrl = config.hubUrl
        .replace('wss://', 'https://')
        .replace('ws://', 'http://')
        .replace(/\/federation$/, '');
      const pollUrl = `${hubBaseUrl}/api/federation/poll?team_id=${encodeURIComponent(config.teamId)}&labels=${encodeURIComponent(labelParam)}`;

      const res = await fetch(pollUrl);
      if (res.ok) {
        const json = (await res.json()) as { tasks: Array<{ taskId: string; title: string; requiredLabels: string[]; sourceTeamId: string }> };
        const taskCount = json.tasks ? json.tasks.length : 0;
        if (taskCount !== lastTaskCount) {
          if (taskCount > 0) {
            console.log(`[federation-runner] Polled ${taskCount} tasks`);
          } else {
            console.log('[federation-runner] Polled 0 tasks');
          }
          lastTaskCount = taskCount;
        }
      }
    } catch (err) {
      // Poll errors are non-fatal; next poll will retry
      console.warn('[federation-runner] Poll error:', (err as Error).message);
    }
  };

  // Immediate first poll, then interval
  doPoll();
  pollTimer = setInterval(doPoll, POLL_INTERVAL_MS);
}

function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

// ---------------------------------------------------------------------------
// Wake handler (forward to local wake-engine)
// ---------------------------------------------------------------------------

async function handleWake(data: FederationAgentWakePayload): Promise<void> {
  console.log(`[federation-runner] Wake agent ${data.agentId} for task ${data.taskId}`);

  try {
    const { wakeAgent } = await import('../modules/wake-engine.js');
    wakeAgent(data.agentId, 'federation_claim', undefined, data.taskId, {
      title: data.context.title,
      sourceTeamId: data.context.sourceTeamId,
    });
  } catch (err) {
    console.error('[federation-runner] Failed to wake agent:', err);
  }
}

// ---------------------------------------------------------------------------
// Publish / Claim helpers
// ---------------------------------------------------------------------------

export function publishTaskToHub(taskId: string): void {
  if (!runnerWs || runnerWs.readyState !== WebSocket.OPEN) {
    console.warn('[federation-runner] Cannot publish task: not connected to hub');
    return;
  }
  // Task index is created locally; Hub picks it up via TaskQueue integration
  console.log(`[federation-runner] Task ${taskId} will be indexed by local TaskQueue`);
}

export function claimTaskOnHub(taskId: string, agentId: string): void {
  if (!runnerWs || runnerWs.readyState !== WebSocket.OPEN) {
    console.warn('[federation-runner] Cannot claim task: not connected to hub');
    return;
  }

  if (!runnerConfig) return;
  const msg = buildFedMsg('federation.task.claim', runnerConfig.teamId, {
    taskId,
    agentId,
  } as FederationTaskClaimPayload);
  runnerWs.send(JSON.stringify(msg));
}
