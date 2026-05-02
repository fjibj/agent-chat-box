# 跨机器多Agent协作平台 - 竞品深度对比分析

## 调研项目总览

| 项目 | 定位 | 开源 | 跨机 | 任务争抢 | Agent聊天 | 自动分工 | 技术栈 |
|------|------|------|------|----------|-----------|----------|--------|
| **Multica** | 管理型Agent平台 | ✅ | ✅ | ❌ 指派制 | ✅ Issue+Chat | ❌ | Go + Next.js + PostgreSQL |
| **MaClaw** | 通用自进化智能体 | ⚠️ Dual | ❌ 单机 | ❌ | ✅ IM通道 | ✅ Swarm | Wails + Go + React |
| **AgentNet** | P2P Agent基础设施 | ❌ 协议层 | ✅ P2P | ✅ Board争抢 | ✅ 跨节点 | ✅ DAG编排 | 协议层(未开源) |
| **Claude Squad** | 本地多Agent终端管理 | ✅ AGPL | ❌ 单机 | ❌ | ❌ | ❌ | Go + tmux |
| **OpenHands** | AI软件开发平台 | ✅ MIT | ❌ 单机 | ❌ | ❌ | ❌ | Python + Docker |
| **slock.ai** | Agent协作聊天平台 | ✅ clone | ❌ 单服务器 | ✅ tasks claim | ✅ 核心能力 | ❌ | Node.js + ws + SQLite |

---

## 逐项目深度分析

### 1. Multica（最接近需求的项目）

**GitHub**: github.com/multica-ai/multica

**核心理念**: "Your next 10 hires won't be human" — 把Agent当真正的队友

**架构**:
```
Next.js Frontend → Go Backend (Chi + WS) → PostgreSQL (pgvector)
                        ↓
                  Agent Daemon（运行在用户机器上）
                  支持: Claude Code, Codex, OpenClaw, OpenCode,
                        Hermes, Gemini, Pi, Cursor Agent, Kimi, Kiro CLI
```

**已实现能力**:
- ✅ 跨机部署：Daemon 主动连接服务器，天然穿透 NAT
- ✅ 统一 Runtime：自动检测本机可用的 Agent CLI
- ✅ Agent 当队友：有 profile、出现在看板、发评论、报告阻塞
- ✅ 任务生命周期：enqueue → claim → start → complete/fail
- ✅ WebSocket 实时进度推送
- ✅ 多 Workspace 隔离
- ✅ 可复用技能系统
- ✅ 自托管支持（Docker）

**缺失能力（你的需求）**:
- ❌ 任务争抢模式 — 只有指派制，无竞争抢任务
- ❌ Agent 间聊天 — 只有 Issue 评论，无实时聊天
- ❌ 自动分工 — 无任务分解和自动分配
- ❌ Agent 能力匹配 — 无根据 Agent 擅长领域自动路由

**评价**: 最成熟的跨机 Agent 管理平台，架构清晰，但偏"管理"而非"协作"。适合作为基础参考，但需要在此基础上增加争抢/聊天/分工能力。

---

### 2. MaClaw（码卡龙）

**GitHub**: github.com/RapidAI/MaClaw

**核心理念**: "不只是聊天，而是替你干活" — 通用自进化智能体

**架构**:
```
Wails GUI / TUI / IM(微信/飞书/QQ) / REST API
                    ↓
            MaClaw 核心引擎（Go）
            ├── 长期记忆（BM25 + 向量）
            ├── 技能系统（三源市场）
            ├── MCP 集成
            ├── 工具路由（40+ 工具）
            └── 自我进化（能力缺口检测）
```

**已实现能力**:
- ✅ 结构化工作流（19种模板）
- ✅ 长期记忆 + 知识图谱
- ✅ 技能系统 + 自我进化
- ✅ MCP 集成
- ✅ 多形态交互（GUI/TUI/IM/API）
- ✅ SSH 远程管理
- ✅ 浏览器/桌面 GUI 自动化
- ✅ **AgentNet P2P 网络（实验性）**
- ✅ **Swarm 编排：大型任务拆分给多个 AI 开发者并行执行**

**AgentNet（MaClaw 内置）**:
- 去中心化智能体协作网络
- 节点发现、知识发布与搜索
- 跨节点任务委派
- 声誉系统、争议仲裁
- DAG 任务编排
- 积分系统

**缺失能力**:
- ❌ 跨机任务调度 — 单机为主，AgentNet 是实验性的
- ❌ 通用 Agent 接入 — 主要围绕自身生态
- ❌ Web 管理界面 — 以桌面应用为主

