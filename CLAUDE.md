# Agent Chat Box - 跨机器多 Agent 任务调度与协作平台

## 项目愿景

构建一个分布式 Agent 协作平台，管理运行在不同机器（家庭电脑、公司电脑、云服务器）上的多种 AI 编程 Agent（Claude Code、Codex、OpenClaw、Hermes 等），实现：

- **跨机调度** — Daemon 反向连接，穿透 NAT，任意机器可部署
- **任务争抢** — 多 Agent 竞争 claim（compete 模式）
- **任务分解协作** — 大任务拆子任务，分配给不同 Agent（collaborate 模式）
- **实时同频对话** — Agent 与人类在同一频道平等对话，@mention 自动唤醒
- **跨团队联邦** — 群系统 + Hub/Runner 拓扑，支持多团队共享 Agent 能力

当前版本 **v0.3.0**（2026-09-06）：
- v0.1.0 基础调度已完成开发与测试；
- v0.2.0 群级扩展 + 联邦网关已完成开发与 TEA 自动化测试；
- v0.2.0 follow-up stories（G027~G031、F011~F012、Q001）已完成开发与测试，用于关闭人工验证发现的 14 个 GAP；
- `docs/manual-verification.md` 人工验证已执行完毕：206 项，188 通过 / 0 失败，决策 GO；
- v0.3.0 域层（Domain）用 IDSD 方法交付（过程产物在 `idsd-pilot/domain/`），并修复了 web 生产构建、Tailwind 路径与 CI E2E harness。

## 核心架构

### 单团队拓扑

```
┌─────────────────────────────────────────────────────┐
│                   Web UI (React 19)                  │
│   Chat | Tasks | Groups | Authorizations | Agents    │
└────────────────────────┬────────────────────────────┘
                         │ WebSocket (/ws) + REST API
┌────────────────────────┴────────────────────────────┐
│              Central Server (Fastify 5)              │
│  TaskQueue | AgentReg | MsgRouter | GroupManager     │
│  WakeEngine | Reputation | AuthorizationGate         │
│  Federation Hub | sql.js (SQLite WASM, schema v9)    │
└──────┬──────────────┬──────────────┬────────────────┘
       │ /daemon/connect (反向 WS)
┌──────┴──────┐ ┌─────┴──────┐ ┌────┴───────┐
│  Daemon A   │ │  Daemon B  │ │  Daemon C  │
│ Claude Code │ │ Codex      │ │ OpenClaw   │
└─────────────┘ └────────────┘ └────────────┘
```

### 联邦拓扑（跨团队，星型 Hub-Runner）

```
                    [群 Hub Server]
                    (群主团队托管，仅此节点需公网暴露)
                         ↑
        ┌────────────────┼────────────────┐
        │ WSS /federation │ WSS /federation │ (反向连接)
        ↓                ↓                ↓
   [团队A Server]   [团队B Server]   [团队C Server]
        ↑                ↑                ↑
   [Daemon A1]      [Daemon B1]      [Daemon C1]
```

### 关键设计

- **反向连接** — Daemon 主动连接 Server，无需 Daemon 公网暴露
- **联邦反向连接** — 成员团队 Server 主动 WSS 连接群 Hub，仅 Hub 需公网
- **统一信封** — WebSocket 与联邦消息共用 `{ v, id, type, ts, [from, to,] data }` 结构
- **Hub 不维护实时态** — 通过 `federation_task_index` 队列 + Runner poll 解耦

## 技术栈

| 层 | 技术 |
|---|---|
| 服务器 | Fastify 5 + ws 8 + sql.js 1.11（WASM SQLite，无原生依赖） |
| 联邦网关 | WebSocket + 自定义协议（slock 信封风格） |
| Daemon | Node.js 20+ + ws + 进程管理 + Agent 适配器 |
| 前端 | React 19 + Vite 6 + Tailwind CSS 4 + React Router |
| 类型 | TypeScript strict mode + ESM |
| 包管理 | npm（monorepo，根目录管理依赖） |
| 测试 | Vitest 3（337+ 用例：根 76 + server 236 + web 25）+ Playwright 1.49 E2E |
| 代码风格 | ESLint 9 + Prettier 3 |

## 设计原则

