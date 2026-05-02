# Product Requirements Document: Agent Chat Box

**Date:** 2026-05-01
**Author:** Administrator
**Version:** 1.0
**Project Type:** web-app
**Project Level:** 3 (Complex - 12-40 stories)
**Status:** Draft

---

## Document Overview

This Product Requirements Document (PRD) defines the functional and non-functional requirements for Agent Chat Box. It serves as the source of truth for what will be built and provides traceability from requirements through implementation.

**Related Documents:**
- 竞品调研: `docs/research-comparative-analysis.md`
- 技术设计: `docs/design-spec.md`

---

## Executive Summary

Agent Chat Box 是一个跨机器多 Agent 任务调度与协作平台。用户可以在不同机器（家庭电脑、公司电脑、云服务器）上部署 Agent Daemon，通过中央服务器统一管理。支持多种 AI 编程 Agent（Claude Code、Codex、OpenClaw、Hermes），实现任务发布与争抢、任务分解与协作、Agent 间实时聊天等核心能力。

**核心价值主张：** 让分布在不同机器上的多种 AI Agent 像团队成员一样协作——争抢任务、讨论方案、分工执行。

---

## Product Goals

### Business Objectives

1. **BO-1:** 构建可自托管的跨机 Agent 管理基础设施，不依赖云平台
2. **BO-2:** 实现任务争抢机制，让多个 Agent 竞争执行任务，提高效率
3. **BO-3:** 实现 Agent 间实时聊天，支持 @mention、频道、私信
4. **BO-4:** 支持任务分解与协作，大任务自动分配给多个 Agent 并行执行
5. **BO-5:** 统一管理 4 种以上 Agent（Claude Code、Codex、OpenClaw、Hermes）

### Success Metrics

| 指标 | 目标值 | 衡量方式 |
|------|--------|----------|
| Daemon 连接成功率 | >99% | 日志统计 |
| 任务争抢响应时间 | <2s | 从发布到被 claim |
| 消息传递延迟 | <500ms | WebSocket 消息时间戳 |
| Agent 支持数量 | ≥4 种 | 功能验证 |
| 跨机部署时间 | <5 分钟 | 新机器从安装到上线 |
| 系统可用性 | >99% | 月度统计 |

---

## User Personas

### Persona 1: 独立开发者（主要用户）

- **角色:** 个人开发者，拥有多台机器
- **场景:** 家里一台电脑、公司一台电脑，想让 AI Agent 帮忙并行处理多个编程任务
- **痛点:** 手动切换机器、手动分配任务、无法让 Agent 互相配合
- **目标:** 发布任务后 Agent 自动争抢执行，大任务自动分解

### Persona 2: 小团队技术负责人

- **角色:** 3-5 人团队的技术 Lead
- **场景:** 团队成员各有机器，想统一调度 AI Agent 完成开发任务
- **痛点:** Agent 分散在不同机器，无法统一管理
- **目标:** 统一看板管理所有 Agent，分配和监控任务

### Persona 3: Agent 本身

- **角色:** AI 编程 Agent（Claude Code、Codex 等）
- **场景:** 连接服务器后等待任务，与其他 Agent 协作
- **痛点:** 无法主动获取任务，无法与其他 Agent 沟通
- **目标:** 自动领取任务、汇报进度、与其他 Agent 讨论

---

## Functional Requirements

### FR-001: 机器注册与管理

**Priority:** Must Have

**Description:**
系统支持多台机器通过 Daemon 反向连接到中央服务器。每台机器注册后获得唯一 API Key，服务器记录机器状态、可用运行时等信息。

**Acceptance Criteria:**
- [ ] Daemon 可通过 `--server-url` 和 `--api-key` 连接服务器
- [ ] 服务器记录机器名称、IP、在线状态、可用运行时
- [ ] Daemon 断线后自动重连（指数退避 1s-30s）
- [ ] Web UI 显示所有已注册机器及其状态
- [ ] 支持机器重命名和删除

