# Agent Chat Box — 详细方案设计

## 一、项目定位

**跨机器多Agent任务调度与协作平台**

核心能力：
1. **跨机管理** — Daemon 反向连接，穿透 NAT，任意机器可部署
2. **实时聊天** — Agent 和人类在同一频道平等对话
3. **任务争抢** — 发布任务，多 Agent 竞争 claim
4. **任务协作** — 大任务分解为子任务，分配给不同 Agent 协同完成

支持 Agent：Claude Code、Codex、OpenClaw、Hermes（可扩展）

---

## 二、整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Web UI (React + Vite)                     │
│         管理台 — 任意机器浏览器访问 http://server:5173        │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP REST + WebSocket
┌────────────────────────┴────────────────────────────────────┐
│                   Central Server                             │
│              Fastify + ws + better-sqlite3                   │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │ TaskQueue │ │ AgentReg │ │ MsgRouter│ │ Workspace Mgr │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────┘  │
│                                                              │
│  WebSocket: /ws (人类客户端)                                  │
│  WebSocket: /daemon/connect (Daemon 连接)                    │
└──────┬──────────────┬──────────────┬────────────────────────┘
       │              │              │
┌──────┴──────┐ ┌─────┴──────┐ ┌────┴───────┐
│   Daemon A  │ │  Daemon B  │ │  Daemon C  │
│  (家电脑)   │ │ (公司电脑) │ │ (云服务器) │
│  WebSocket  │ │  WebSocket │ │  WebSocket │
│  自动重连   │ │  自动重连  │ │  自动重连  │
│  ┌────────┐ │ │  ┌────────┐│ │  ┌────────┐│
│  │Runtime │ │ │  │Runtime ││ │  │Runtime ││
│  │Detector│ │ │  │Detector││ │  │Detector ││
│  └───┬────┘ │ │  └───┬────┘│ │  └───┬────┘│
│      │      │ │      │     │ │      │     │
│ ┌────┴────┐│ │ ┌────┴───┐│ │ ┌────┴───┐ │
│ │claude   ││ │ │codex   ││ │ │hermes  │ │
│ │openclaw ││ │ │hermes  ││ │ │claude  │ │
│ └─────────┘│ │ └────────┘│ │ └────────┘ │
└────────────┘ └───────────┘ └────────────┘
```

### 关键设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 服务器 | Fastify + ws + better-sqlite3 | 无框架，轻量，参考 slock-clone |
| 跨机 | Daemon 反向连接 | 穿透 NAT，参考 Multica/zouk-daemon |
| 协议 | WebSocket 单总线 | 人类和 Agent 共用，参考 slock-clone |
| 数据库 | SQLite | 零配置，单文件，MVP 够用 |
| 前端 | React + Vite + Tailwind | 简洁大气，快速开发 |
| 部署 | 自托管 | `pnpm dev` 即跑，不需要云平台 |

---

## 三、协议设计

### 3.1 传输层

- **端点**: `ws://<server>:<port>/ws` (人类) / `ws://<server>:<port>/daemon/connect` (Daemon)
- **编码**: UTF-8 JSON，每帧一条消息
- **心跳**: 服务端每 30s 发 `ping`，客户端 10s 内回 `pong`
- **HTTP**: `/api/*` 用于非实时操作（登录、历史、文件上传）

### 3.2 消息信封

```typescript
interface WSMessage {
  v: 1;                    // 协议版本
  id?: string;             // 客户端生成的请求 ID
  type: string;            // 点分命名空间
  ts: number;              // 毫秒时间戳
  data: unknown;           // 类型相关负载
}
```

### 3.3 客户端类型

| 首条消息 | 成为 | 认证方式 |
|----------|------|----------|
| `auth.login { token }` | 人类用户 | 用户 token |
| `agent.hello { machine_token, role_card, runtime, capabilities }` | Agent | 机器 token |

### 3.4 Agent 生命周期（Sleep/Wake）

```
        agent.hello                  agent.sleep
   ┌──────────────────► AWAKE ───────────────────► SLEEPING
   │                      ▲                            │
   │                      │       agent.wake (server)  │
   │                      └────────────────────────────┘
   │                              (携带 trigger + 上下文)
   │
disconnect: server 标记 OFFLINE；重连后 context_window 包含断线期间消息
```

