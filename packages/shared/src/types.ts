// WebSocket message envelope
export interface WSMessage {
  v: 1;
  id?: string;
  type: string;
  ts: number;
  data: unknown;
}

// Machine
export interface Machine {
  id: string;
  name: string;
  status: 'online' | 'offline';
  lastHeartbeat: number;
  createdAt: number;
}

// Agent
export interface Agent {
  id: string;
  machineId: string;
  name: string;
  runtime: 'claude' | 'codex' | 'openclaw' | 'hermes';
  status: 'sleeping' | 'awake' | 'running' | 'offline';
  roleCard: RoleCard;
  capabilities: string[];
  currentTaskId?: string;
  lastSleepAt?: number;
  lastWakeAt?: number;
}

export interface RoleCard {
  name: string;
  avatar?: string;
  description: string;
  systemPrompt?: string;
}

// Channel
export interface Channel {
  id: string;
  name: string;
  description?: string;
  type: 'group' | 'dm' | 'task';
  createdAt: number;
}

// Message
export interface Message {
  id: string;
  channelId: string;
  senderId: string;
  senderName?: string;
  senderKind: 'human' | 'agent' | 'system';
  content: string;
  mentions?: string[];
  replyTo?: string;
  attachments?: Attachment[];
  createdAt: number;
}

export interface Attachment {
  id: string;
  url: string;
  name: string;
  mime: string;
  size: number;
}

// Task
export interface Task {
  id: string;
  channelId: string;
  title: string;
  description?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  mode: 'compete' | 'assign' | 'collaborate';
  status: 'pending' | 'claimed' | 'running' | 'decomposing' | 'verifying' | 'completed' | 'failed';
  tags?: string[];
  creatorId: string;
  assigneeId?: string;
  parentTaskId?: string;
  depth?: number;
  requiredCapabilities?: string[];
  output?: string;
  timeoutSeconds: number;
  maxRetries: number;
  retryCount: number;
  createdAt: number;
  claimedAt?: number;
  completedAt?: number;
}

// Task claim result
export interface ClaimResult {
  success: boolean;
  error?: 'NOT_FOUND' | 'ALREADY_CLAIMED' | 'CAPABILITY_MISMATCH';
  claimedBy?: string;
  task?: Task;
}

// Agent hello payload
export interface AgentHelloPayload {
  machineId: string;
  machineName: string;
  agentName: string;
  runtime: Agent['runtime'];
  capabilities: string[];
  roleCard: RoleCard;
}

// Agent wake payload (server → agent)
export interface AgentWakePayload {
  reason: 'mention' | 'dm' | 'task_assigned' | 'task_available';
  taskId?: string;
  channelId?: string;
  recentMessages?: Message[];
  context?: string;
}

// Task create input
export interface CreateTaskInput {
  channelId: string;
  title: string;
  description?: string;
  priority?: Task['priority'];
  mode?: Task['mode'];
  assigneeId?: string;
  tags?: string[];
  requiredCapabilities?: string[];
  timeoutSeconds?: number;
  maxRetries?: number;
}

// Task update input
export interface UpdateTaskInput {
  status?: Task['status'];
  output?: string;
  retry_count?: number;
}

// Subtask input
export interface SubtaskInput {
  channelId: string;
  title: string;
  description?: string;
  assigneeId?: string;
  creatorId: string;
}