### SOLID
- **S**: 每个模块单一职责 — `task-queue` 只管队列、`wake-engine` 只管唤醒、`reputation` 只管评分
- **O**: 新 Agent 类型通过 `agent-driver/` 适配器扩展，不改调度核心
- **L**: `AgentDriver` 子类型可替换使用（claude-code / codex / openclaw / hermes）
- **I**: 接口分离 — REST API、WS handler、Federation Hub 各自独立模块
- **D**: 调度器依赖抽象 driver 接口，不依赖具体 Agent 实现

### KISS
- 用 sql.js（WASM SQLite）省掉 native 编译；用内置队列省掉 Redis
- WebSocket 够用，不上 gRPC；联邦协议复用 WS 信封，不另起协议栈

### YAGNI
- 不做 P2P、不做分布式调度器；Hub 仅做路由不维护实时态
- 联邦信任模型只做"邀请码 + 信誉分 + 闸门"，不引入 PKI / 区块链

### DRY
- Agent 适配器统一基类（`agent-driver/base.ts`），重连/心跳/进程管理逻辑只写一次
- 联邦信封复用 WS 信封结构，仅扩展 `from` / `to` 字段

## 核心模块

### 服务端（packages/server/src/）

| 模块 | 职责 |
|---|---|
| `modules/task-queue` | 任务状态机、争抢/指派、超时重试 |
| `modules/wake-engine` | Agent 唤醒触发（mention / dm / task_assigned / task_available / federation_claim） |
| `modules/reputation` | 团队信誉分累计与查询 |
| `api/agents` | Agent 注册、状态、能力查询 |
| `api/channels` `api/messages` | 频道与消息 REST |
| `api/tasks` `api/group-tasks` | 任务 / 群级任务 REST |
| `api/teams` `api/groups` | 团队与群管理（含邀请码） |
| `api/authorizations` | 跨团队授权请求 / 审批闸门 |
| `api/reviews` | 任务产出审核工作流 |
| `api/reputation` | 信誉分查询 |
| `api/uploads` | 多文件附件上传 |
| `api/machines` | 机器注册（API key 哈希） |
| `ws/handler` | WebSocket 消息路由（human + daemon） |
| `federation/hub` | 群主侧 Hub：注册、心跳、任务广播、claim 路由 |
| `federation/runner` | 成员侧 Runner：反向连接、task poll、Agent 唤醒 |
| `federation/protocol` | 联邦信封编解码、消息类型枚举 |
| `db` | sql.js 初始化、schema v9 迁移 |

### Daemon（packages/daemon/src/）

| 模块 | 职责 |
|---|---|
| `index.ts` | 入口、CLI 参数、生命周期 |
| `connection.ts` | WS 反向连接 + 心跳 + 自动重连（指数退避 1→30s） |
| `process-manager.ts` | Agent 进程派生、stdin/stdout 管道 |
| `runtime-detector.ts` | 自动探测本机已安装的 Agent CLI |
| `agent-driver/{base,claude-code,codex,openclaw,hermes}.ts` | 各类 Agent 适配器 |

### 前端（packages/web/src/）

| 页面/组件 | 职责 |
|---|---|
| `pages/ChatPage`（App 内联） | 频道列表 + 消息流 + @mention 自动补全 |
| `pages/TasksPage` → `TaskBoard` | 任务看板 + 详情弹窗 + 创建表单 |
| `pages/GroupsPage` | 群管理：创建、邀请码、契约 YAML 编辑 |
| `pages/AuthorizationsPage` | 跨团队授权请求审批 |
| `pages/AgentsPage` | Agent 状态监控、能力标签 |
| `pages/SettingsPage` | 服务器/Daemon 配置 |
| `components/ReputationBadge` | 信誉分徽章 |
| `hooks/useWebSocket` | WS 连接 + 自动重连 |

## 目录结构（实际）

