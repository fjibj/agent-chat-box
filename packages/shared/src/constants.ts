// Protocol version
export const PROTOCOL_VERSION = 1;

// Reconnect backoff: 1s → 2s → 4s → 8s → 16s → 30s (cap)
export const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 16000, 30000] as const;

// Heartbeat interval (server and daemon both use this)
export const HEARTBEAT_INTERVAL_MS = 30_000;

// Heartbeat timeout — consider connection dead after this
export const HEARTBEAT_TIMEOUT_MS = 90_000;

// Default task timeout (1 hour)
export const DEFAULT_TASK_TIMEOUT_SECONDS = 3600;

// Default max retries
export const DEFAULT_MAX_RETRIES = 3;

// Task timeout check interval
export const TASK_TIMEOUT_CHECK_INTERVAL_MS = 10_000;

// API key prefix
export const API_KEY_PREFIX = 'sk_';

// Default server port
export const DEFAULT_SERVER_PORT = 3210;

// Wake context: recent message count to bundle
export const WAKE_CONTEXT_MESSAGE_COUNT = 20;

// Agent runtime types
export const AGENT_RUNTIMES = ['claude', 'codex', 'openclaw', 'hermes'] as const;

// Message types (WS protocol)
export const MSG = {
  // Agent lifecycle
  AGENT_HELLO: 'agent.hello',
  AGENT_HEARTBEAT: 'agent.heartbeat',
  AGENT_SLEEP: 'agent.sleep',
  AGENT_WAKE: 'agent.wake',
  AGENT_BYE: 'agent.bye',

  // Messaging
  MSG_SEND: 'message.send',
  MSG_ACK: 'message.ack',
  MSG_NEW: 'message.new',
  MSG_HISTORY: 'message.history',
  MSG_REACTION: 'message.reaction',

  // Task
  TASK_CREATE: 'task.create',
  TASK_CREATED: 'task.created',
  TASK_CLAIM: 'task.claim',
  TASK_CLAIMED: 'task.claimed',
  TASK_UPDATE: 'task.update',
  TASK_UPDATED: 'task.updated',
  TASK_COMPLETED: 'task.completed',
  TASK_FAILED: 'task.failed',
  TASK_SUBTASKS: 'task.subtasks',
  TASK_RETRIED: 'task.retried',

  // Channel
  CHANNEL_CREATE: 'channel.create',
  CHANNEL_CREATED: 'channel.created',
  CHANNEL_JOIN: 'channel.join',
  CHANNEL_LEAVE: 'channel.leave',

  // System
  ERROR: 'error',
  PING: 'ping',
  PONG: 'pong',

  // Human identity
  HUMAN_IDENTIFY: 'human.identify',
  HUMAN_IDENTIFIED: 'human.identified',
} as const;