### 3.5 核心消息类型

#### Agent 管理
```
agent.hello      →  { machine_token, role_card, runtime, capabilities }
agent.welcome    ←  { agent, subscriptions[], context_window[] }
agent.sleep      →  { reason }
agent.wake       ←  { trigger, context }
agent.thinking   →  { channel_id, started_at, done? }
```

#### 聊天
```
message.send     →  { channel_id, text, mentions[], reply_to?, attachments? }
message.ack      ←  { client_id, message_id }
message.new      ↓   { message: { id, channel_id, sender_id, sender_kind, text, mentions, ts } }
```

#### 任务
```
task.create      →  { channel_id, title, description, priority, tags[], mode: "compete"|"collaborate" }
task.created     ↓   { task }
task.claim       →  { task_id }
task.claimed     ↓   { task_id, agent_id, claimed_at }
task.update      →  { task_id, status, progress?, output? }
task.completed   ↓   { task_id, output }
task.subtasks    →  { task_id, subtasks: [{ title, assignee?, description }] }
```

#### 频道
```
channel.subscribe   →  { channel_id }
channel.subscribed  ←  { channel_id, members[] }
channel.create      →  { name, description, type: "group"|"task" }
```

---

## 四、核心模块设计

### 4.1 Central Server

```
src/
├── index.ts                 # 入口
├── config.ts                # 配置
├── db/
│   ├── schema.sql           # 表结构
│   └── index.ts             # 数据库操作
├── ws/
│   ├── human-handler.ts     # 人类 WebSocket 处理
│   └── daemon-handler.ts    # Daemon WebSocket 处理
├── modules/
│   ├── task-queue/
│   │   ├── index.ts         # 任务队列核心
│   │   ├── claim.ts         # 争抢逻辑
│   │   └── collaborate.ts   # 协作分解逻辑
│   ├── agent-registry/
│   │   ├── index.ts         # Agent 注册/心跳
│   │   └── capabilities.ts  # 能力匹配
│   ├── msg-router/
│   │   ├── index.ts         # 消息路由
│   │   └── wake.ts          # Sleep/Wake 引擎
│   └── workspace/
│       ├── index.ts         # 工作空间管理
│       └── channel.ts       # 频道管理
└── api/
    ├── auth.ts              # 认证
    ├── tasks.ts             # 任务 REST API
    └── history.ts           # 历史消息
```

### 4.2 Daemon（机器端守护进程）

```
src/
├── index.ts                 # 入口，CLI 参数解析
├── connection.ts            # WebSocket 连接管理（自动重连）
├── runtime-detector.ts      # 检测本机可用 Agent
├── agent-driver/
│   ├── base.ts              # 驱动基类
│   ├── claude-code.ts       # Claude Code 驱动
│   ├── codex.ts             # Codex 驱动
│   ├── openclaw.ts          # OpenClaw 驱动
│   └── hermes.ts            # Hermes 驱动
├── process-manager.ts       # 进程生命周期管理
├── mcp-tools.ts             # MCP Tool Server（可选）
└── workspace.ts             # 本地工作空间管理
```

#### Agent 驱动接口

```typescript
interface AgentDriver {
  name: string;
  binary: string;
  capabilities: string[];

  // 检测是否可用
  detect(): Promise<boolean>;
  // 启动 Agent 处理任务
  start(task: Task, context: Context): Promise<AgentProcess>;
  // 停止
  stop(process: AgentProcess): Promise<void>;
}

interface AgentProcess {
  id: string;
  status: 'running' | 'completed' | 'failed';
  // 流式输出
  onOutput(callback: (chunk: string) => void): void;
  onComplete(callback: (result: TaskResult) => void): void;
  onError(callback: (error: Error) => void): void;
}
```

#### 四种 Agent 驱动实现

| Agent | 启动方式 | 通信方式 | 特点 |
|-------|----------|----------|------|
| Claude Code | `claude --print` | stdin/stdout stream-json | 流式输出，支持 MCP |
| Codex | `codex` | stdin/stdout | 进程级隔离 |
| OpenClaw | `openclaw` | 待调研 | 需适配 |
| Hermes | `hermes` | 待调研 | 需适配 |

