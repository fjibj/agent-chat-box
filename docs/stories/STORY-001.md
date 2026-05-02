# STORY-001: 项目骨架搭建

**Epic:** EPIC-001 基础设施
**Sprint:** 1
**Points:** 3
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a developer, I want a working monorepo with shared types, so that all packages can communicate with type safety.

---

## Acceptance Criteria

- [ ] pnpm workspace 配置完成（pnpm-workspace.yaml）
- [ ] packages/shared 导出协议类型（WSMessage, Task, Agent, Channel, Machine 等）
- [ ] tsconfig.json strict mode，所有包继承
- [ ] ESLint + Prettier 配置
- [ ] 根 package.json scripts: dev, build, lint, test
- [ ] `pnpm install && pnpm build` 成功
- [ ] .gitignore 配置

---

## Technical Notes

**目录结构:**
```
agent-chat-box/
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.json
├── .eslintrc.json
├── .prettierrc
├── .gitignore
├── packages/
│   ├── shared/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── types.ts      # 协议类型
│   │       ├── constants.ts  # 常量
│   │       └── index.ts
│   ├── server/
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── daemon/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/
│       ├── package.json
│       └── tsconfig.json
```

**shared/types.ts 核心类型:**
```typescript
// WebSocket 消息信封
export interface WSMessage {
  v: 1;
  id?: string;
  type: string;
  ts: number;
  data: unknown;
}

// 机器
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
  status: 'idle' | 'running' | 'offline';
  roleCard: RoleCard;
  capabilities: string[];
  currentTaskId?: string;
}

export interface RoleCard {
  name: string;
  avatar?: string;
  description: string;
  systemPrompt?: string;
}

// 频道
export interface Channel {
  id: string;
  name: string;
  description?: string;
  type: 'group' | 'dm' | 'task';
  createdAt: number;
}

// 消息
export interface Message {
  id: string;
  channelId: string;
  senderId: string;
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

// 任务
export interface Task {
  id: string;
  channelId: string;
  title: string;
  description?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  mode: 'compete' | 'collaborate';
  status: 'pending' | 'claimed' | 'running' | 'completed' | 'failed';
  tags?: string[];
  creatorId: string;
  assigneeId?: string;
  parentTaskId?: string;
  requiredCapabilities?: string[];
  output?: string;
  timeoutSeconds: number;
  maxRetries: number;
  retryCount: number;
  createdAt: number;
  claimedAt?: number;
  completedAt?: number;
}
```

---

## Dependencies

无

---

## Implementation Order

1. 初始化 pnpm-workspace.yaml
2. 创建 packages/shared
3. 定义所有协议类型
4. 配置 tsconfig 继承
5. 配置 ESLint + Prettier
6. 验证 build 成功
