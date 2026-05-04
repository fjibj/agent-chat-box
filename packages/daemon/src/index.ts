import { DaemonConnection } from './connection.js';
import { detectRuntimes } from './runtime-detector.js';
import { registerDriver, getDriver } from './agent-driver/base.js';
import { ClaudeCodeDriver } from './agent-driver/claude-code.js';
import { CodexDriver } from './agent-driver/codex.js';
import { OpenClawDriver } from './agent-driver/openclaw.js';
import { HermesDriver } from './agent-driver/hermes.js';
import { ProcessManager } from './process-manager.js';
import type { WSMessage, Task } from '@agent-chat-box/shared';
import { MSG } from '@agent-chat-box/shared';

// CLI argument parsing (--server, --token, --name) with env var fallback
function parseArgs(): { server: string; token: string; name: string } {
  const args = process.argv.slice(2);
  const parsed: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--help' || args[i] === '-h') {
      console.log(`Usage: acb-daemon [options]

Options:
  --server <url>   Server WebSocket URL (default: ws://localhost:3000)
  --token <key>    Machine API key (required)
  --name <name>    Machine name (default: unknown-machine)
  -h, --help       Show this help

Environment variables: SERVER_URL, MACHINE_TOKEN, MACHINE_NAME (used as fallback)`);
      process.exit(0);
    }
    if (args[i].startsWith('--') && i + 1 < args.length) {
      parsed[args[i].slice(2)] = args[++i];
    }
  }
  return {
    server: parsed.server || process.env.SERVER_URL || 'ws://localhost:3000',
    token: parsed.token || process.env.MACHINE_TOKEN || '',
    name: parsed.name || process.env.MACHINE_NAME || 'unknown-machine',
  };
}

const config = parseArgs();

if (!config.token) {
  console.error('[daemon] --token is required');
  console.error('[daemon] Get token from: POST /api/machines { "name": "my-machine" }');
  console.error('[daemon] Usage: acb-daemon --server <url> --token <key> --name <name>');
  process.exit(1);
}

let connection: DaemonConnection;
let processManager: ProcessManager;
let registeredAgentId: string | null = null;
let agentName: string | null = null;
let agentRuntime: string | null = null;
let joinedChannelId: string | null = null;
let isReplying = false; // Prevent concurrent replies