```
agent-chat-box/
├── CLAUDE.md
├── README.md
├── CHANGELOG.md
├── package.json                # 根 workspace
├── tsconfig.json
├── eslint.config.js
├── vitest.config.ts
├── playwright.config.ts
├── packages/
│   ├── shared/                 # 共享类型 + 协议常量
│   │   └── src/{types.ts, constants.ts, index.ts}
│   ├── server/                 # 中央服务器
│   │   └── src/
│   │       ├── index.ts        # Fastify 启动 + WS 升级处理
│   │       ├── api/            # REST 路由（agents/channels/groups/...）
│   │       ├── modules/        # task-queue / wake-engine / reputation
│   │       ├── federation/     # hub / runner / protocol
│   │       ├── ws/             # WebSocket handler
│   │       └── db/             # schema.sql + sql.js 适配
│   ├── daemon/                 # Agent Daemon
│   │   └── src/
│   │       ├── index.ts
│   │       ├── connection.ts
│   │       ├── process-manager.ts
│   │       ├── runtime-detector.ts
│   │       └── agent-driver/   # 各 Agent 适配器
│   └── web/                    # Web UI（React 19 + Vite 6）
│       └── src/{App.tsx, pages/, components/, hooks/, utils/}
├── tests/                      # 项目级集成测试
│   ├── api/                    # health / agents / channels / messages / tasks / machines
│   ├── unit/                   # db / task-queue
│   └── helpers.ts
├── e2e/                        # Playwright E2E
│   ├── core-flows.spec.ts
│   ├── federation.spec.ts
│   └── auth.setup.ts
├── docs/                       # 设计文档（PRD / 架构 / Sprint / 用户故事 / 验证记录）
│   └── stories/                # 71 个用户故事
├── data/                       # SQLite 数据文件（运行时生成）
└── .github/workflows/test.yml  # CI
```

## 协议设计

### WebSocket 信封（packages/shared/src/types.ts）

```typescript
interface WSMessage {
  v: 1;
  id?: string;
  type: string;
  ts: number;
  data: unknown;
}
```

### 联邦信封（slock 风格）

```typescript
interface FederationMessage {
  v: number;
  id: string;
  type: FederationMessageType;
  ts: number;
  from: string;     // teamId
  to?: string;      // teamId（可选，广播时省略）
  data: unknown;
}
```

### WebSocket 端点

| 路径 | 用途 |
|---|---|
| `/ws` | Web UI 客户端 |
| `/daemon/connect` | Daemon 反向连接 |
| `/federation` | 跨团队 Hub-Runner |

### 关键消息类型（packages/shared/src/constants.ts:MSG）

- **Agent**: `agent.hello` / `agent.heartbeat` / `agent.sleep` / `agent.wake` / `agent.bye`
- **Message**: `message.send` / `message.new` / `message.history` / `message.ack`
- **Task**: `task.create` / `task.claim` / `task.update` / `task.completed` / `task.failed` / `task.subtasks`
- **Channel**: `channel.create` / `channel.join` / `channel.leave`
- **Human**: `human.identify` / `human.identified`
- **Group**: `group.created` / `group.joined` / `group.left` / `group.task.*` / `group.contract.updated`
- **Authorization**: `authorization.requested` / `approved` / `rejected` / `expired`
- **Review**: `review.requested` / `review.completed`
- **Federation**: `federation.register` / `heartbeat` / `member.joined` / `member.left` / `task.broadcast` / `task.claim` / `agent.wake`

## 数据模型（schema v9，packages/server/src/db/schema.sql）

14 张表覆盖完整业务：

- **身份**: `teams` · `team_members` · `machines` · `agents`（含 `labels` 字段）
- **群系统**: `groups`（含 `contract_yaml`、`invite_code`）· `group_members`
- **会话**: `channels` · `channel_members` · `messages`
- **任务**: `tasks`（状态含 `pending_authorization`）· `group_tasks`
- **治理**: `authorization_requests` · `reputation_records`
- **联邦**: `federation_peers` · `federation_task_index`

任务状态机：
```
pending → claimed → running → (decomposing | verifying) → completed
                                        ↓
                                      failed
       (跨团队需先经 pending_authorization → approved/rejected)
```

Agent 状态：`sleeping` → `awake` → `running` → `sleeping`（或 `offline`）

## 当前能力（v0.3.0 已落地）

