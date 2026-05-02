# System Architecture: Agent Chat Box

**Date:** 2026-05-01
**Architect:** Administrator
**Version:** 1.0
**Project Type:** web-app
**Project Level:** 3
**Status:** Draft

---

## Document Overview

本文档定义 Agent Chat Box 的系统架构，作为实现的技术蓝图。架构设计满足 PRD 中定义的所有功能和非功能需求。

**Related Documents:**
- PRD: `docs/prd-agent-chat-box-2026-05-01.md`
- 技术设计: `docs/design-spec.md`
- 竞品调研: `docs/research-comparative-analysis.md`

---

## Executive Summary

Agent Chat Box 采用**模块化单体 + 反向连接 Daemon** 架构。中央服务器（Fastify + ws + SQLite）作为消息路由和任务调度中心，Daemon 运行在各目标机器上主动连接服务器（穿透 NAT），Web UI 通过浏览器访问。协议设计参考 slock-clone（Agent 一等成员、Sleep/Wake），Daemon 架构参考 Multica/zouk-daemon。

---

## Architectural Drivers

这些需求对架构有重大影响：

| 驱动 | 需求 | 架构影响 |
|------|------|----------|
| AD-1 | NFR-003 自动重连 | Daemon 需指数退避重连 + 状态恢复 |
| AD-2 | NFR-001 消息延迟 <500ms | WebSocket 单总线，内存消息路由 |
| AD-3 | NFR-005 零依赖部署 | SQLite 单文件，无外部服务 |
| AD-4 | FR-007 任务争抢原子性 | 事务保证 claim 原子操作 |
| AD-5 | FR-005 Sleep/Wake | 服务器控制 Agent 唤醒，携带上下文 |
| AD-6 | FR-009 多 Agent 驱动 | 插件化驱动架构 |
| AD-7 | 跨机穿透 NAT | Daemon 反向连接，不出站连接 |

---

## System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Web Browser                                  │
│                    React + Vite + Tailwind                           │
│                 http://server-ip:5173                                │
└────────────────────────┬────────────────────────────────────────────┘
                         │ HTTP REST + WebSocket (/ws)
┌────────────────────────┴────────────────────────────────────────────┐
│                      Central Server                                  │
│               Fastify + ws + better-sqlite3                          │
│                       Port 3000                                      │
│                                                                      │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────┐ │
│  │ TaskQueue   │ │ AgentReg     │ │ MsgRouter    │ │ Workspace   │ │
│  │ 争抢+协作   │ │ 注册+心跳    │ │ 路由+Wake    │ │ 频道+成员   │ │
│  └─────────────┘ └──────────────┘ └──────────────┘ └─────────────┘ │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    SQLite Database                              │ │
│  │  machines | agents | channels | messages | tasks | members     │ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────┬───────────────────┬───────────────────┬──────────────────────┘
       │                   │                   │
       │ WebSocket         │ WebSocket         │ WebSocket
       │ /daemon/connect   │ /daemon/connect   │ /daemon/connect
       │                   │                   │