async function main() {
  // Register agent drivers
  registerDriver(new ClaudeCodeDriver());
  registerDriver(new CodexDriver());
  registerDriver(new OpenClawDriver());
  registerDriver(new HermesDriver());

  // Detect available runtimes
  console.log('[daemon] Detecting runtimes...');
  const runtimes = await detectRuntimes();
  const available = runtimes.filter(rt => rt.available);
  console.log(`[daemon] Found ${available.length} runtime(s): ${available.map(r => r.name).join(', ') || 'none'}`);

  // Create connection
  connection = new DaemonConnection({
    serverUrl: config.server,
    machineToken: config.token,
    onMessage: (msg: WSMessage) => {
      handleServerMessage(msg);
    },
    onConnect: () => {
      console.log('[daemon] Connected, authenticating...');
    },
    onDisconnect: () => {
      console.log('[daemon] Disconnected, will reconnect...');
      registeredAgentId = null;
    },
  });

  // Create process manager
  processManager = new ProcessManager(connection);

  // Start
  connection.connect();

  // Graceful shutdown
  const shutdown = () => {
    console.log('[daemon] Shutting down...');
    processManager.killAll();
    connection.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

/** Try to claim and execute a task */
async function claimAndExecute(task: Task): Promise<void> {
  if (!registeredAgentId || !connection.isConnected()) return;

  // Check if we have a driver for our runtime
  const driver = agentRuntime ? getDriver(agentRuntime) : null;
  if (!driver) {
    console.log(`[daemon] No driver for runtime ${agentRuntime}, skipping task ${task.id}`);
    return;
  }

  // Check if task has required capabilities we don't have
  if (task.requiredCapabilities && task.requiredCapabilities.length > 0) {
    const availableCaps = driver.capabilities;
    const hasAll = task.requiredCapabilities.every(cap => availableCaps.includes(cap));
    if (!hasAll) {
      console.log(`[daemon] Missing capabilities for task ${task.id}, skipping`);
      return;
    }
  }

  // Random delay 0~3s for fair competition (prevents local agent always winning)
  const delay = Math.floor(Math.random() * 3000);
  console.log(`[daemon] Claiming task in ${delay}ms: ${task.title} (${task.id})`);
  await new Promise(r => setTimeout(r, delay));
  connection.send(MSG.TASK_CLAIM, { task_id: task.id });
}

/** Start executing a claimed task */
async function startTaskExecution(task: Task): Promise<void> {
  const driver = agentRuntime ? getDriver(agentRuntime) : null;
  if (!driver) {
    console.error(`[daemon] No driver for runtime ${agentRuntime}`);
    return;
  }

  console.log(`[daemon] Starting execution: ${task.title} (${task.id}) with ${driver.name}`);
  console.log(`[daemon] Task object keys: ${Object.keys(task).join(',')}`);
  console.log(`[daemon] Task.title="${task.title}" Task.description="${task.description}"`);

  const context = `Task: ${task.title}\n${task.description || ''}`;
  try {
    await processManager.start(registeredAgentId!, driver, task, context);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[daemon] Failed to start task ${task.id}: ${errMsg}`);
    // Report failure
    connection.send(MSG.TASK_UPDATE, {
      task_id: task.id,
      status: 'failed',
      output: `Failed to start: ${errMsg}`,
    });
  }
}

/** Handle @mention: invoke agent runtime and reply */
async function handleMentionReply(sender: string, question: string, channelId: string): Promise<void> {
  if (isReplying) return;
  isReplying = true;

  const driver = agentRuntime ? getDriver(agentRuntime) : null;
  if (!driver) {
    connection.send(MSG.MSG_SEND, {
      channel_id: channelId,
      content: `@${sender} 抱歉，当前 agent runtime 不可用。`,
    });
    isReplying = false;
    return;
  }

  const prompt = question || '你好，请简单介绍一下自己。';
  console.log(`[daemon] Invoking ${agentRuntime} for: ${prompt.substring(0, 60)}`);

  try {
    const reply = await driver.chat(prompt);
    // Truncate if too long for chat
    const truncated = reply.length > 2000 ? reply.slice(0, 2000) + '...' : reply;
    connection.send(MSG.MSG_SEND, {
      channel_id: channelId,
      content: `@${sender} ${truncated}`,
    });
    console.log(`[daemon] Reply sent (${truncated.length} chars)`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[daemon] Agent error:`, errMsg);
    connection.send(MSG.MSG_SEND, {
      channel_id: channelId,
      content: `@${sender} 处理出错: ${errMsg.slice(0, 100)}`,
    });
  } finally {
    isReplying = false;
  }
}

/** Handle messages from server */
function handleServerMessage(msg: WSMessage): void {
  switch (msg.type) {
    case 'machine.welcome': {
      console.log(`[daemon] Authenticated as machine: ${(msg.data as { machineName?: string })?.machineName}`);
      // Auto-register agent with first available runtime
      registerAgent();
      break;
    }

    case 'agent.welcome': {
      const data = msg.data as { agent?: { id?: string; name?: string } };
      registeredAgentId = data.agent?.id || null;
      agentName = data.agent?.name || null;
      agentRuntime = 'claude'; // matches registerAgent() runtime
      console.log(`[daemon] Agent registered: ${agentName} (${registeredAgentId}) runtime=${agentRuntime}`);
      // Auto-join general channel
      joinGeneralChannel();
      break;
    }

    case 'channel.subscribed':
    case 'channel.joined': {
      const data = msg.data as { channelId?: string; channel_id?: string; channel_name?: string };
      joinedChannelId = data.channelId || data.channel_id || null;
      console.log(`[daemon] Joined channel: #${data.channel_name || joinedChannelId}`);
      break;
    }

    case 'message.new': {
      const data = msg.data as { message?: { senderId?: string; senderKind?: string; senderName?: string; content?: string; channelId?: string } };
      const m = data.message;
      if (m) {
        const prefix = m.senderKind === 'agent' ? '[agent]' : '[human]';
        const displayName = m.senderName || m.senderId;
        console.log(`[daemon] ${prefix} ${displayName}: ${m.content?.substring(0, 80)}`);

        // Auto-reply if this agent is @mentioned
        if (agentName && m.content && m.senderId !== registeredAgentId && !isReplying) {
          const mentionRegex = /@([\w-]+)/g;
          let mentioned = false;
          let match;
          while ((match = mentionRegex.exec(m.content)) !== null) {
            if (match[1] === agentName) {
              mentioned = true;
              break;
            }
          }
          if (mentioned && connection.isConnected()) {
            const sender = m.senderName || m.senderId || 'someone';
            const replyChannelId = m.channelId || joinedChannelId;
            if (replyChannelId) {
              const question = m.content.replace(/@[\w-]+/g, '').trim();
              handleMentionReply(sender, question, replyChannelId);
            }
          }
        }
      }
      break;
    }

    case 'agent.wake': {
      const data = msg.data as { agentId?: string; agentName?: string; context?: { trigger?: string; taskId?: string } };
      console.log(`[daemon] Wake signal for ${data.agentName}: ${data.context?.trigger}`);
      break;
    }

    case 'task.created': {
      const data = msg.data as { task?: Task };
      const task = data.task;
      if (!task) break;

      console.log(`[daemon] New task: ${task.title} (${task.id}) mode=${task.mode} status=${task.status}`);

      // Skip if already claimed (assign mode pre-claims)
      if (task.status !== 'pending') {
        // If already claimed to us, start execution
        if (task.assigneeId === registeredAgentId) {
          console.log(`[daemon] Task assigned to us, starting execution`);
          startTaskExecution(task);
        }
        break;
      }

      // Auto-claim based on mode
      if (task.mode === 'compete') {
        // Compete: try to claim
        claimAndExecute(task);
      } else if (task.mode === 'assign' && task.assigneeId === registeredAgentId) {
        // Assign to us: claim
        claimAndExecute(task);
      }
      // collaborate mode: skip for now
      break;
    }

    case 'task.claimed': {
      const data = msg.data as { taskId?: string; task_id?: string; agentId?: string; agent_id?: string; task?: Task };
      const claimedAgentId = data.agentId || data.agent_id;
      const taskId = data.taskId || data.task_id;

      // If we claimed it, start execution
      if (claimedAgentId === registeredAgentId && taskId) {
        console.log(`[daemon] We claimed task ${taskId}, starting execution`);
        // Fetch full task details via HTTP then execute
        const httpUrl = config.server.replace('ws://', 'http://').replace('wss://', 'https://').replace(/\/$/, '');
        fetch(`${httpUrl}/api/tasks/${taskId}`)
          .then(res => res.json())
          .then((data) => startTaskExecution(data as Task))
          .catch(err => console.error(`[daemon] Failed to fetch task ${taskId}:`, err.message));
      }
      break;
    }

    case 'task.completed': {
      const data = msg.data as { task_id?: string; taskId?: string };
      console.log(`[daemon] Task completed: ${data.task_id || data.taskId}`);
      break;
    }

    case 'task.running':
    case 'task.updated': {
      // Server ack — no action needed
      break;
    }

    case 'task.failed': {
      const data = msg.data as { task_id?: string; taskId?: string };
      console.log(`[daemon] Task failed: ${data.task_id || data.taskId}`);
      break;
    }

    case 'error': {
      const data = msg.data as { message?: string; code?: string };
      console.error(`[daemon] Server error: ${data.code} - ${data.message}`);
      break;
    }

    default:
      console.log(`[daemon] Unhandled: ${msg.type}`);
      break;
  }
}

/** Register agent with server via agent.hello */
function registerAgent(): void {
  if (!connection.isConnected()) return;

  const name = `${config.name}-claude`;
  connection.send(MSG.AGENT_HELLO, {
    name: name,
    runtime: 'claude',
    role_card: {
      name: name,
      description: `Claude Code agent on ${config.name}`,
    },
    capabilities: ['code', 'typescript', 'javascript', 'python', 'analysis'],
  });

  console.log(`[daemon] Registering agent: ${name}`);
}

/** Join the #general channel */
function joinGeneralChannel(): void {
  if (!connection.isConnected()) return;

  // Fetch general channel id via HTTP (daemon knows server URL)
  const httpUrl = config.server.replace('ws://', 'http://').replace('wss://', 'https://').replace(/\/$/, '');
  fetch(`${httpUrl}/api/channels`)
    .then(res => res.json())
    .then((data: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const channels = data.channels as Array<{ id: string; name: string }>;
      const general = channels.find(c => c.name === 'general');
      if (general) {
        connection.send(MSG.CHANNEL_JOIN, { channel_id: general.id });
        console.log(`[daemon] Joining #general (${general.id})`);
      }
    })
    .catch(err => {
      console.error('[daemon] Failed to fetch channels:', err.message);
    });
}

main().catch((err) => {
  console.error('[daemon] Fatal:', err);
  process.exit(1);
});