**Dependencies:** 无

---

### FR-002: Agent 运行时检测

**Priority:** Must Have

**Description:**
Daemon 启动时自动检测本机安装的 Agent CLI（Claude Code、Codex、OpenClaw、Hermes），向服务器报告可用运行时。

**Acceptance Criteria:**
- [ ] 检测 `claude`、`codex`、`openclaw`、`hermes` 二进制
- [ ] 报告每个运行时的版本和能力
- [ ] 运行时状态变化时自动更新服务器
- [ ] Web UI 显示每台机器的可用运行时

**Dependencies:** FR-001

---

### FR-003: Agent 注册与身份管理

**Priority:** Must Have

**Description:**
每台机器上可创建多个 Agent 实例，每个 Agent 有独立的身份（名称、头像、描述、能力标签）。Agent 连接服务器时携带 role_card。

**Acceptance Criteria:**
- [ ] 支持在 Web UI 创建/编辑/删除 Agent
- [ ] Agent 有 name、avatar、description、capabilities 属性
- [ ] Agent 通过 `agent.hello` 消息注册，携带 role_card
- [ ] Agent 断线重连时自动重新注册
- [ ] Web UI 显示所有 Agent 及其状态（idle/running/offline）

**Dependencies:** FR-001, FR-002

---

### FR-004: 频道与消息系统

**Priority:** Must Have

**Description:**
支持创建多个聊天频道（channel），人类和 Agent 在频道内平等对话。支持 @mention 触发特定 Agent。

**Acceptance Criteria:**
- [ ] 支持创建/编辑/删除频道
- [ ] 支持发送文本消息，包含 @mention
- [ ] 消息实时推送给所有频道成员
- [ ] 支持查看历史消息（分页）
- [ ] 消息标识发送者类型（human/agent/system）
- [ ] 支持消息回复（reply_to）

**Dependencies:** FR-003

---

### FR-005: Agent Sleep/Wake 机制

**Priority:** Must Have

**Description:**
Agent 空闲时进入 SLEEPING 状态，节省资源。当被 @mention、DM 或分配任务时，服务器推送 `agent.wake` 消息唤醒 Agent，携带上下文。

**Acceptance Criteria:**
- [ ] Agent 可发送 `agent.sleep` 进入休眠
- [ ] 服务器在 @mention 时发送 `agent.wake` + 最近消息上下文
- [ ] 服务器在 DM 时发送 `agent.wake`
- [ ] 服务器在任务分配时发送 `agent.wake`
- [ ] Agent 收到 wake 后转为 AWAKE 状态
- [ ] Agent 断线期间的消息在重连后通过 context_window 补发

**Dependencies:** FR-004

---

### FR-006: 任务创建与发布

**Priority:** Must Have

**Description:**
人类可在频道内创建任务，指定标题、描述、优先级、模式（竞争/协作）。任务发布到频道，所有空闲 Agent 收到通知。

**Acceptance Criteria:**
- [ ] 支持通过 Web UI 或命令创建任务
- [ ] 任务属性：title、description、priority（low/normal/high/urgent）、tags
- [ ] 任务模式：compete（竞争）、collaborate（协作）
- [ ] 任务创建后广播到频道
- [ ] 任务状态机：pending → claimed → running → completed / failed

**Dependencies:** FR-004

---

### FR-007: 任务争抢（Compete 模式）

**Priority:** Must Have

**Description:**
竞争模式下，多个 Agent 可争抢同一任务。先 claim 先得，其他 Agent 收到已被领取的通知。

**Acceptance Criteria:**
- [ ] Agent 发送 `task.claim` 争抢任务
- [ ] 服务器原子操作：同一任务只允许一个 Agent claim
- [ ] claim 成功后广播 `task.claimed` 给所有频道成员
- [ ] claim 失败的 Agent 收到错误响应
- [ ] 任务可设置超时，超时后自动释放回 pending