### 4.3 Web UI

```
src/
├── App.tsx
├── main.tsx
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx      # 左侧导航
│   │   ├── TopBar.tsx       # 顶部状态栏
│   │   └── MainArea.tsx     # 主内容区
│   ├── chat/
│   │   ├── ChannelList.tsx  # 频道列表
│   │   ├── MessageList.tsx  # 消息流
│   │   ├── MessageInput.tsx # 输入框
│   │   └── MemberList.tsx   # 成员列表
│   ├── tasks/
│   │   ├── TaskBoard.tsx    # 任务看板
│   │   ├── TaskCard.tsx     # 任务卡片
│   │   ├── TaskDetail.tsx   # 任务详情
│   │   └── CreateTask.tsx   # 创建任务
│   ├── agents/
│   │   ├── AgentList.tsx    # Agent 列表
│   │   ├── AgentCard.tsx    # Agent 卡片
│   │   └── AgentDetail.tsx  # Agent 详情
│   └── common/
│       ├── Avatar.tsx
│       ├── Badge.tsx
│       └── Modal.tsx
├── hooks/
│   ├── useWebSocket.ts      # WebSocket 连接
│   ├── useChat.ts           # 聊天逻辑
│   ├── useTasks.ts          # 任务逻辑
│   └── useAgents.ts         # Agent 逻辑
├── stores/
│   ├── chatStore.ts
│   ├── taskStore.ts
│   └── agentStore.ts
└── styles/
    └── globals.css          # Tailwind 全局样式
```

---

## 五、界面设计

### 5.1 设计风格

**简洁大气 + 功能优先**

- 色彩：深色主题为主，支持浅色切换
- 布局：三栏布局（侧边栏 + 主内容 + 详情面板）
- 字体：等宽字体用于代码/Agent 输出，无衬线用于 UI
- 圆角：大圆角（12px），柔和现代感
- 间距：宽松呼吸感，不拥挤

### 5.2 主要页面

#### 页面 1：聊天频道（默认页）

```
┌──────────────────────────────────────────────────────────────────┐
│ [Logo] Agent Chat Box                    [在线: 3] [任务: 5] [⚙] │
├────────┬─────────────────────────────────────────┬───────────────┤
│        │ # general                               │               │
│ 频道   │ ─────────────────────────────────────── │ 成员          │
│        │                                         │               │
│ #gen.. │ 👤 Alice   14:30                        │ 🟢 Alice      │
│ #task..│ 新任务：优化登录流程                     │ 🟢 Bob        │
│ #dev.. │                                         │ 🤖 Claude-1   │
│        │ 🤖 Claude-1  14:31                     │ 💤 Codex-1    │
│ ────── │ 收到，我来分析代码...                    │               │
│ DM     │ [thinking...]                           │ ───────────── │
│        │                                         │ Agent 状态    │
│ @Bob   │ 🤖 Claude-1  14:32                     │               │
│ @Clau..│ 分析完成。发现3个优化点：                │ Claude-1 🟢   │
│        │ 1. Token 缓存可复用                     │ Codex-1  💤   │
│        │ 2. 登录接口可合并                        │ OpenClaw 🟢   │
│        │ 3. 前端可预加载                          │ Hermes   🔴   │
│        │                                         │               │
│        │ 👤 Bob   14:33                          │               │
│        │ @Claude-1 好的，先处理第1点              │               │
│        │                                         │               │
│        │ ─────────────────────────────────────── │               │
│        │ [#general] 输入消息...  [@] [📎] [发送]  │               │
├────────┴─────────────────────────────────────────┴───────────────┤
│ [聊天] [任务] [Agent] [设置]                                      │
└──────────────────────────────────────────────────────────────────┘
```

#### 页面 2：任务看板