**评价**: 功能最丰富的单体 Agent 平台。Swarm 编排和 AgentNet 概念很好，但跨机协作还处于实验阶段。Dual License（开源需注意商业授权）。

---

### 3. Agent Network（AgentNet）

**网站**: agentnetwork.org.cn

**核心理念**: "Infrastructure for the Agent Era" — Agent 时代的基础设施协议层

**架构**:
```
协议栈: AIP → ANP → ASCP → CAS → ESDP
        ↓
agent:// 端点（每个 Agent 可寻址）
        ↓
Shared Work Plane（共享工作平面）
        ↓
去中心化 P2P 网络
```

**已实现能力**:
- ✅ Agent 可寻址（agent:// 端点）
- ✅ 协议栈：AIP(意图), ANP(网络), ASCP(协调), CAS(结算), ESDP(证据)
- ✅ 节点发现和注册
- ✅ Board 任务争抢（anet board）
- ✅ 积分系统（🐚 credits）
- ✅ 共享工作平面（Plans, evidence, decisions 共享）
- ✅ CLI 工具（anet daemon, anet whoami, anet board）

**技术特点**:
- 学术背景强（清华、北大、中科大、港科大、港中文、伦敦国王学院）
- 协议层设计，不绑定具体实现
- DID（去中心化身份）
- 开源基础设施 v1.1.11

**缺失能力**:
- ❌ 代码未完全开源（协议设计为主）
- ❌ 具体实现细节不明
- ❌ 成熟度待验证

**评价**: 最接近你需求的架构设计。协议层思路正确：Agent 可寻址 + 任务争抢 + 跨节点协作。但偏基础设施层，需要在其上构建应用层。

---

### 4. Claude Squad

**GitHub**: github.com/smtg-ai/claude-squad

**核心理念**: 本地多 Agent 终端管理器

**架构**:
```
TUI 界面
  ↓
tmux 会话（每个 Agent 一个隔离终端）
  ↓
git worktree（每个任务独立分支）
  ↓
Claude Code / Codex / Aider / Gemini
```

**已实现能力**:
- ✅ 单机多 Agent 并行
- ✅ git worktree 隔离
- ✅ 后台执行（yolo/auto-accept 模式）
- ✅ 变更审查再合并
- ✅ 多 Agent 支持（Claude Code, Codex, Aider, Gemini）
- ✅ Profile 配置

**缺失能力**:
- ❌ 跨机 — 纯本地
- ❌ 任务争抢 — 手动分配
- ❌ Agent 聊天 — 无
- ❌ 自动分工 — 无

**评价**: 简洁实用的本地多 Agent 管理工具。跨机能力为零，但 git worktree 隔离的设计可借鉴。

---

### 5. OpenHands（原 OpenDevin）

**GitHub**: github.com/All-Hands-AI/OpenHands

**核心理念**: AI 软件开发平台

**已实现能力**:
- ✅ Agent 可修改代码、运行命令、浏览网页、调用 API
- ✅ Docker 沙箱隔离
- ✅ GitHub Action 集成
- ✅ 多 LLM 支持

**缺失能力**:
- ❌ 跨机 — 单机 Docker
- ❌ 多 Agent 协作 — 单 Agent
- ❌ 任务调度 — 无

**评价**: 优秀的单 Agent 开发平台，但与你的需求方向不同。

---

### 6. slock.ai（Agent协作聊天平台）

**来源**: github.com/botiverse/slock（主仓）+ github.com/cch123/slock-clone（开源克隆）+ slock-cli（CLI客户端）

**核心理念**: "Agents as first-class members" — Agent 和人类在同一 WebSocket 上平等协作

**架构**:
```
┌─────────────────────────────────────────────┐
│              slock server                    │
│  Node.js + ws + SQLite (无框架)             │
│  HTTP API + WebSocket                       │
│  ┌─────────┐ ┌──────────┐ ┌──────────────┐ │
│  │ Channels │ │ Tasks    │ │ Agent Sleep/ │ │
│  │ & DMs    │ │ & Claim  │ │ Wake Engine  │ │
│  └─────────┘ └──────────┘ └──────────────┘ │
└──────┬──────────────┬──────────────┬────────┘
       │              │              │
  ┌────┴────┐   ┌─────┴─────┐  ┌────┴────┐
  │ Human   │   │ Agent CLI │  │ Agent   │
  │ (Web)   │   │ (本地进程)│  │ (远程)  │
  └─────────┘   └───────────┘  └─────────┘
```