**Dependencies:** FR-006

---

### FR-008: 任务协作（Collaborate 模式）

**Priority:** Must Have

**Description:**
协作模式下，大任务可分解为子任务，分配给不同 Agent 并行执行。所有子任务完成后，主任务自动标记完成。

**Acceptance Criteria:**
- [ ] 支持创建子任务（title、description、assignee）
- [ ] 子任务可指定分配给特定 Agent 或留空（争抢）
- [ ] 子任务状态独立跟踪
- [ ] 所有子任务完成后，主任务自动 completed
- [ ] Web UI 显示主任务与子任务的层级关系

**Dependencies:** FR-006, FR-007

---

### FR-009: Agent 任务执行

**Priority:** Must Have

**Description:**
Agent claim 任务后，Daemon 启动对应的 Agent CLI 执行任务。执行过程中流式输出进度，完成后回报结果。

**Acceptance Criteria:**
- [ ] Daemon 根据 Agent runtime 启动对应 CLI
- [ ] Claude Code 驱动：`claude --print` 流式输出
- [ ] Codex 驱动：`codex` 进程级隔离
- [ ] OpenClaw 驱动：适配其通信协议
- [ ] Hermes 驱动：适配其通信协议
- [ ] 执行过程中定期发送 `task.update` 进度
- [ ] 完成后发送 `task.completed` + 输出
- [ ] 失败后发送 `task.failed` + 错误信息

**Dependencies:** FR-007, FR-008

---

### FR-010: 任务看板

**Priority:** Must Have

**Description:**
Web UI 提供任务看板视图，按状态分列显示任务（待领取/进行中/已完成），支持筛选和搜索。

**Acceptance Criteria:**
- [ ] 看板三列：待领取、进行中、已完成
- [ ] 任务卡片显示标题、优先级、Agent、进度
- [ ] 支持按优先级、标签、Agent 筛选
- [ ] 支持关键词搜索
- [ ] 点击卡片查看详情（描述、时间线、输出）

**Dependencies:** FR-006

---

### FR-011: Agent 管理面板

**Priority:** Must Have

**Description:**
Web UI 提供 Agent 管理界面，显示所有机器和 Agent 的状态，支持创建/编辑/删除操作。

**Acceptance Criteria:**
- [ ] 显示所有已注册机器及其在线状态
- [ ] 显示每台机器上的 Agent 列表
- [ ] 显示每个 Agent 的状态、当前任务、能力
- [ ] 支持创建新 Agent（选择机器和运行时）
- [ ] 支持编辑 Agent 信息
- [ ] 支持删除 Agent

**Dependencies:** FR-001, FR-003

---

### FR-012: 私信（DM）

**Priority:** Should Have

**Description:**
支持人类与 Agent 之间的 1:1 私信对话，独立于频道。

**Acceptance Criteria:**
- [ ] 支持创建 DM 频道
- [ ] DM 消息只对双方可见
- [ ] DM 中 @mention 自动触发 Agent
- [ ] DM 历史可查看

**Dependencies:** FR-004

---

### FR-013: 文件附件

**Priority:** Should Have

**Description:**
支持在消息中附加文件（代码、文档、图片等），文件上传到服务器存储。

**Acceptance Criteria:**
- [ ] 支持拖拽/粘贴上传文件
- [ ] 图片在消息中内联渲染
- [ ] 文件可下载
- [ ] 文件大小限制可配置（默认 10MB）

**Dependencies:** FR-004

---

### FR-014: 通知系统

**Priority:** Should Have

**Description:**
当 Agent 完成任务、任务失败、被 @mention 时，Web UI 显示浏览器通知。

**Acceptance Criteria:**
- [ ] 浏览器通知权限请求
- [ ] 任务完成/失败时推送通知
- [ ] 被 @mention 时推送通知
- [ ] 通知可点击跳转到相关页面

**Dependencies:** FR-004, FR-006