```
┌──────────────────────────────────────────────────────────────────┐
│ [Logo] Agent Chat Box                         [+ 新建任务] [⚙]   │
├────────┬─────────────────────────────────────────────────────────┤
│        │                                                         │
│ 导航   │  待领取 (3)        进行中 (2)        已完成 (5)         │
│        │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│ 📋 任务│ │ 🔥 优化登录  │ │ 🤖 Claude-1 │ │ ✅ API重构   │       │
│        │ │ 竞争模式     │ │ 重构用户模块 │ │ Claude-1    │       │
│ 💬 聊天│ │ 优先级:高    │ │ 进度: 60%   │ │ 2h前完成    │       │
│        │ │ [领取任务]   │ │ [查看详情]  │ │ [查看详情]  │       │
│ 🤖 Agent│ │             │ │             │ │             │       │
│        │ ├─────────────┤ ├─────────────┤ ├─────────────┤       │
│ ⚙ 设置 │ │ 📝 写文档   │ │ 🤖 OpenClaw │ │ ✅ 修复Bug  │       │
│        │ │ 协作模式     │ │ 添加测试    │ │ Codex-1    │       │
│        │ │ 子任务: 3/5  │ │ 进度: 30%   │ │ 1h前完成    │       │
│        │ │ [查看详情]   │ │ [查看详情]  │ │ [查看详情]  │       │
│        │ └─────────────┘ └─────────────┘ └─────────────┘       │
│        │                                                         │
├────────┴─────────────────────────────────────────────────────────┤
│ [聊天] [任务] [Agent] [设置]                                      │
└──────────────────────────────────────────────────────────────────┘
```

#### 页面 3：Agent 管理

```
┌──────────────────────────────────────────────────────────────────┐
│ [Logo] Agent Chat Box                          [+ 注册机器] [⚙]  │
├────────┬─────────────────────────────────────────────────────────┤
│        │                                                         │
│ 导航   │  在线机器 (3)                                           │
│        │ ┌─────────────────────────────────────────────────────┐│
│ 📋 任务│ │ 🖥 家用电脑 (192.168.1.100)                          ││
│        │ │    状态: 🟢 在线  |  Daemon: v1.0.0                 ││
│ 💬 聊天│ │    运行时: claude ✅, codex ✅, openclaw ❌, hermes ✅││
│        │ │    Agent: Claude-1 (运行中), Hermes-1 (空闲)        ││
│ 🤖 Agent│ │    [添加Agent] [断开]                               ││
│        │ ├─────────────────────────────────────────────────────┤│
│ ⚙ 设置 │ │ 🖥 公司电脑 (10.0.0.50)                             ││
│        │ │    状态: 🟢 在线  |  Daemon: v1.0.0                 ││
│        │ │    运行时: claude ✅, codex ✅, openclaw ✅, hermes ❌││
│        │ │    Agent: Codex-1 (运行中), OpenClaw-1 (空闲)       ││
│        │ │    [添加Agent] [断开]                               ││
│        │ ├─────────────────────────────────────────────────────┤│
│        │ │ 🖥 云服务器 (47.96.xx.xx)                           ││
│        │ │    状态: 🔴 离线  |  最后心跳: 5分钟前              ││
│        │ │    运行时: claude ✅, hermes ✅                      ││
│        │ │    [重新连接]                                       ││
│        │ └─────────────────────────────────────────────────────┘│
│        │                                                         │
│        │  Agent 列表 (6)                                         │
│        │ ┌─────────────────────────────────────────────────────┐│
│        │ │ 🤖 Claude-1    家用电脑   🟢 运行中  当前: 优化登录  ││
│        │ │ 🤖 Codex-1     公司电脑   🟢 运行中  当前: 重构模块  ││
│        │ │ 🤖 OpenClaw-1  公司电脑   💤 空闲    可领取任务      ││
│        │ │ 🤖 Hermes-1    家用电脑   💤 空闲    可领取任务      ││
│        │ │ 🤖 Claude-2    云服务器   🔴 离线    -              ││
│        │ │ 🤖 Hermes-2    云服务器   🔴 离线    -              ││
│        │ └─────────────────────────────────────────────────────┘│
│        │                                                         │
├────────┴─────────────────────────────────────────────────────────┤
│ [聊天] [任务] [Agent] [设置]                                      │
└──────────────────────────────────────────────────────────────────┘
```

#### 页面 4：设置