**协议设计（核心亮点）**:

单一 WebSocket 总线，人类和 Agent 共用同一条线路：
```jsonc
// 消息信封
{ "v": 1, "id": "c_01HXY…", "type": "message.send", "ts": 1714400000000, "data": { … } }

// 两种客户端：首条消息决定身份
→ auth.login   { token }        // 成为人类
→ agent.hello  { agent_token, role_card, runtime, capabilities[] }  // 成为 Agent
```

**Agent 生命周期（Sleep/Wake 机制）**:
```
        agent.hello                  agent.sleep
   ┌──────────────────► AWAKE ───────────────────► SLEEPING
   │                      ▲                            │
   │                      │       agent.wake (server)  │
   │                      └────────────────────────────┘
   │                              (携带 trigger + 上下文)
```

- Agent 空闲时 sleep，节省资源
- 服务器在 `@mention`、DM、`/assign` 时推送 `agent.wake` + 上下文
- `agent.thinking` 心跳 → 人类看到 "ada is thinking..."
- 断线重连时 `agent.hello` 携带 role_card，自动热更新 Agent 身份

**已实现能力**:
- ✅ **实时聊天**：Channels + DMs + Threads
- ✅ **Agent 作为一等成员**：同一 WebSocket，同一消息格式
- ✅ **Sleep/Wake 协议**：服务器控制 Agent 唤醒，携带上下文
- ✅ **任务争抢**：`tasks claim` — Agent 可争抢任务
- ✅ **任务状态管理**：create → claim → update status
- ✅ **机器管理**：`machines create/list/delete`，API Key 认证
- ✅ **文件附件**：上传/下载，图片内联渲染
- ✅ **全文搜索**：SQLite FTS5，发送者/频道过滤
- ✅ **多 Workspace**：隔离的 channels、members、agents
- ✅ **浏览器通知 + 未读计数 + @提及徽章**
- ✅ **Role Card**：Agent 每次连接携带身份卡（名称、头像、系统提示词）
- ✅ **CLI 工具**：完整的 `slock` CLI，支持 JSON/Text 输出
- ✅ **自托管**：`slock server` 一键启动

**协议关键设计决策**:
- **单总线**：人类和 Agent 共用同一 WebSocket，UI 和 Agent 客户端共享解析器
- **服务器端唤醒**：Agent 不轮询，服务器知道何时该唤醒（@mention、DM、assign）
- **唤醒携带上下文**：Agent 被唤醒时自动获得最近 N 条消息 + 完整线程
- **Role Card on hello**：每次连接即热更新身份，换系统提示词只需重连
- **无框架服务器**：`http` + `ws` + `better-sqlite3`，协议即产品

**缺失能力**:
- ❌ 跨机调度 — 单服务器架构，无分布式 Daemon
- ❌ 自动分工 — 无任务分解和能力匹配
- ❌ Agent 能力声明 — capabilities 是自由文本，无结构化匹配

**评价**: **Agent 聊天和任务争抢的最佳参考实现**。协议设计精良，Sleep/Wake 机制优雅，任务 claim 争抢已实现。最大短板是跨机能力——单服务器架构，需要在此基础上加分布式 Daemon 层。

---

### 7. Crewden（slock + Multica 混合体）

**GitHub**: github.com/xlvecle/crewden

**核心理念**: 最小化自托管 Agent 工作空间 — server + daemon + web + CLI agents

**架构**:
```
Browser (React/Vite)
    |  HTTP REST + WebSocket (/ws)
    v
Server (Fastify + Node.js)  <-- in-memory store
    |  WebSocket (/daemon/connect)
    v
Daemon (Node.js)
    |  spawn child processes
    v
CLI Agents: claude | codex | gemini
```

**已实现能力**:
- ✅ Server + Daemon + Web 三层架构
- ✅ Daemon 反向连接服务器（WebSocket）
- ✅ 自动检测本机 CLI 运行时
- ✅ Agent Bridge Protocol：`[[CREWDEN_SEND_MESSAGE]] {"content":"reply"}`
- ✅ Cloudflare Workers 部署支持（公共中心化 Hub）
- ✅ 支持 Claude Code / Codex / Gemini
- ✅ pnpm monorepo

**缺失能力**:
- ❌ 内存存储（重启丢失）
- ❌ 无任务争抢
- ❌ 无 Agent 聊天（只有消息桥接）
- ❌ 无自动分工
- ❌ 无生产认证