┌──────┴──────┐     ┌──────┴──────┐     ┌──────┴──────┐
│  Daemon A   │     │  Daemon B   │     │  Daemon C   │
│  家用电脑   │     │  公司电脑   │     │  云服务器   │
│             │     │             │     │             │
│ RuntimeDet  │     │ RuntimeDet  │     │ RuntimeDet  │
│ ┌─────────┐│     │ ┌─────────┐│     │ ┌─────────┐│
│ │claude   ││     │ │codex    ││     │ │hermes   ││
│ │openclaw ││     │ │openclaw ││     │ │claude   ││
│ └─────────┘│     │ └─────────┘│     │ └─────────┘│
└─────────────┘     └─────────────┘     └─────────────┘
```

### Architectural Pattern

**Pattern:** 模块化单体 + 反向连接 Daemon

**Rationale:**
- 模块化单体：MVP 阶段避免微服务复杂度，模块边界清晰
- 反向连接 Daemon：解决 NAT 穿透，Daemon 主动连服务器
- 参考 slock-clone 的单服务器 + WebSocket 总线设计
- 参考 Multica 的 Daemon 架构
- 参考 zouk-daemon 的 MCP Tool Server 模式

---

## Technology Stack

### Frontend

**Choice:** React 19 + Vite 6 + Tailwind CSS 4

**Rationale:**
- React 生态成熟，组件库丰富
- Vite 开发体验最佳，HMR 快
- Tailwind 快速实现简洁大气的 UI
- TypeScript strict mode 保证类型安全

**Trade-offs:**
- ✓ 开发效率高，社区资源多
- ✗ 包体积比 Preact/Solid 大（MVP 可接受）

### Backend (Server)

**Choice:** Fastify + ws + better-sqlite3

**Rationale:**
- Fastify 性能优于 Express，schema 验证内置
- ws 库轻量，纯 WebSocket 实现
- better-sqlite3 同步 API，零配置，单文件数据库
- 参考 slock-clone 的无框架设计，但用 Fastify 获得更好的路由和中间件支持

**Trade-offs:**
- ✓ 零外部依赖，`pnpm dev` 即跑
- ✗ SQLite 不适合高并发写入（MVP 阶段足够）

### Backend (Daemon)

**Choice:** Node.js + ws

**Rationale:**
- 与服务器同语言，共享 packages/shared 类型
- ws 库用于 WebSocket 客户端
- 子进程管理用 Node.js child_process

**Trade-offs:**
- ✓ 统一技术栈，代码复用
- ✗ Node.js 子进程管理不如 Go 稳定（可接受）

### Database

**Choice:** SQLite (better-sqlite3)

**Rationale:**
- NFR-005 要求零依赖部署
- 单文件数据库，备份只需复制文件
- better-sqlite3 同步 API，代码简洁
- FTS5 支持全文搜索（消息搜索）

**Trade-offs:**
- ✓ 零配置，单文件
- ✗ 不支持并发写入（WAL 模式下读写可并发）

### Development & Deployment

| 工具 | 用途 |
|------|------|
| pnpm 10+ | monorepo 包管理 |
| TypeScript 5.x strict | 类型安全 |
| ESLint + Prettier | 代码风格 |
| Vitest | 单元测试 |
| tsup | Daemon 构建 |
| Vite | Web UI 构建 |

---

## System Components

### Component 1: Central Server

**Purpose:** 消息路由、任务调度、Agent 注册的中心

**Responsibilities:**
- WebSocket 连接管理（人类 + Daemon）
- 消息路由（频道广播、DM 点对点）
- 任务队列管理（创建、争抢、协作）
- Agent 注册和心跳
- Sleep/Wake 引擎
- HTTP REST API（认证、历史、文件）

**Interfaces:**
- WebSocket `/ws` — 人类客户端
- WebSocket `/daemon/connect` — Daemon 连接
- HTTP `/api/*` — REST API

**Dependencies:** SQLite 数据库

**FRs Addressed:** FR-001, FR-004, FR-005, FR-006, FR-007, FR-008, FR-010

---

### Component 2: WebSocket Handler (人类)

**Purpose:** 处理人类客户端的 WebSocket 连接

**Responsibilities:**
- 认证（auth.login）
- 频道订阅管理
- 消息发送/接收
- 任务创建/查看
- 在线状态广播

**Interfaces:**
- 接收：auth.login, message.send, channel.subscribe, task.create
- 推送：message.new, task.update, presence.update

**Dependencies:** MsgRouter, TaskQueue, AgentReg

**FRs Addressed:** FR-004, FR-006

---

### Component 3: WebSocket Handler (Daemon)

**Purpose:** 处理 Daemon 的 WebSocket 连接

**Responsibilities:**
- 机器认证（API Key）
- Agent 注册（agent.hello）
- 心跳处理
- 任务分发
- 状态同步

**Interfaces:**
- 接收：agent.hello, agent.sleep, agent.thinking, task.claim, task.update, message.send
- 推送：agent.wake, task.assign, message.new

**Dependencies:** AgentReg, TaskQueue, MsgRouter

**FRs Addressed:** FR-001, FR-003, FR-005, FR-007, FR-009

---

### Component 4: TaskQueue

**Purpose:** 任务生命周期管理

**Responsibilities:**
- 任务 CRUD
- 竞争模式：原子 claim 操作
- 协作模式：子任务分解和跟踪
- 超时检测和重试
- 任务状态机维护

**Interfaces:**
- 内部 API：create, claim, update, complete, fail, decompose

**Dependencies:** SQLite

**FRs Addressed:** FR-006, FR-007, FR-008, FR-015, FR-016, FR-018

**关键设计 — 争抢原子性:**
```sql
-- claim 操作使用事务保证原子性
BEGIN IMMEDIATE;
UPDATE tasks SET status = 'claimed', assignee_id = ?, claimed_at = ?
WHERE id = ? AND status = 'pending';
-- 如果 affected_rows = 0，说明已被他人 claim
COMMIT;
```

---

### Component 5: AgentReg (Agent Registry)

**Purpose:** Agent 注册、心跳、状态管理

**Responsibilities:**
- Agent 注册/注销
- 心跳超时检测
- 在线状态管理
- 能力标签存储

**Interfaces:**
- 内部 API：register, unregister, heartbeat, getStatus, getByCapabilities

**Dependencies:** SQLite

**FRs Addressed:** FR-002, FR-003, FR-016

---

### Component 6: MsgRouter (Message Router)

**Purpose:** 消息路由和 Sleep/Wake 引擎

**Responsibilities:**
- 频道消息广播
- DM 点对点路由
- @mention 检测
- Sleep/Wake 触发
- 上下文打包（wake 时携带最近消息）

**Interfaces:**
- 内部 API：broadcast, direct, checkMentions, wakeAgent

**Dependencies:** AgentReg, SQLite

**FRs Addressed:** FR-004, FR-005, FR-012

**Sleep/Wake 流程:**
```
message.send (human @Claude-1)
  → MsgRouter.checkMentions()
  → 发现 @Claude-1 处于 SLEEPING
  → MsgRouter.wakeAgent(Claude-1, trigger, context)
  → 推送 agent.wake + 最近 10 条消息 + 线程
  → Claude-1 转为 AWAKE
```

---

### Component 7: Daemon

**Purpose:** 机器端守护进程，连接服务器，管理 Agent 进程

**Responsibilities:**
- WebSocket 连接管理（自动重连）
- 运行时检测（claude/codex/openclaw/hermes）
- Agent 进程生命周期管理
- 任务执行和进度回报
- 流式输出处理

**Interfaces:**
- WebSocket 连接到服务器
- 子进程 spawn 管理

**依赖:** Agent Driver

**FRs Addressed:** FR-001, FR-002, FR-009

**子模块:**
```
daemon/src/
├── connection.ts          # WebSocket 连接 + 自动重连
├── runtime-detector.ts    # 检测本机 Agent CLI
├── process-manager.ts     # 子进程生命周期
└── agent-driver/
    ├── base.ts            # 驱动基类
    ├── claude-code.ts     # Claude Code 驱动
    ├── codex.ts           # Codex 驱动
    ├── openclaw.ts        # OpenClaw 驱动
    └── hermes.ts          # Hermes 驱动
```

---

### Component 8: Agent Driver（驱动适配器）

**Purpose:** 适配不同 Agent CLI 的通信协议

**Responsibilities:**
- 检测 Agent 是否可用
- 启动 Agent 进程
- 解析 Agent 输出
- 管理 Agent 生命周期

**Interfaces:**
```typescript
interface AgentDriver {
  name: string;
  binary: string;
  capabilities: string[];
  detect(): Promise<boolean>;
  start(task: Task, context: Context): Promise<AgentProcess>;
  stop(process: AgentProcess): Promise<void>;
}

interface AgentProcess {
  id: string;
  status: 'running' | 'completed' | 'failed';
  onOutput(callback: (chunk: string) => void): void;
  onComplete(callback: (result: TaskResult) => void): void;
  onError(callback: (error: Error) => void): void;
}
```

**四种驱动实现:**

| Agent | 启动方式 | 输出解析 | 特点 |
|-------|----------|----------|------|
| Claude Code | `claude --print --output-format stream-json` | JSON stream | 流式输出，支持 MCP |
| Codex | `codex --quiet` | stdout text | 进程级隔离 |
| OpenClaw | 待调研 | 待调研 | 需适配其协议 |
| Hermes | 待调研 | 待调研 | 需适配其协议 |

**FRs Addressed:** FR-009

---

### Component 9: Web UI

**Purpose:** 浏览器端管理界面

**Responsibilities:**
- 聊天界面（频道、DM、消息流）
- 任务看板（争抢/协作视图）
- Agent 管理面板
- 设置页面

**Interfaces:**
- WebSocket 连接到服务器
- HTTP REST API

**依赖:** Central Server

**FRs Addressed:** FR-010, FR-011, FR-014

---

## Data Architecture

### Data Model

```
Machine (机器)
  ├── id, name, api_key_hash, status, last_heartbeat
  └── has many: Agent

Agent (Agent 实例)
  ├── id, machine_id, name, runtime, status, role_card, capabilities
  └── belongs to: Machine
  └── has many: Task (assigned)

Channel (频道)
  ├── id, name, description, type (group/dm/task)
  └── has many: Member, Message

ChannelMember (频道成员)
  ├── channel_id, member_id, member_kind (human/agent)
  └── belongs to: Channel

Message (消息)
  ├── id, channel_id, sender_id, sender_kind, content, mentions, reply_to
  └── belongs to: Channel

Task (任务)
  ├── id, channel_id, title, description, priority, mode, status, tags
  ├── creator_id, assignee_id, parent_task_id, output
  └── belongs to: Channel, Agent (assignee)
  └── has many: Task (subtasks, via parent_task_id)
```

### Database Design

```sql
-- 机器表
CREATE TABLE machines (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  api_key_hash TEXT NOT NULL,
  status TEXT DEFAULT 'offline',
  last_heartbeat INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Agent 表
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  machine_id TEXT REFERENCES machines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  runtime TEXT NOT NULL CHECK(runtime IN ('claude','codex','openclaw','hermes')),
  status TEXT DEFAULT 'idle' CHECK(status IN ('idle','running','offline')),
  role_card TEXT, -- JSON
  capabilities TEXT, -- JSON array
  current_task_id TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

-- 频道表
CREATE TABLE channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT DEFAULT 'group' CHECK(type IN ('group','dm','task')),
  created_at INTEGER DEFAULT (unixepoch())
);

-- 频道成员表
CREATE TABLE channel_members (
  channel_id TEXT REFERENCES channels(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL,
  member_kind TEXT NOT NULL CHECK(member_kind IN ('human','agent')),
  joined_at INTEGER DEFAULT (unixepoch()),
  PRIMARY KEY (channel_id, member_id)
);

-- 消息表
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  channel_id TEXT REFERENCES channels(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  sender_kind TEXT NOT NULL CHECK(sender_kind IN ('human','agent','system')),
  content TEXT NOT NULL,
  mentions TEXT, -- JSON array
  reply_to TEXT,
  attachments TEXT, -- JSON array
  created_at INTEGER DEFAULT (unixepoch())
);

-- 任务表
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  channel_id TEXT REFERENCES channels(id),
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent')),
  mode TEXT DEFAULT 'compete' CHECK(mode IN ('compete','collaborate')),
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','claimed','running','completed','failed')),
  tags TEXT, -- JSON array
  creator_id TEXT NOT NULL,
  assignee_id TEXT REFERENCES agents(id),
  parent_task_id TEXT REFERENCES tasks(id),
  required_capabilities TEXT, -- JSON array
  output TEXT,
  timeout_seconds INTEGER DEFAULT 3600,
  max_retries INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  claimed_at INTEGER,
  completed_at INTEGER
);

-- 索引
CREATE INDEX idx_messages_channel ON messages(channel_id, created_at);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_channel ON tasks(channel_id);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX idx_agents_machine ON agents(machine_id);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_runtime ON agents(runtime);
CREATE INDEX idx_channel_members ON channel_members(member_id);

-- 全文搜索（消息）
CREATE VIRTUAL TABLE messages_fts USING fts5(content, content=messages, content_rowid=rowid);
```

### Data Flow

**消息流:**
```
人类/Agent → WebSocket → Server → MsgRouter → 频道订阅者
                                    ↓
                              SQLite (持久化)
```

**任务流:**
```
人类创建任务 → Server.TaskQueue → 广播到频道
                                    ↓
Agent claim → Server.TaskQueue (原子操作) → 广播 claimed
                                    ↓
Agent 执行 → task.update (进度) → Server → 广播
                                    ↓
Agent 完成 → task.completed → Server → 广播 + 通知
```

**Daemon 连接流:**
```
Daemon 启动 → 连接 ws://server:3000/daemon/connect
  → 发送 machine_token
  → Server 验证，返回 machine_id
  → Daemon 检测运行时
  → 发送 agent.hello (每个 Agent)
  → Server 注册 Agent，返回 context_window
  → Agent 进入 AWAKE/SLEEPING
```

---

## API Design

### API Architecture

- **协议:** WebSocket（实时）+ HTTP REST（管理）
- **编码:** UTF-8 JSON
- **认证:** Daemon 用 API Key，人类用用户名/密码 + token
- **信封格式:** `{ v: 1, id?, type, ts, data }`

### WebSocket 消息类型

#### 人类客户端 (/ws)

| 方向 | 类型 | 说明 |
|------|------|------|
| → | auth.login | 登录 |
| ← | auth.ok | 登录成功，返回 workspace/channel/member 数据 |
| → | message.send | 发送消息 |
| ← | message.ack | 消息确认 |
| ↓ | message.new | 新消息推送 |
| → | channel.subscribe | 订阅频道 |
| → | channel.create | 创建频道 |
| → | task.create | 创建任务 |
| ↓ | task.created | 任务创建通知 |
| ↓ | task.claimed | 任务被领取通知 |
| ↓ | task.completed | 任务完成通知 |
| ↓ | presence.update | 在线状态更新 |

#### Daemon 连接 (/daemon/connect)

| 方向 | 类型 | 说明 |
|------|------|------|
| → | machine.auth | 机器认证 |
| ← | machine.welcome | 认证成功 |
| → | agent.hello | Agent 注册 |
| ← | agent.welcome | 注册成功，返回订阅和上下文 |
| → | agent.sleep | Agent 休眠 |
| ← | agent.wake | 唤醒 Agent（含上下文） |
| → | agent.thinking | 打字指示器 |
| → | task.claim | 争抢任务 |
| ← | task.claimed | 争抢成功/失败 |
| → | task.update | 任务进度更新 |
| → | task.completed | 任务完成 |
| → | message.send | Agent 发送消息 |
| ↓ | message.new | 接收新消息 |
| ← | ping | 心跳 |
| → | pong | 心跳回复 |

### HTTP REST API

```
POST   /api/auth/login          # 人类登录
POST   /api/auth/register       # 人类注册
GET    /api/auth/me             # 当前用户信息

GET    /api/machines            # 机器列表
POST   /api/machines            # 注册机器（返回 API Key）
PATCH  /api/machines/:id        # 更新机器
DELETE /api/machines/:id        # 删除机器

GET    /api/agents              # Agent 列表
POST   /api/agents              # 创建 Agent
PATCH  /api/agents/:id          # 更新 Agent
DELETE /api/agents/:id          # 删除 Agent

GET    /api/channels            # 频道列表
POST   /api/channels            # 创建频道
GET    /api/channels/:id        # 频道详情
GET    /api/channels/:id/messages  # 历史消息（分页）

GET    /api/tasks               # 任务列表
POST   /api/tasks               # 创建任务
GET    /api/tasks/:id           # 任务详情
GET    /api/tasks/:id/timeline  # 任务时间线

POST   /api/uploads             # 文件上传
GET    /api/uploads/:id         # 文件下载

GET    /api/version             # 服务器版本
```

---

## Non-Functional Requirements Coverage

### NFR-001: 消息延迟 <500ms

**Requirement:** WebSocket 消息延迟 P95 < 500ms

**Architecture Solution:**
- WebSocket 单总线，消息直接路由，无中间队列
- 内存中维护频道订阅者列表，避免每次查询数据库
- SQLite WAL 模式，读写可并发

**Validation:** 发送 100 条消息，测量端到端延迟

---

### NFR-002: 并发连接 50+

**Requirement:** 支持 50 个并发 WebSocket 连接

**Architecture Solution:**
- ws 库单线程事件循环，50 连接轻松处理
- SQLite WAL 模式支持并发读
- 每连接内存开销 < 1MB

**Validation:** 50 个并发连接压测 24 小时

---

### NFR-003: 自动重连

**Requirement:** Daemon 断线后自动重连，指数退避

**Architecture Solution:**
```typescript
// connection.ts
const delays = [1000, 2000, 4000, 8000, 16000, 30000]; // max 30s
let attempt = 0;

function reconnect() {
  const delay = delays[Math.min(attempt, delays.length - 1)];
  setTimeout(() => {
    attempt++;
    connect();
  }, delay);
}

function onConnect() {
  attempt = 0; // 重置
  // 重新注册所有 Agent
}
```

**Validation:** 断开网络 → 恢复 → 验证自动重连和状态恢复

---

### NFR-004: 认证安全

**Requirement:** API Key + 密码 scrypt 哈希

**Architecture Solution:**
- API Key 格式：`sk_` + 32 字节 base64
- 存储：scrypt 哈希，不存明码
- 人类密码：scrypt 哈希
- Token：JWT，15 分钟过期

**Validation:** 认证失败测试，Key 泄露轮换测试

---

### NFR-005: 零依赖部署

**Requirement:** `pnpm dev` 一键启动

**Architecture Solution:**
- SQLite 单文件，无需安装数据库
- 无 Redis/MQ 等外部依赖
- 前端 Vite dev server 内嵌
- Daemon 单命令启动

**Validation:** 全新机器 `git clone && pnpm install && pnpm dev` 跑通

---

### NFR-006: TypeScript strict

**Requirement:** 所有代码 TypeScript strict mode

**Architecture Solution:**
- tsconfig.json `strict: true`
- packages/shared 共享类型
- ESLint + Prettier 统一风格

**Validation:** `tsc --noEmit` 零错误

---

### NFR-007: 浏览器兼容

**Requirement:** Chrome/Firefox/Safari/Edge 最新两版

**Architecture Solution:**
- React 19 + Vite 6 自动 polyfill
- Tailwind 响应式布局
- 最小宽度 1024px

**Validation:** 多浏览器测试

---

### NFR-008: Agent 驱动可扩展

**Requirement:** 新增 Agent 只需实现接口

**Architecture Solution:**
```typescript
// agent-driver/base.ts
export abstract class BaseAgentDriver implements AgentDriver {
  abstract name: string;
  abstract binary: string;
  abstract capabilities: string[];
  abstract detect(): Promise<boolean>;
  abstract start(task: Task, ctx: Context): Promise<AgentProcess>;
  abstract stop(proc: AgentProcess): Promise<void>;
}

// 自动注册
const drivers = [new ClaudeCodeDriver(), new CodexDriver(), new OpenClawDriver(), new HermesDriver()];
```

**Validation:** 实现新驱动只需继承 BaseAgentDriver

---

## Security Architecture

### Authentication

**Daemon 认证:**
```
Daemon → machine.auth { machine_token }
Server → 验证 token hash → machine.welcome { machine_id }
```

**人类认证:**
```
Client → POST /api/auth/login { email, password }
Server → 验证 scrypt hash → { access_token, refresh_token }
Client → auth.login { access_token }
```

### Authorization

- 机器只能管理自己的 Agent
- 人类可以操作所有资源（MVP 无多用户权限）
- Agent 只能操作被分配的任务

### Security Best Practices

- API Key 只在创建时显示一次
- 密码 scrypt 哈希存储
- WebSocket 消息大小限制 1MB
- 文件上传大小限制 10MB
- 输入验证（Zod schema）

---

## Scalability & Performance

### Scaling Strategy

**MVP 阶段（单服务器）:**
- SQLite 支持 ~100 并发读
- 单服务器支持 ~50 WebSocket 连接
- 足够 10 台机器、20 个 Agent

**未来扩展路径:**
- SQLite → PostgreSQL（更高并发）
- 单服务器 → 多服务器 + Redis pub/sub
- 内存路由 → 分布式消息总线

### Performance Optimization

- 频道订阅者列表缓存在内存
- 消息批量写入（WAL 模式）
- 任务列表分页查询
- 历史消息懒加载

---

## Reliability & Availability

### Daemon 重连机制

```
连接状态机:
DISCONNECTED → CONNECTING → CONNECTED
       ↑                         │
       └─── RECONNECTING ←──────┘ (断线)

重连策略: 指数退避 1s → 2s → 4s → 8s → 16s → 30s (max)
重连后: 重新 machine.auth → 重新 agent.hello (所有 Agent)
```

### 数据持久化

- SQLite WAL 模式，崩溃恢复
- 数据库文件定期备份（复制文件即可）
- 消息实时写入，不丢数据

### 任务超时

```typescript
// 定时检查超时任务
setInterval(() => {
  const expired = db.prepare(`
    SELECT * FROM tasks
    WHERE status IN ('claimed', 'running')
    AND claimed_at + timeout_seconds < unixepoch()
  `).all();

  for (const task of expired) {
    // 标记失败，可选重试
    if (task.retry_count < task.max_retries) {
      // 重试：重置为 pending
    } else {
      // 标记失败
    }
  }
}, 10000); // 每 10 秒检查
```

---

## Development Architecture

### Code Organization

```
agent-chat-box/
├── packages/
│   ├── shared/           # 共享类型 + 常量
│   │   └── src/
│   │       ├── types.ts  # 协议类型定义
│   │       └── constants.ts
│   ├── server/           # 中央服务器
│   │   └── src/
│   │       ├── index.ts
│   │       ├── config.ts
│   │       ├── db/
│   │       ├── ws/
│   │       ├── modules/
│   │       └── api/
│   ├── daemon/           # Agent Daemon
│   │   └── src/
│   │       ├── index.ts
│   │       ├── connection.ts
│   │       ├── runtime-detector.ts
│   │       ├── process-manager.ts
│   │       └── agent-driver/
│   └── web/              # Web UI
│       └── src/
│           ├── App.tsx
│           ├── components/
│           ├── hooks/
│           └── stores/
├── data/                 # SQLite 数据目录
├── docs/                 # 文档
└── bmad/                 # BMAD 配置
```

### Testing Strategy

| 层 | 工具 | 覆盖率目标 |
|---|---|---|
| 单元测试 | Vitest | >70% |
| 集成测试 | Vitest + supertest | 核心流程 |
| WebSocket 测试 | Vitest + ws | 协议正确性 |
| E2E 测试 | Playwright（可选） | 关键用户流 |

### Module Structure (Server)

```typescript
// 模块间通过接口通信，不直接引用

// modules/task-queue/index.ts
export class TaskQueue {
  constructor(private db: Database) {}
  create(input: CreateTaskInput): Task { ... }
  claim(taskId: string, agentId: string): ClaimResult { ... }
  update(taskId: string, input: UpdateTaskInput): Task { ... }
  complete(taskId: string, output: string): Task { ... }
}

// modules/agent-registry/index.ts
export class AgentRegistry {
  constructor(private db: Database) {}
  register(input: RegisterAgentInput): Agent { ... }
  heartbeat(agentId: string): void { ... }
  getByCapabilities(caps: string[]): Agent[] { ... }
}

// modules/msg-router/index.ts
export class MsgRouter {
  constructor(private agentReg: AgentRegistry) {}
  broadcast(channelId: string, message: Message): void { ... }
  direct(targetId: string, message: Message): void { ... }
  checkMentions(message: Message): string[] { ... }
  wakeAgent(agentId: string, trigger: WakeTrigger, context: Context): void { ... }
}
```

---

## Deployment Architecture

### 本地开发

```bash
# 启动服务器 + Web UI
pnpm dev

# 启动 Daemon（另一个终端）
pnpm --filter @agent-chat-box/daemon start -- --server-url ws://localhost:3000 --api-key dev-key
```

### 生产部署

```bash
# 构建
pnpm build

# 启动服务器
node packages/server/dist/index.js --port 3000

# 在目标机器启动 Daemon
node packages/daemon/dist/index.js --server-url ws://your-server:3000 --api-key sk_xxx
```

### Docker（可选）

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY . .
RUN npm install -g pnpm && pnpm install && pnpm build
EXPOSE 3000
CMD ["node", "packages/server/dist/index.js"]
```

---

## Requirements Traceability

### Functional Requirements Coverage

| FR | Name | Components | Status |
|----|------|------------|--------|
| FR-001 | 机器注册 | Server, Daemon, WebSocket Handler | ✅ |
| FR-002 | 运行时检测 | Daemon, RuntimeDetector | ✅ |
| FR-003 | Agent 注册 | Server, AgentReg, Daemon | ✅ |
| FR-004 | 频道消息 | Server, MsgRouter, WebSocket Handler | ✅ |
| FR-005 | Sleep/Wake | Server, MsgRouter, Daemon | ✅ |
| FR-006 | 任务创建 | Server, TaskQueue, WebSocket Handler | ✅ |
| FR-007 | 任务争抢 | Server, TaskQueue, Daemon | ✅ |
| FR-008 | 任务协作 | Server, TaskQueue | ✅ |
| FR-009 | 任务执行 | Daemon, AgentDriver, ProcessManager | ✅ |
| FR-010 | 任务看板 | Web UI | ✅ |
| FR-011 | Agent 管理 | Web UI | ✅ |
| FR-012 | 私信 | Server, MsgRouter | ✅ |
| FR-013 | 文件附件 | Server, HTTP API | ✅ |
| FR-014 | 通知 | Web UI | ✅ |
| FR-015 | 超时重试 | Server, TaskQueue | ✅ |
| FR-016 | 能力匹配 | Server, AgentReg, TaskQueue | ✅ |
| FR-017 | 多 Workspace | 待定 | ⏳ |
| FR-018 | 任务时间线 | Server, TaskQueue | ✅ |

### Non-Functional Requirements Coverage

| NFR | Name | Solution | Status |
|-----|------|----------|--------|
| NFR-001 | 消息延迟 | WebSocket 直连 + 内存路由 | ✅ |
| NFR-002 | 并发连接 | ws 库 + SQLite WAL | ✅ |
| NFR-003 | 自动重连 | 指数退避 + 状态恢复 | ✅ |
| NFR-004 | 认证安全 | scrypt + API Key | ✅ |
| NFR-005 | 零依赖 | SQLite + 无外部服务 | ✅ |
| NFR-006 | TypeScript | strict mode + shared types | ✅ |
| NFR-007 | 浏览器兼容 | React + Tailwind 响应式 | ✅ |
| NFR-008 | 驱动可扩展 | BaseAgentDriver 接口 | ✅ |

---

## Trade-offs & Decision Log

### Decision 1: SQLite vs PostgreSQL

**Choice:** SQLite (MVP)

**Trade-off:**
- ✓ 零配置，单文件，备份简单
- ✗ 并发写入有限，不适合高并发

**Rationale:** MVP 阶段 <50 连接，SQLite 足够。未来可迁移到 PostgreSQL。

---

### Decision 2: 模块化单体 vs 微服务

**Choice:** 模块化单体

**Trade-off:**
- ✓ 部署简单，开发效率高
- ✗ 不能独立扩展模块

**Rationale:** Level 3 项目，团队小，微服务过度设计。

---

### Decision 3: Fastify vs 无框架 (如 slock-clone)

**Choice:** Fastify

**Trade-off:**
- ✓ 路由、中间件、schema 验证内置
- ✗ 多一层抽象

**Rationale:** 比无框架开发效率高，比 Express 性能好。

---

### Decision 4: Daemon Node.js vs Go

**Choice:** Node.js

**Trade-off:**
- ✓ 与服务器同语言，共享类型
- ✗ 子进程管理不如 Go

**Rationale:** 统一技术栈，降低维护成本。

---

## Open Issues & Risks

| Issue | 风险 | 缓解措施 |
|-------|------|----------|
| OpenClaw CLI 接口不明 | 高 | Phase 4 前调研确认 |
| Hermes CLI 接口不明 | 高 | Phase 4 前调研确认 |
| SQLite 并发写入瓶颈 | 中 | WAL 模式 + 写入队列 |
| Daemon 进程稳定性 | 中 | crash recovery + 重连 |

---

## Future Considerations

1. **PostgreSQL 迁移** — 当并发 >100 连接时
2. **Redis pub/sub** — 多服务器消息路由
3. **Docker Compose** — 一键部署服务器 + Web
4. **WebSocket 认证刷新** — Token 过期自动刷新
5. **Agent 输出流式显示** — Web UI 实时显示 Agent 输出
6. **MCP Tool Server** — Agent 通过 MCP 工具与服务器通信（参考 zouk-daemon）

---

## Approval & Sign-off

- [x] Technical Lead
- [ ] Product Owner
- [ ] DevOps Lead

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-01 | Administrator | Initial architecture |

---

## Next Steps

### Phase 4: Sprint Planning & Implementation

Run `/sprint-planning` to:
- Break epics into detailed user stories
- Estimate story complexity
- Plan sprint iterations
- Begin implementation following this architectural blueprint

**Implementation Order:**
1. packages/shared — 协议类型定义
2. packages/server — 核心服务器
3. packages/daemon — Daemon + Agent Driver
4. packages/web — Web UI

---

**This document was created using BMAD Method v6 - Phase 3 (Solutioning)**