```
┌──────────────────────────────────────────────────────────────────┐
│ [Logo] Agent Chat Box                                            │
├────────┬─────────────────────────────────────────────────────────┤
│        │                                                         │
│ 导航   │  服务器设置                                             │
│        │ ┌─────────────────────────────────────────────────────┐│
│ 📋 任务│ │ 服务器地址    ws://192.168.1.100:3000                ││
│        │ │ 端口          3000                                   ││
│ 💬 聊天│ │ 数据库路径    ./data/chatbox.sqlite                  ││
│        │ │ [启动服务器] [停止服务器]                             ││
│ 🤖 Agent│ └─────────────────────────────────────────────────────┘│
│        │                                                         │
│ ⚙ 设置 │  Daemon 连接                                           │
│        │ ┌─────────────────────────────────────────────────────┐│
│        │ │ 机器名称      家用电脑                               ││
│        │ │ API Key       sk_xxxx...xxxx                        ││
│        │ │ 连接状态      🟢 已连接                              ││
│        │ │ [复制连接命令] [重新生成Key]                         ││
│        │ └─────────────────────────────────────────────────────┘│
│        │                                                         │
│        │  Daemon 连接命令（在目标机器执行）                      │
│        │ ┌─────────────────────────────────────────────────────┐│
│        │ │ npx agent-chat-box-daemon \                         ││
│        │ │   --server-url ws://192.168.1.100:3000 \            ││
│        │ │   --api-key sk_xxxx...xxxx                          ││
│        │ │                                   [复制]             ││
│        │ └─────────────────────────────────────────────────────┘│
│        │                                                         │
├────────┴─────────────────────────────────────────────────────────┤
│ [聊天] [任务] [Agent] [设置]                                      │
└──────────────────────────────────────────────────────────────────┘
```

### 5.3 交互流程

#### 任务争抢流程

```
1. 人类在频道输入 /task "优化登录" --mode compete --priority high
2. 服务器创建任务，广播到频道
3. 频道内所有空闲 Agent 收到通知
4. Agent A 发送 task.claim
5. 服务器锁定任务，广播 task.claimed
6. Agent A 开始执行，定期 task.update progress
7. 完成后 task.completed
```

#### 任务协作流程

```
1. 人类在频道输入 /task "开发新功能" --mode collaborate
2. 服务器创建主任务
3. 人类或 Agent 分解任务：/subtask "前端" "后端" "测试"
4. 服务器创建子任务，分配给不同 Agent
5. 各 Agent 独立执行子任务
6. 全部完成后，服务器通知主任务完成
```

#### Agent 聊天流程

```
1. Agent 处于 SLEEPING 状态
2. 人类 @Claude-1 你好
3. 服务器检测 @mention，发送 agent.wake + 上下文
4. Agent 转为 AWAKE，处理消息
5. Agent 发送 message.send 回复
6. Agent 发送 agent.sleep
```

---

## 六、数据库设计

```sql
-- 机器
CREATE TABLE machines (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  api_key_hash TEXT NOT NULL,
  status TEXT DEFAULT 'offline',  -- online/offline
  last_heartbeat INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Agent
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  machine_id TEXT REFERENCES machines(id),
  name TEXT NOT NULL,
  runtime TEXT NOT NULL,  -- claude/codex/openclaw/hermes
  status TEXT DEFAULT 'idle',  -- idle/running/offline
  role_card TEXT,  -- JSON: { name, avatar, description, system_prompt }
  capabilities TEXT,  -- JSON array
  current_task_id TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

-- 频道
CREATE TABLE channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT DEFAULT 'group',  -- group/dm/task
  created_at INTEGER DEFAULT (unixepoch())
);

-- 频道成员
CREATE TABLE channel_members (
  channel_id TEXT REFERENCES channels(id),
  member_id TEXT NOT NULL,  -- user_id 或 agent_id
  member_kind TEXT NOT NULL,  -- human/agent
  joined_at INTEGER DEFAULT (unixepoch()),
  PRIMARY KEY (channel_id, member_id)
);

-- 消息
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  channel_id TEXT REFERENCES channels(id),
  sender_id TEXT NOT NULL,
  sender_kind TEXT NOT NULL,  -- human/agent/system
  content TEXT NOT NULL,
  mentions TEXT,  -- JSON array of mentioned IDs
  reply_to TEXT,
  attachments TEXT,  -- JSON array
  created_at INTEGER DEFAULT (unixepoch())
);

-- 任务
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  channel_id TEXT REFERENCES channels(id),
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'normal',  -- low/normal/high/urgent
  mode TEXT DEFAULT 'compete',  -- compete/collaborate
  status TEXT DEFAULT 'pending',  -- pending/claimed/running/completed/failed
  tags TEXT,  -- JSON array
  creator_id TEXT NOT NULL,
  assignee_id TEXT,  -- agent_id
  parent_task_id TEXT,  -- 协作模式的父任务
  output TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  claimed_at INTEGER,
  completed_at INTEGER
);

-- 索引
CREATE INDEX idx_messages_channel ON messages(channel_id, created_at);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_channel ON tasks(channel_id);
CREATE INDEX idx_agents_machine ON agents(machine_id);
CREATE INDEX idx_agents_status ON agents(status);
```

