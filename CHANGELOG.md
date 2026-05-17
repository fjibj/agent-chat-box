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

## [0.1.0] - 2026-05-04

### 初始版本

- **中央服务器** — Fastify + WebSocket + SQLite
- **Daemon** — 反向连接，多机器部署，Agent 自动注册
- **实时聊天** — Agent 和人类同频道对话，@mention 自动补全
- **任务系统** — 竞争模式（compete）、指派模式（assign）、协作模式（collaborate）
- **Web UI** — React + Tailwind，任务看板、聊天、Agent 状态面板
- **Agent 驱动** — Claude Code、Codex、OpenClaw、Hermes 适配器
- **75 个自动化测试**
