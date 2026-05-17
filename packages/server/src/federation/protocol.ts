// Federation Gateway Protocol
// Inspired by slock.ai single-bus design: { v, id, type, ts, from, to?, data }
// All federation message types are prefixed with 'federation.'

export type FederationMessageType =
  | 'federation.register'
  | 'federation.register.result'
  | 'federation.heartbeat'
  | 'federation.member.joined'
  | 'federation.member.left'
  | 'federation.task.broadcast'
  | 'federation.task.claim'
  | 'federation.agent.wake'
  | 'federation.member.leave';

/** Federation message envelope — shared by Hub, Runner, and local WS handler. */
export interface FederationMessage {
  /** Protocol version. Current = 1. */
  v: number;
  /** Unique message id, prefix: fed_ */
  id: string;
  /** Message type, always starts with 'federation.' */
  type: FederationMessageType;
  /** Unix timestamp in milliseconds. */
  ts: number;
  /** Source team id. */
  from: string;
  /** Optional target team id (point-to-point routing). */
  to?: string;
  /** Type-specific payload. */
  data: unknown;
}

// ---------------------------------------------------------------------------
// Payload types for each message kind
// ---------------------------------------------------------------------------

/** Runner → Hub: initial registration handshake. */
export interface FederationRegisterPayload {
  inviteCode: string;
  teamId: string;
  labels: string[];
  roleCard?: FederationRoleCard;
}

/** Hub → Runner: registration result. */
export interface FederationRegisterResultPayload {
  success: boolean;
  error?: string;
  groupId?: string;
}

/** Runner → Hub: periodic heartbeat. */
export interface FederationHeartbeatPayload {
  teamId: string;
  timestamp: number;
}

/** Hub → All Runners: a new member joined the group. */
export interface FederationMemberJoinedPayload {
  teamId: string;
  teamName: string;
}

/** Hub → All Runners: a member left the group. */
export interface FederationMemberLeftPayload {
  teamId: string;
}

/** Hub → Runner: a new group task is available (optional push; primary discovery is via poll). */
export interface FederationTaskBroadcastPayload {
  taskId: string;
  title: string;
  requiredLabels: string[];
  sourceTeamId: string;
}

/** Runner → Hub: agent wants to claim a task. */
export interface FederationTaskClaimPayload {
  taskId: string;
  agentId: string;
  teamId?: string;
}

/** Hub → Runner: wake an agent to execute a federated task. */
export interface FederationAgentWakePayload {
  agentId: string;
  taskId: string;
  context: {
    title: string;
    requiredLabels: string[];
    sourceTeamId: string;
  };
}

// ---------------------------------------------------------------------------
// Role Card (extends local RoleCard with federation fields)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _msgIdCounter = 0;

/** Generate a unique federation message id. */
export function genFedMsgId(): string {
  return `fed_${Date.now().toString(36)}_${(_msgIdCounter++).toString(36)}`;
}

/** Build a federation message envelope. */
export function buildFedMsg(
  type: FederationMessageType,
  from: string,
  data: unknown,
  to?: string
): FederationMessage {
  return {
    v: 1,
    id: genFedMsgId(),
    type,
    ts: Date.now(),
    from,
    to,
    data,
  };
}

/** Parse and validate a raw JSON string into a FederationMessage. */
export function parseFedMsg(raw: string): FederationMessage | null {
  try {
    const obj = JSON.parse(raw) as FederationMessage;
    if (
      typeof obj.v === 'number' &&
      typeof obj.id === 'string' &&
      typeof obj.type === 'string' &&
      typeof obj.ts === 'number' &&
      typeof obj.from === 'string' &&
      obj.type.startsWith('federation.')
    ) {
      return obj;
    }
    return null;
  } catch {
    return null;
  }
}
