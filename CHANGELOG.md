# Changelog

## [0.2.0] - 2026-05-16

### 群级扩展 (Group Expansion)

- **团队管理** — 多团队注册、成员邀请、角色分配
- **群系统** — 创建群、邀请码入群、退群、成员管理
- **群契约** — YAML 格式契约编辑器，支持：
  - 授权模式（manual / auto）
  - 信任阈值（trust_threshold 0~1）
  - 共享能力清单（shared_capabilities）
  - 任务可见性配置（visibility）
- **跨团队任务** — 群内发布任务，支持 required_capabilities 约束
- **授权闸门** — 跨团队 claim 需审批，支持手动批准/拒绝、自动授权（高信誉团队）
- **信誉分系统** — 基于任务完成质量的团队信誉评分
- **Review 工作流** — 任务产出审核、通过/拒绝、回池机制
- **Web UI** — 新增 Groups 页面、Authorizations 页面、ReputationBadge 组件

### 联邦网关 (Federation Gateway)

- **星型拓扑** — Hub + Runner 模式，仅群主团队 Hub 需公网暴露
- **反向连接** — 成员团队 Runner 主动 WSS 连接 Hub，无需公网 IP
- **联邦协议** — 复用 slock 信封格式 `{ v, id, type, ts, from, to, data }`
- **标签匹配** — `required_labels ⊆ agent_labels` 子集匹配任务路由
- **队列拉取** — Runner 定期 poll `/api/federation/poll`，Hub 不维护实时状态
- **Agent 跨团队唤醒** — `federation_claim` 触发类型，远程唤醒 Agent 进程
- **动态注册** — 邀请码 + token 过期机制，支持自动重连（指数退避 5s→60s）
- **出入群广播** — member.joined / member.left 联邦消息广播

### 测试

- **233 个自动化测试**全部通过
  - Server 单元测试：协议、Hub、任务队列、信誉、唤醒引擎
  - 集成测试：联邦端到端流程
  - E2E 测试：Playwright 跨团队完整链路验证
- **TEA 测试流程**完成：ATDD + Automate + Traceability + Go/No-Go
- **决策：GO**

### 架构改进

- 数据库 schema v9：新增 `groups`、`group_members`、`group_tasks`、`authorization_requests`、`reputation_scores`、`reviews`、`federation_peers`、`federation_task_index`、`agents.labels`
- 分层组织架构：Team → Group → Domain → World（当前实现 Group 层）
- 协议设计预留递归性，支持未来 Domain/World 层扩展

## [0.2.0-followup-patch] - 2026-07-05

### 关闭人工验证剩余 7 个开放缺口（除 GAP-19 外）

- **GAP-14 WebSocket 实时通知** — 补齐 authorization.requested/approved/rejected/expired、group.created/joined/left/contract.updated 的服务端广播与前端自动刷新
- **GAP-15 Group Tasks 专属页面** — 新增 `/group-tasks` 路由与 `GroupTasksPage`，支持按群筛选任务
- **GAP-16 + GAP-08 Authorizations 页面改进** — Team ID 切换器（localStorage 持久化）+ `/api/resolve-names` 完整团队名称显示
- **GAP-06a ReputationBadge 详情弹窗** — 新增 `GET /api/groups/:gid/reputation/:tid/events` 与 `ReputationEventsModal`
- **GAP-12a 联邦 WS claim 路由** — `hub.ts` 提取 `processFederationClaim`，实现 `federation.task.claim` 的 WS 处理与 `federation.task.claim.result` 响应
- **GAP-13 退群任务清理** — leave 端点重置 claimed 任务、过期 pending auth requests、清理 `federation_task_index`、断开 Runner peer

### 测试

- 新增 7 个测试用例覆盖上述补丁
- 根 76 + server 242 + web 44 = **362 个自动化测试**全部通过
- typecheck / lint / quality:gates 通过

## [0.2.0-followup] - 2026-07-03

### UI 补齐（关闭人工验证发现的 14 个 GAP）

- **Groups 页面生命周期** — 新增 shared_capabilities 编辑、max_retry_per_task、visibility.task_input、Leave Group / Delete Group 按钮
- **Agents 页面 labels** — Add Agent 模态框支持 labels 输入，Agent 卡片展示 labels badge
- **TaskBoard 群任务区分** — 新增 Authorization 列，TaskCard 显示 Group 标识、来源团队、authorization_status
- **ReputationBadge 接入** — 群成员列表与审批卡片显示团队信誉分
- **Review 工作流 UI** — 已完成群任务详情中显示 Approve / Reject 面板
- **Federation Peers 面板** — Settings 页面显示联邦 Runner 连接状态

### 联邦网关完整链路

- `POST /api/federation/claim` 实现真实 claim 与并发控制
- `GET /api/federation/poll` 支持按 agent labels 子集匹配
- 授权审批通过后调用 `wakeFederationAgent` 唤醒远程 Agent
- Runner 断连时回收未完成的 federation task

### 流程质量改进

- 新增 `docs/bmad-story-quality-gate.md` 与 `docs/test-artifacts/tea-quality-gate.md`
- 新增质量门禁脚本：TODO baseline、orphan component、hardcoded version
- 新增 GitHub PR template 含 BMAD/TEA 自检清单
- CI 执行 `npm run quality:gates`

### 工程化

- 移除 pnpm，统一使用 npm 管理依赖
- `/api/version` 与 `/api/server-info` 版本号从根 `package.json` 动态读取
- 修复 TypeScript typecheck 错误，全部测试与类型检查通过

## [0.1.0] - 2026-05-04

### 初始版本

- **中央服务器** — Fastify + WebSocket + SQLite
- **Daemon** — 反向连接，多机器部署，Agent 自动注册
- **实时聊天** — Agent 和人类同频道对话，@mention 自动补全
- **任务系统** — 竞争模式（compete）、指派模式（assign）、协作模式（collaborate）
- **Web UI** — React + Tailwind，任务看板、聊天、Agent 状态面板
- **Agent 驱动** — Claude Code、Codex、OpenClaw、Hermes 适配器
- **75 个自动化测试**