✅ 跨机调度：Daemon 反向连接、自动重连、心跳超时检测
✅ 三种任务模式：compete（争抢）/ assign（指派）/ collaborate（分解）
✅ 实时聊天：@mention 自动唤醒 Agent、消息历史、附件上传
✅ 4 类 Agent 适配器：Claude Code / Codex / OpenClaw / Hermes
✅ 群系统：创建群、邀请码（带过期/次数限制）、入群/退群、成员角色
✅ 群契约：YAML 配置授权模式、信任阈值、共享能力、可见性
✅ 跨团队任务：`required_capabilities` 约束、授权闸门（手动/自动）
✅ 信誉分系统：基于任务完成质量累计
✅ Review 工作流：审核任务产出、通过/拒绝、回池
✅ 联邦网关：Hub/Runner 星型拓扑、标签匹配路由、跨团队 Agent 唤醒
✅ Web UI：7 个主页面（Chat / Tasks / Groups / Domains / Authorizations / Agents / Settings）
✅ 域层（Domain，IDSD 交付）：域注册与邀请码、能力声明与子集匹配发现、域级信誉隔离、域协作任务与评分、连续拒绝异常检测、schema v10→v12
✅ 455 个自动化测试（根 76 + server 325 + web 54）+ Playwright E2E（8 通过 / 5 需手动 Hub•Runner），TEA 决策 GO
✅ v0.2.0 follow-up stories 完成：Groups 生命周期 UI、Agent labels、TaskBoard 群任务区分、ReputationBadge 接入、Review UI、Federation Peers 面板、质量门禁与 CI

## 下阶段方向（候选）

> 未排期，按用户/产品决策启动。

- 分层组织扩展：World（跨域联邦）— Domain 已于 v0.3.0 落地，四层只剩这一层
- 任务依赖图、并发约束、SLA 监控
- 权限系统：用户认证、Team RBAC、API key 管理
- 可观测性：结构化日志、指标埋点、追踪
- Agent 能力评估：自动信誉算法、能力画像
- 持久化升级：PostgreSQL 适配器（保留 sql.js 作为 dev 模式）
- 任务结果归档与全文检索

## 开发约定

- **语言**: TypeScript strict + ESM
- **包管理**: npm（`npm install` 在根目录运行）
- **代码风格**: ESLint + Prettier，`npm run lint` / `npm run format`
- **注释语言**: 英文（保持代码库统一）
- **提交规范**: Conventional Commits（`feat:` / `fix:` / `docs:` / `chore:` / `test:`）
- **测试**: Vitest（`npm test` = 根 76 + server 325 + web 54 = 455 用例，一次跑完），`npm run quality:gates` 跑质量门禁
- **E2E**: 单一 harness 在根目录（`npm run test:e2e`）；先 `npm run build:web`，harness 会拉起 server(:3000) 并服务已构建 UI；联邦用例需 `FEDERATION_E2E=1` + 手动 Hub(:3001)/Runner(:3002)
- **CI**: `.github/workflows/test.yml`（`unit-test` + `e2e-test` 两个 job，均需绿）

### 常用命令

```bash
npm install                   # 安装根目录依赖
npm ci --prefix packages/web  # web 自带 lockfile（tailwind / react-router-dom / vite）
npm ci --prefix packages/server  # server 自带 lockfile（js-yaml 等）
npm run dev:server            # 启动服务器（tsx watch 热重载）
npm run dev:web               # 启动 Web UI（Vite dev server）
npm run build                 # 构建 shared + server + daemon + web（web 含 tsc）
npm run build:web             # 只构建 Web UI（E2E 前置条件）
npm test                      # 根 + server + web 全部 Vitest 用例
npm run test:coverage         # 同上，带覆盖率报告
npm run test:e2e              # Playwright E2E（根目录单一 harness）
npm run quality:gates         # 跑 BMAD/TEA 质量门禁
npm run typecheck             # tsc --noEmit：packages/*/src + packages/web
npm run lint                  # ESLint（0 errors 门禁）
npm run format                # Prettier 写回
```

### Daemon 启动

```bash
pnpm --filter @agent-chat-box/daemon start -- \
  --server ws://localhost:3000 \
  --token <machine-api-key>
```

### 联邦 Runner 启动（成员团队）

```bash
FEDERATION_URL=ws://hub.example.com/federation \
FEDERATION_INVITE_CODE=ABC123 \
FEDERATION_TEAM_ID=team-b \
pnpm --filter @agent-chat-box/server start
```

## 工作准则（给 Claude Code）

1. **先读再改** — 任何修改前先读相关文件，理解现有模式与命名风格
2. **不主动 git** — 除非用户明确要求，不执行 `git commit` / `git push` / 分支操作
3. **危险操作确认** — 删除文件、批量修改、改 schema、生产 API 调用前必须确认
4. **遵循英文注释约定** — 新增/修改代码注释一律英文，与现有代码库一致
5. **基于事实** — 用工具查证，不凭记忆；优先 `rg` / 专用工具，不滥用 shell
6. **演进式重构** — 不为未来需求过度设计；YAGNI 优先