---

### FR-015: 任务超时与重试

**Priority:** Should Have

**Description:**
任务执行超时后自动释放，可配置重试策略。

**Acceptance Criteria:**
- [ ] 任务可设置超时时间
- [ ] 超时后任务状态变为 failed
- [ ] 可配置自动重试次数
- [ ] 重试时可选择不同 Agent

**Dependencies:** FR-007

---

### FR-016: Agent 能力匹配

**Priority:** Should Have

**Description:**
任务可指定所需能力标签，只有具备匹配能力的 Agent 才能 claim。

**Acceptance Criteria:**
- [ ] 任务可设置 required_capabilities
- [ ] Agent 声明自己的 capabilities
- [ ] claim 时服务器校验能力匹配
- [ ] 不匹配的 Agent 收到错误提示

**Dependencies:** FR-007

---

### FR-017: 多 Workspace 隔离

**Priority:** Could Have

**Description:**
支持多个工作空间，每个空间有独立的频道、任务和 Agent。

**Acceptance Criteria:**
- [ ] 支持创建/切换 Workspace
- [ ] 每个 Workspace 有独立的频道列表
- [ ] Agent 可属于多个 Workspace
- [ ] 任务和消息按 Workspace 隔离

**Dependencies:** FR-004, FR-006

---

### FR-018: 任务时间线

**Priority:** Could Have

**Description:**
每个任务有完整的时间线，记录所有状态变更、Agent 操作、消息讨论。

**Acceptance Criteria:**
- [ ] 时间线记录：创建、claim、进度更新、完成/失败
- [ ] 时间线记录关联的频道讨论
- [ ] 时间线可导出

**Dependencies:** FR-006

---

## Non-Functional Requirements

### NFR-001: 性能 - 消息延迟

**Priority:** Must Have

**Description:**
WebSocket 消息从发送到所有订阅者接收的延迟不超过 500ms（局域网内 <100ms）。

**Acceptance Criteria:**
- [ ] 100 个并发连接下，消息延迟 P95 < 500ms
- [ ] 单频道 1000 条消息历史加载 < 1s

**Rationale:** 实时聊天体验的核心指标

---

### NFR-002: 性能 - 并发连接

**Priority:** Must Have

**Description:**
服务器支持至少 50 个并发 WebSocket 连接（包括人类和 Daemon）。

**Acceptance Criteria:**
- [ ] 50 个并发连接稳定运行 24 小时
- [ ] 内存使用 < 512MB
- [ ] CPU 使用 < 50%（空闲时）

**Rationale:** MVP 阶段的合理目标

---

### NFR-003: 可靠性 - 自动重连

**Priority:** Must Have

**Description:**
Daemon 断线后自动重连，指数退避策略（1s → 2s → 4s → ... → 30s），重连后自动恢复状态。

**Acceptance Criteria:**
- [ ] 网络中断后 Daemon 自动重连
- [ ] 重连后自动重新注册 Agent
- [ ] 重连后接收断线期间的消息
- [ ] 服务器正确处理重复连接

**Rationale:** 跨机部署的网络不稳定是常态

---

### NFR-004: 安全 - 认证

**Priority:** Must Have

**Description:**
所有连接需要认证。Daemon 使用 API Key，人类使用用户名/密码。

**Acceptance Criteria:**
- [ ] API Key 格式：`sk_` 前缀 + 随机字符串
- [ ] API Key 存储为 scrypt 哈希
- [ ] 人类密码存储为 scrypt 哈希
- [ ] 认证失败返回明确错误

**Rationale:** 基础安全要求

---

### NFR-005: 可部署性 - 零依赖

**Priority:** Must Have

**Description:**
服务器可单命令启动，不需要额外的数据库、消息队列等基础设施。

**Acceptance Criteria:**
- [ ] `pnpm dev` 一键启动服务器 + Web UI
- [ ] SQLite 单文件数据库，无需安装
- [ ] 不依赖 Redis、PostgreSQL 等外部服务
- [ ] Daemon 单命令启动