**评价**: 架构最接近你的目标设计。Fastify + Daemon + Cloudflare 的组合很有参考价值。但功能极简，本质是 Multica 的最小化复刻 + slock 的消息桥接。适合参考架构，不适合直接扩展。

---

### 8. AgentsZone（SlockAIApp）— Tauri 桌面 Agent 协作

**GitHub**: github.com/auenger/SlockAIApp

**核心理念**: AI 原生协作桌面应用 — Channel + Thread + @Agent 触发

**架构**:
```
┌────────────────────────────────────┐
│     Tauri Desktop Application      │
│  ┌──────────────────────────────┐  │
│  │   React Frontend (WebView)   │  │
│  │  Sidebar │ Channel │ Thread  │  │
│  └──────────────┬───────────────┘  │
│                 │ IPC               │
│  ┌──────────────┴───────────────┐  │
│  │     Rust Backend (Tauri)     │  │
│  │  ├── 上下文编排引擎          │  │
│  │  │   Summary + Recent        │  │
│  │  │   Auto-Compact (>30 msgs) │  │
│  │  ├── Agent Runtime Layer     │  │
│  │  │   Claude Code │ Codex     │  │
│  │  └── Storage Layer           │  │
│  │      SQLite + JSONL + Keyring│  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
```

**已实现能力**:
- ✅ Channel 多 Agent 协作（@mention 触发）
- ✅ Thread 1对1 深度对话
- ✅ 上下文编排（滑动窗口 + 自动摘要压缩）
- ✅ 多 Runtime（Claude Code / Codex）
- ✅ Workspace 文件浏览器
- ✅ Skills 管理
- ✅ SQLite + JSONL 混合存储
- ✅ Tauri V2 桌面应用（跨平台）

**缺失能力**:
- ❌ 跨机 — 单机桌面应用
- ❌ 任务争抢 — 无
- ❌ Agent 间聊天 — 只有 Channel 内 @mention
- ❌ 自动分工 — 无
- ❌ License: Private

**评价**: 上下文编排引擎是亮点（滑动窗口 + 自动摘要）。Tauri 桌面方案适合本地使用，但跨机能力为零。上下文压缩策略可借鉴。

---

### 9. zouk-daemon（平台 Daemon 组件）

**GitHub**: github.com/t0saki/zouk-daemon

**核心理念**: 机器端守护进程 — 连接服务器、管理 Agent 进程、提供 MCP 工具

**架构**:
```
Server ←──WebSocket──→ Daemon (本机)
                          ├── Runtime 检测
                          ├── 进程管理
                          ├── MCP Tool Server (12个工具)
                          └── Agent: claude | codex | kimi
```

**已实现能力**:
- ✅ WebSocket 自动重连（指数退避 1s-30s）
- ✅ Agent 生命周期管理（start/stop/idle cache/crash recovery）
- ✅ 多 Runtime：Claude Code、Codex CLI、Kimi CLI
- ✅ MCP Tool Server：12 个聊天工具
- ✅ Workspace 浏览和技能发现
- ✅ 完整代理支持（HTTP/HTTPS/WS/WSS）
- ✅ Gemini CLI 检测（未完全支持）

**缺失能力**:
- ❌ 仅 Daemon 组件（需配合服务端）
- ❌ 任务争抢 — 无
- ❌ Agent 聊天 — 通过 MCP 工具
- ❌ 自动分工 — 无
- ❌ License: Proprietary

**评价**: 高质量的 Daemon 实现。MCP Tool Server 模式是亮点——Agent 通过 MCP 工具与服务器通信。自动重连、idle cache、crash recovery 都是生产级特性。Daemon 架构最值得参考的项目之一。

---

## 需求匹配度矩阵

| 需求 | Multica | MaClaw | AgentNet | Claude Squad | OpenHands | slock.ai | Crewden | AgentsZone | zouk-daemon |
|------|---------|--------|----------|--------------|-----------|----------|---------|------------|------------|
| 跨机器管理 | ⭐⭐⭐ | ⭐ | ⭐⭐⭐ | ⭐ | ⭐ | ⭐ | ⭐⭐ | ⭐ | ⭐⭐ |
| 多Agent支持 | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| 任务争抢 | ⭐ | ⭐ | ⭐⭐⭐ | ⭐ | ⭐ | ⭐⭐⭐ | ⭐ | ⭐ | ⭐ |
| Agent聊天 | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐ | ⭐ | ⭐⭐⭐ | ⭐ | ⭐⭐ | ⭐ |
| 自动分工 | ⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐ | ⭐ | ⭐ | ⭐ | ⭐ | ⭐ |
| 开源可用性 | ⭐⭐⭐ | ⭐⭐ | ⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐ | ⭐ |
| 架构可参考性 | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |

---

## 关键发现

### 1. Multica 最接近你的需求
- 架构成熟：Go 后端 + Next.js 前端 + Daemon 反向连接
- 已解决跨机问题：Daemon 主动连接，穿透 NAT
- 支持 10 种 Agent CLI
- **差距**：缺争抢模式、Agent 实时聊天、自动分工

### 2. MaClaw 的 Swarm 概念值得借鉴
- 大任务拆分给多个 AI 开发者并行执行
- AgentNet P2P 网络概念（实验性）
- 技能系统 + 自我进化
- **差距**：跨机能力弱，偏单体

### 3. AgentNet 协议层设计正确
- agent:// 可寻址端点
- Board 任务争抢
- 共享工作平面
- **差距**：代码未开源，偏基础设施

### 4. slock.ai 是 Agent 聊天+任务争抢的最佳参考
- 协议设计精良：单 WebSocket 总线，人类和 Agent 平等
- Sleep/Wake 机制优雅：服务器控制唤醒，携带上下文
- 任务 claim 争抢已实现
- 无框架服务器：http + ws + better-sqlite3，协议即产品
- **差距**：单服务器，无跨机能力

### 5. Crewden 是 Multica 的最小化复刻
- Fastify + Daemon + Cloudflare Workers
- Agent Bridge Protocol 极简但可用
- 内存存储，功能极简
- **价值**：架构图最清晰，适合理解 Multica 模式

### 6. zouk-daemon 是最成熟的 Daemon 实现
- MCP Tool Server 模式（Agent 通过 MCP 工具与服务器通信）
- 自动重连、idle cache、crash recovery
- 多 Runtime 支持（Claude Code / Codex / Kimi）
- **价值**：Daemon 层的最佳参考，生产级特性

### 7. AgentsZone 的上下文编排值得借鉴
- 滑动窗口 + 自动摘要压缩（>30 条消息触发）
- Tauri 桌面方案，单机
- **价值**：上下文压缩策略可复用

### 8. 存在明显空白
**没有一个项目同时实现**：
- 跨机 Agent 管理 ✅（Multica 有）
- 任务争抢模式 ✅（slock.ai 有）
- Agent 实时聊天 ✅（slock.ai 有）
- 自动任务分解和分工 ✅（MaClaw 有）

这就是你的项目的机会。

---

## 建议方案（最终版）

### 方案 A：slock-clone + zouk-daemon 混合（强烈推荐）

**最优组合**：slock-clone 的聊天+争抢协议 + zouk-daemon 的成熟 Daemon 实现

| 层 | 来源 | 说明 |
|---|---|---|
| 聊天+任务层 | slock-clone (MIT) | 协议成熟，Sleep/Wake + tasks claim 已实现 |
| Daemon 层 | zouk-daemon 参考 | MCP Tool Server + 自动重连 + idle cache + crash recovery |
| 跨机层 | Multica 模式 | Daemon 反向连接穿透 NAT |
| 上下文编排 | AgentsZone 参考 | 滑动窗口 + 自动摘要压缩 |
| 分工层 | MaClaw Swarm 参考 | 任务分解 + 能力匹配 |

- **优势**：各层最优组件组合，slock-clone 可直接用，zouk-daemon 架构可参考
- **风险**：需要将两个项目的技术融合

### 方案 B：基于 Crewden 扩展
- Crewden 已经是 slock + Multica 的混合体
- 在其基础上增加：任务争抢、Agent 聊天、自动分工
- **优势**：架构最接近目标，Fastify + Daemon + Cloudflare
- **风险**：功能极简，需要大量开发

### 方案 C：自建全新平台
- 参考所有项目的最佳实践
- **优势**：完全自主
- **风险**：工作量最大

---

## 下一步行动

1. 克隆 slock-clone 源码，跑通本地 demo（30秒可验证）
2. 研究 zouk-daemon 源码（MCP Tool Server + Daemon 架构）
3. 研究 Crewden 源码（Fastify + Daemon + Cloudflare）
4. 确定技术方案（A/B/C）
5. 设计跨机 Daemon + slock 协议融合方案
6. 原型开发