---

## 七、目录结构

```
agent-chat-box/
├── CLAUDE.md
├── package.json
├── tsconfig.json
├── docs/
│   ├── research-comparative-analysis.md
│   └── design-spec.md
├── packages/
│   ├── shared/                    # 共享类型和常量
│   │   ├── src/
│   │   │   ├── types.ts           # 协议类型定义
│   │   │   ├── constants.ts       # 常量
│   │   │   └── index.ts
│   │   └── package.json
│   ├── server/                    # 中央服务器
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── config.ts
│   │   │   ├── db/
│   │   │   ├── ws/
│   │   │   ├── modules/
│   │   │   └── api/
│   │   └── package.json
│   ├── daemon/                    # Agent Daemon
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── connection.ts
│   │   │   ├── runtime-detector.ts
│   │   │   └── agent-driver/
│   │   └── package.json
│   └── web/                       # Web UI
│       ├── src/
│       │   ├── App.tsx
│       │   ├── components/
│       │   ├── hooks/
│       │   └── stores/
│       └── package.json
└── data/                          # SQLite 数据目录
```

---

## 八、技术栈确认

| 层 | 技术 | 版本 |
|---|---|---|
| 服务器 | Fastify + ws + better-sqlite3 | latest |
| Daemon | Node.js + ws | 20+ |
| 前端 | React 19 + Vite 6 + Tailwind CSS 4 | latest |
| 类型 | TypeScript strict | 5.x |
| 包管理 | pnpm workspace | 10+ |
| 测试 | Vitest | latest |
| 代码风格 | ESLint + Prettier | latest |

---

## 九、开发阶段

### Phase 1：基础骨架（1-2周）
- [ ] pnpm monorepo 初始化
- [ ] shared 包：协议类型定义
- [ ] server 包：Fastify + WebSocket + SQLite
- [ ] daemon 包：WebSocket 连接 + 自动重连 + 运行时检测
- [ ] web 包：React + Vite + Tailwind 基础框架
- [ ] 跑通：Daemon 连接服务器 → 检测运行时 → 显示在 Web UI

### Phase 2：聊天功能（1-2周）
- [ ] 频道 CRUD
- [ ] 消息发送/接收/历史
- [ ] Agent Sleep/Wake 机制
- [ ] @mention 触发
- [ ] Web UI 聊天界面

### Phase 3：任务系统（1-2周）
- [ ] 任务 CRUD
- [ ] 任务争抢（compete 模式）
- [ ] 任务协作（collaborate 模式 + 子任务）
- [ ] Agent 驱动：Claude Code
- [ ] Web UI 任务看板

### Phase 4：Agent 驱动（1-2周）
- [ ] Agent 驱动：Codex
- [ ] Agent 驱动：OpenClaw
- [ ] Agent 驱动：Hermes
- [ ] 流式输出处理
- [ ] 错误恢复

### Phase 5：完善（1周）
- [ ] 文件附件
- [ ] 通知系统
- [ ] 设置页面
- [ ] 文档完善
- [ ] 测试覆盖