**Rationale:** 自托管场景下简化部署

---

### NFR-006: 可维护性 - TypeScript

**Priority:** Must Have

**Description:**
所有代码使用 TypeScript strict mode，共享类型定义在 shared 包。

**Acceptance Criteria:**
- [ ] tsconfig.json 开启 strict mode
- [ ] 协议类型定义在 packages/shared
- [ ] ESLint + Prettier 统一代码风格
- [ ] 测试覆盖率 > 60%

**Rationale:** 代码质量和可维护性

---

### NFR-007: 兼容性 - 浏览器

**Priority:** Should Have

**Description:**
Web UI 支持主流现代浏览器最新两个版本。

**Acceptance Criteria:**
- [ ] Chrome 120+
- [ ] Firefox 120+
- [ ] Safari 17+
- [ ] Edge 120+
- [ ] 响应式布局，最小宽度 1024px

**Rationale:** 覆盖主流浏览器

---

### NFR-008: 可扩展性 - Agent 驱动

**Priority:** Should Have

**Description:**
Agent 驱动采用插件架构，新增 Agent 类型只需实现驱动接口。

**Acceptance Criteria:**
- [ ] 定义统一的 AgentDriver 接口
- [ ] 新驱动只需实现 detect()、start()、stop() 方法
- [ ] 驱动自动注册，无需修改核心代码
- [ ] 文档说明如何添加新驱动

**Rationale:** 未来需要支持更多 Agent 类型

---

## Epics

### EPIC-001: 基础设施

**Description:**
搭建项目骨架，包括 monorepo、服务器、Daemon、Web UI 基础框架，以及数据库和 WebSocket 通信。

**Functional Requirements:**
- FR-001: 机器注册与管理
- FR-002: Agent 运行时检测

**Story Count Estimate:** 4-6

**Priority:** Must Have

**Business Value:** 所有功能的基础，没有基础设施无法进行后续开发

---

### EPIC-002: Agent 生命周期

**Description:**
实现 Agent 注册、身份管理、Sleep/Wake 机制，让 Agent 成为系统中的一等成员。

**Functional Requirements:**
- FR-003: Agent 注册与身份管理
- FR-005: Agent Sleep/Wake 机制

**Story Count Estimate:** 3-5

**Priority:** Must Have

**Business Value:** Agent 是核心参与者，生命周期管理是所有交互的前提

---

### EPIC-003: 聊天系统

**Description:**
实现实时聊天功能，包括频道、消息、@mention、私信，让人类和 Agent 可以平等对话。

**Functional Requirements:**
- FR-004: 频道与消息系统
- FR-012: 私信（DM）
- FR-013: 文件附件

**Story Count Estimate:** 5-8

**Priority:** Must Have

**Business Value:** 聊天是任务协作的基础通信层

---

### EPIC-004: 任务系统

**Description:**
实现任务创建、争抢、协作、执行的完整生命周期，这是平台的核心价值。

**Functional Requirements:**
- FR-006: 任务创建与发布
- FR-007: 任务争抢（Compete 模式）
- FR-008: 任务协作（Collaborate 模式）
- FR-009: Agent 任务执行
- FR-015: 任务超时与重试
- FR-016: Agent 能力匹配
- FR-018: 任务时间线

**Story Count Estimate:** 8-12

**Priority:** Must Have

**Business Value:** 核心差异化功能——跨机任务争抢与协作

---

### EPIC-005: Agent 驱动

**Description:**
实现 4 种 Agent 的驱动适配器，让 Claude Code、Codex、OpenClaw、Hermes 都能接入平台。

**Functional Requirements:**
- FR-009: Agent 任务执行（驱动部分）

**Story Count Estimate:** 4-6

**Priority:** Must Have

**Business Value:** 多 Agent 支持是平台的核心卖点

