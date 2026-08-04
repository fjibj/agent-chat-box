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
  teamId?: string | null;
  name: string;
  runtime: 'claude' | 'codex' | 'openclaw' | 'hermes';
  status: 'sleeping' | 'awake' | 'running' | 'offline';
  roleCard: RoleCard;
  capabilities: string[];
  labels?: string[];
  currentTaskId?: string;
  lastSleepAt?: number;
  lastWakeAt?: number;
}

// Team
export interface Team {
  id: string;
  name: string;
  ownerUserId: string;
  createdAt: number;
}

// Team member
export interface TeamMember {
  teamId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: number;
}

// Domain (multi-group alliance layer)
export interface Domain {
  id: string;
  name: string;
  description?: string;
  contractYaml?: string;
  ownerGroupId: string;
  inviteCode?: string;
  inviteCodeExpiresAt?: number;
  inviteCodeMaxUses?: number | null;
  inviteCodeUses?: number;
  createdAt: number;
}

// Domain member (a group inside a domain)
export interface DomainMember {
  domainId: string;
  groupId: string;
  role: 'owner' | 'member';
  capabilities?: string[];
  joinedAt: number;
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
  status:
    | 'pending'
    | 'pending_authorization'
    | 'claimed'
    | 'running'
    | 'decomposing'
    | 'verifying'
    | 'completed'
    | 'failed';
  tags?: string[];
  creatorId: string;
  assigneeId?: string;
  parentTaskId?: string;
  depth?: number;
  requiredCapabilities?: string[];
  isGroupTask?: boolean;
  sourceTeamId?: string;
  groupId?: string;
  authorizationStatus?: 'none' | 'pending' | 'approved' | 'rejected' | 'expired';
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
  reason: 'mention' | 'dm' | 'task_assigned' | 'task_available' | 'federation_claim';
  taskId?: string;
  channelId?: string;
  recentMessages?: Message[];
  context?: string;
}

// Federation message envelope (slock.ai inspired)
export type FederationMessageType =
  | 'federation.register'
  | 'federation.register.result'
  | 'federation.heartbeat'
  | 'federation.member.joined'
  | 'federation.member.left'
  | 'federation.task.broadcast'
  | 'federation.task.claim'
  | 'federation.agent.wake';

export interface FederationMessage {
  v: number;
  id: string;
  type: FederationMessageType;
  ts: number;
  from: string;
  to?: string;
  data: unknown;
}

export interface FederationRoleCard {
  name: string;
  teamId: string;
  groupRoles: Array<{
    groupId: string;
    role: 'owner' | 'admin' | 'member';
    reputationScore: number;
  }>;
  labels: string[];
  capabilities: string[];
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
