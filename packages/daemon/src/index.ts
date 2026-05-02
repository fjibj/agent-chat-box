import { DaemonConnection } from './connection.js';
import { detectRuntimes } from './runtime-detector.js';
import { registerDriver, getDriver } from './agent-driver/base.js';
import { ClaudeCodeDriver } from './agent-driver/claude-code.js';
import { CodexDriver } from './agent-driver/codex.js';
import { OpenClawDriver } from './agent-driver/openclaw.js';
import { HermesDriver } from './agent-driver/hermes.js';
import type { WSMessage } from '@agent-chat-box/shared';
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

  // Start
  connection.connect();

  // Graceful shutdown
  const shutdown = () => {
    console.log('[daemon] Shutting down...');
    connection.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
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
      // Future: spawn Claude Code process to handle task
      break;
    }

    case 'task.created': {
      const data = msg.data as { task?: { id?: string; title?: string } };
      console.log(`[daemon] New task: ${data.task?.title} (${data.task?.id})`);
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

  const agentName = `${config.name}-claude`;
  connection.send(MSG.AGENT_HELLO, {
    name: agentName,
    runtime: 'claude',
    role_card: {
      name: agentName,
      description: `Claude Code agent on ${config.name}`,
    },
    capabilities: ['code', 'typescript', 'javascript', 'python', 'analysis'],
  });

  console.log(`[daemon] Registering agent: ${agentName}`);
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