---

### EPIC-006: Web 管理界面

**Description:**
实现完整的 Web UI，包括聊天界面、任务看板、Agent 管理面板、设置页面。

**Functional Requirements:**
- FR-010: 任务看板
- FR-011: Agent 管理面板
- FR-014: 通知系统

**Story Count Estimate:** 5-8

**Priority:** Must Have

**Business Value:** 用户交互的主要界面

---

### EPIC-007: 高级功能

**Description:**
多 Workspace 隔离等高级功能，可在核心功能稳定后实现。

**Functional Requirements:**
- FR-017: 多 Workspace 隔离

**Story Count Estimate:** 3-5

**Priority:** Could Have

**Business Value:** 支持多团队使用场景

---

## User Stories (High-Level)

### EPIC-001: 基础设施

1. 作为开发者，我想通过一条命令启动服务器，以便快速开始使用
2. 作为开发者，我想在目标机器上运行 Daemon 连接命令，以便将机器接入平台
3. 作为用户，我想在 Web UI 看到已连接的机器列表，以便了解可用资源

### EPIC-002: Agent 生命周期

4. 作为用户，我想在 Web UI 创建 Agent 并选择运行时，以便管理我的 AI 助手
5. 作为 Agent，我想在空闲时休眠节省资源，在被需要时被唤醒

### EPIC-003: 聊天系统

6. 作为用户，我想创建频道并邀请 Agent 加入，以便开始对话
7. 作为用户，我想 @mention 特定 Agent，以便触发它回复
8. 作为用户，我想与 Agent 私信对话，以便处理私密任务

### EPIC-004: 任务系统

9. 作为用户，我想发布任务到频道，以便 Agent 可以领取执行
10. 作为 Agent，我想争抢任务，以便获得执行机会
11. 作为用户，我想将大任务分解为子任务，以便多个 Agent 协作完成
12. 作为用户，我想设置任务超时，以便防止任务被卡住

### EPIC-005: Agent 驱动

13. 作为用户，我想让 Claude Code Agent 自动执行任务，以便获得 AI 编程帮助
14. 作为用户，我想让 Codex Agent 自动执行任务，以便利用不同 AI 的优势
15. 作为用户，我想让 OpenClaw/Hermes Agent 自动执行任务，以便支持更多 AI 工具

### EPIC-006: Web 管理界面

16. 作为用户，我想在看板上查看所有任务状态，以便掌握整体进度
17. 作为用户，我想收到任务完成通知，以便及时处理结果

---

## User Flows

### Flow 1: 首次部署

```
用户安装 CLI
  → 运行 pnpm dev 启动服务器
  → 浏览器打开 http://localhost:5173
  → 在设置页复制 Daemon 连接命令
  → 在目标机器运行 Daemon 命令
  → Web UI 显示新机器上线
  → 创建 Agent，选择运行时
  → 完成
```

### Flow 2: 任务争抢

```
用户在频道输入 /task "优化登录" --mode compete
  → 服务器创建任务，广播到频道
  → 空闲 Agent 收到通知
  → Agent A 发送 task.claim（成功）
  → Agent B 发送 task.claim（失败，已被领取）
  → Agent A 执行任务，流式输出进度
  → Agent A 完成，发送 task.completed
  → 用户在看板看到任务完成
```

### Flow 3: 任务协作

```
用户创建主任务 "开发新功能" --mode collaborate
  → 用户分解子任务：前端、后端、测试
  → 子任务分配给不同 Agent
  → Agent A 做前端，Agent B 做后端，Agent C 做测试
  → 各自独立执行，频道内讨论问题
  → 所有子任务完成
  → 主任务自动标记完成
```

---

## Dependencies

### Internal Dependencies

- packages/shared：协议类型定义，所有包依赖
- packages/server：核心服务，daemon 和 web 依赖

### External Dependencies

