# Agent Chat Box - 跨机器多Agent任务调度平台

## 项目愿景

构建一个分布式 Agent 协作平台，管理运行在不同机器（家庭电脑、公司电脑、云服务器）上的多种 AI 编程 Agent（Claude Code、Codex、OpenClaw、OpenCode、Hermes 等），实现：
- 任务发布与争抢（竞争模式）
- 任务分解与分工（协作模式）
- Agent 间实时聊天与信息共享

## 核心架构

```
┌─────────────────────────────────────────────────────┐
│                   Central Server                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ TaskQueue │ │ AgentReg │ │ MsgRouter│ │ WebUI  │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
│         WebSocket / HTTP API                         │
└──────────┬──────────────┬──────────────┬────────────┘
           │              │              │
    ┌──────┴──────┐ ┌─────┴──────┐ ┌────┴───────┐
    │ Agent Worker│ │ Agent Worker│ │ Agent Worker│
    │ (Home PC)   │ │ (Office PC) │ │ (Cloud VM) │
    │ Claude Code │ │ Codex       │ │ OpenCode   │
    └─────────────┘ └────────────┘ └────────────┘
```

### 架构模式：中央调度 + Worker 反向连接

- **中央服务器**：任务队列、Agent 注册、消息路由、Web 管理界面
- **Worker 端**：每台机器运行一个 Agent Worker，主动连接中央服务器（解决 NAT 穿透问题）
- **通信协议**：WebSocket（实时）+ HTTP API（管理操作）

## 技术栈

### 服务端
- **运行时**: Node.js + TypeScript
- **框架**: Fastify (HTTP) + ws (WebSocket)
- **数据库**: SQLite (开发) / PostgreSQL (生产)
- **任务队列**: 内置队列（初期）/ BullMQ + Redis（扩展）

### Agent Worker
- **语言**: TypeScript（统一 SDK）
- **Agent 适配器模式**: 每种 Agent 实现统一接口

### 前端
- **框架**: React + TypeScript
- **UI**: Tailwind CSS + shadcn/ui
- **实时更新**: WebSocket

## 设计原则

### SOLID
- **S**: 每个模块单一职责 — TaskQueue 只管队列，AgentRegistry 只管注册
- **O**: 新增 Agent 类型通过适配器扩展，不修改调度核心
- **L**: AgentAdapter 子类型可替换使用
- **I**: 接口专一，IWorkerAdapter / ISchedulerAdapter / IMessageAdapter 分离
- **D**: 调度器依赖抽象适配器，不依赖具体 Agent 实现

### KISS
- 初期用 SQLite + 内置队列，不过度引入基础设施
- WebSocket 够用就不上 gRPC

### YAGNI
- 第一版不做 P2P、不做分布式调度器、不做权限系统
- 先跑通单服务器 + 多 Worker

### DRY
- Agent 适配器统一接口，不重复实现连接/重连/心跳逻辑

## 核心模块

### 1. TaskQueue（任务队列）
- 发布任务（标题、描述、优先级、标签）
- 任务状态机：pending → claimed → running → completed / failed
- 竞争模式：多 Agent 争抢，先 claim 先得
- 协作模式：任务分解为子任务，分配给不同 Agent

### 2. AgentRegistry（Agent 注册中心）
- Agent 注册/注销/心跳
- 能力标签（擅长语言、工具链、算力等级）
- 在线状态管理

### 3. MsgRouter（消息路由器）
- Agent 间点对点聊天
- 广播消息
- 任务关联的消息（讨论上下文）

### 4. AgentWorker（Agent Worker SDK）
- 统一适配器接口
- 自动重连、心跳
- 任务拉取/执行/回报

### 5. WebUI（管理界面）
- 任务看板（Kanban）
- Agent 状态面板
- 聊天/消息流
- 任务统计

## 目录结构（规划）

```
agent-chat-box/
├── CLAUDE.md
├── package.json
├── tsconfig.json
├── apps/
│   ├── server/              # 中央服务器
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── task-queue/     # 任务队列模块
│   │   │   │   ├── agent-registry/ # Agent 注册模块
│   │   │   │   ├── msg-router/     # 消息路由模块
│   │   │   │   └── web-api/        # HTTP API
│   │   │   ├── ws/                 # WebSocket 处理
│   │   │   └── db/                 # 数据库
│   │   └── package.json
│   ├── worker/              # Agent Worker
│   │   ├── src/
│   │   │   ├── adapters/           # Agent 适配器
│   │   │   │   ├── claude-code.ts
│   │   │   │   ├── codex.ts
│   │   │   │   ├── openclaw.ts
│   │   │   │   ├── opencode.ts
│   │   │   │   └── hermes.ts
│   │   │   ├── core/               # Worker 核心逻辑
│   │   │   └── sdk/                # 对外 SDK
│   │   └── package.json
│   └── web/                 # 前端界面
│       ├── src/
│       └── package.json
├── packages/
│   ├── shared/              # 共享类型、常量
│   └── protocol/            # 通信协议定义
└── docs/
```

## 开发约定

- **语言**: TypeScript strict mode
- **包管理**: pnpm workspace
- **代码风格**: ESLint + Prettier
- **注释语言**: 英文
- **提交规范**: Conventional Commits
- **测试**: Vitest

## 协议设计要点

### WebSocket 消息格式
```typescript
interface WSMessage {
  type: string;          // 消息类型
  payload: unknown;      // 消息体
  from?: string;         // 发送者 ID
  to?: string;           // 接收者 ID（点对点）
  timestamp: number;
}
```

### 关键消息类型
- `agent:register` / `agent:heartbeat` / `agent:disconnect`
- `task:create` / `task:claim` / `task:update` / `task:complete`
- `chat:direct` / `chat:broadcast` / `chat:task-scoped`

## 第一阶段目标（MVP）

1. 中央服务器：任务队列 + Agent 注册 + 消息路由
2. Agent Worker SDK：至少支持 Claude Code 适配器
3. 基础 WebUI：任务列表 + Agent 状态 + 简单聊天
4. 竞争模式跑通：发布任务 → Agent 争抢 → 执行 → 完成