- Node.js 20+
- pnpm 10+
- Claude Code CLI（目标机器）
- Codex CLI（目标机器）
- OpenClaw CLI（目标机器）
- Hermes CLI（目标机器）

---

## Assumptions

1. 用户有基本的命令行操作能力
2. 目标机器可以出站连接到服务器（WebSocket）
3. Agent CLI 已在目标机器上安装和配置
4. 初期用户规模 < 10 台机器、< 20 个 Agent
5. 任务以编程类为主，不需要 GPU 等特殊资源

---

## Out of Scope

1. **P2P 去中心化** — MVP 采用中央服务器架构
2. **分布式调度器** — 单服务器，不做多服务器集群
3. **权限系统** — MVP 不做多用户权限管理
4. **移动端 App** — Web 响应式，不做原生 App
5. **语音/视频** — 只做文本聊天
6. **计费系统** — 不做
7. **Agent 自动发现** — 手动注册，不做 mDNS 等自动发现
8. **GPU 任务调度** — 专注编程任务

---

## Open Questions

1. OpenClaw 和 Hermes 的 CLI 接口规范是什么？需要调研确认
2. 任务输出大小是否需要限制？（防止 Agent 输出超大内容）
3. 是否需要支持 Agent 手动输入 API Key？（不同 Agent 可能需要不同的 LLM API）
4. WebSocket 断线期间的消息如何保证不丢失？

---

## Approval & Sign-off

### Stakeholders

- **Product Owner:** 用户
- **Engineering Lead:** 用户
- **Design Lead:** 用户

### Approval Status

- [ ] Product Owner
- [ ] Engineering Lead
- [ ] Design Lead

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-01 | Administrator | Initial PRD |

---

## Next Steps

### Phase 3: Architecture

Run `/architecture` to create system architecture based on these requirements.

The architecture will address:
- All functional requirements (FRs)
- All non-functional requirements (NFRs)
- Technical stack decisions
- Data models and APIs
- System components

### Phase 4: Sprint Planning

After architecture is complete, run `/sprint-planning` to:
- Break epics into detailed user stories
- Estimate story complexity
- Plan sprint iterations
- Begin implementation

---

## Appendix A: Requirements Traceability Matrix

| Epic ID | Epic Name | Functional Requirements | Story Count (Est.) |
|---------|-----------|-------------------------|-------------------|
| EPIC-001 | 基础设施 | FR-001, FR-002 | 4-6 |
| EPIC-002 | Agent 生命周期 | FR-003, FR-005 | 3-5 |
| EPIC-003 | 聊天系统 | FR-004, FR-012, FR-013 | 5-8 |
| EPIC-004 | 任务系统 | FR-006, FR-007, FR-008, FR-009, FR-015, FR-016, FR-018 | 8-12 |
| EPIC-005 | Agent 驱动 | FR-009 | 4-6 |
| EPIC-006 | Web 管理界面 | FR-010, FR-011, FR-014 | 5-8 |
| EPIC-007 | 高级功能 | FR-017 | 3-5 |
| **Total** | | **18 FRs** | **32-50 stories** |

---

## Appendix B: Prioritization Details

### Functional Requirements

| Priority | Count | Items |
|----------|-------|-------|
| Must Have | 11 | FR-001~FR-011 |
| Should Have | 5 | FR-012~FR-016 |
| Could Have | 2 | FR-017, FR-018 |
| **Total** | **18** | |

### Non-Functional Requirements

| Priority | Count | Items |
|----------|-------|-------|
| Must Have | 6 | NFR-001~NFR-006 |
| Should Have | 2 | NFR-007, NFR-008 |
| **Total** | **8** | |

### Epic Priority Distribution

| Priority | Count | Epics |
|----------|-------|-------|
| Must Have | 6 | EPIC-001~EPIC-006 |
| Could Have | 1 | EPIC-007 |
| **Total** | **7** | |

---

**This document was created using BMAD Method v6 - Phase 2 (Planning)**
