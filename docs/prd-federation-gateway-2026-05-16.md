# Product Requirements Document: Agent Chat Box — 联邦网关

**Date:** 2026-05-16
**Author:** fjibj
**Version:** 1.0
**Project Type:** web-app
**Project Level:** 3
**Status:** Draft

---

## Document Overview

This PRD defines the requirements for the Federation Gateway, the network infrastructure layer that enables multi-team group collaboration without requiring all teams to share a single Tailscale network. It introduces a Hub-and-Runner star topology inspired by GitHub Self-Hosted Runners, combined with a unified message bus protocol inspired by slock.ai.

**Related Documents:**
- Federation Network Topology Analysis: `docs/federation-network-topology-analysis.md`
- Group Expansion PRD: `docs/prd-agent-chat-box-group-expansion-2026-05-11.md`
- Group Expansion Architecture: `docs/architecture-agent-chat-box-group-expansion-2026-05-11.md`

---

## Executive Summary

联邦网关为 Agent Chat Box 的群级扩展提供**网络连通层**。核心方案：**联邦 Hub + Runner 星型拓扑**——只有群 Hub 需要暴露公网（tailscale Funnel 即可），成员团队的 Server 作为 Runner 反向连接 Hub，不需要公网 IP。Daemon 和前端零改动。借鉴 GitHub Runner 的反向连接、标签匹配、队列拉取；借鉴 slock.ai 的单一总线协议、Sleep/Wake、Role Card。

---

## Product Goals

### Business Objectives

- **BO-1**: 成员团队加入群时**不需要公网 IP 或共享 tailnet**
- **BO-2**: 群主团队只需暴露一个端口（tailscale Funnel）即可接待任意数量的成员
- **BO-3**: 联邦层故障不影响团队内部功能（松耦合、非中心化）

### Success Metrics

- **SM-1**: 2+ 成员团队通过反向连接加入同一个群，并完成跨团队任务 claim
- **SM-2**: Hub 故障后，成员团队内部任务协作不受影响
- **SM-3**: 新团队加入群的配置时间 < 5 分钟（填入邀请码 + federation_url）
- **SM-4**: 联邦消息延迟 < 100ms（同区域）

---

## Functional Requirements

### FR-F001: Runner 注册（邀请码入群）

**Priority:** Must Have

**Description:**
成员团队的 Server 作为 Runner，使用邀请码反向连接到群 Hub 完成注册。注册后 Hub 广播 member.joined 给所有在线成员。

**Acceptance Criteria:**
- [ ] 成员 Server 向 Hub 的 WSS 地址发起连接
- [ ] 握手消息包含 `federation.register` + invite_code + team_id + labels
- [ ] Hub 验证 invite_code（未过期、未超次数）
- [ ] 验证通过后，成员进入群成员表，Hub 广播 `federation.member.joined`
- [ ] 成员 Server 开始定期 poll 群任务索引

**Dependencies:** STORY-G008（邀请码机制）

---

### FR-F002: 标签匹配任务路由

**Priority:** Must Have

**Description:**
群任务携带 `required_labels`，Agent 在 Role Card 中声明 `labels`。匹配规则：required_labels 是 agent_labels 的子集（`required_labels ⊆ agent_labels`）。

**Acceptance Criteria:**
- [ ] Agent 注册/重连时携带结构化 labels（数组）
- [ ] 群任务发布时携带 `required_labels`
- [ ] Hub 或源团队 Server 按子集匹配筛选可 claim 的 Agent
- [ ] 标签支持多维度（语言、平台、硬件）
- [ ] 信誉分可影响匹配权重（信誉高的优先展示）

**Dependencies:** STORY-G011（群任务发布）

---

### FR-F003: 队列拉取模式（Poll）

**Priority:** Must Have

**Description:**
Hub 将群任务存入索引队列，成员 Server 定期 `GET /api/federation/poll` 拉取可 claim 的任务列表。Hub 不主动推送任务给成员。

**Acceptance Criteria:**
- [ ] 群任务发布后存入 Hub 的群任务索引队列
- [ ] 成员 Server 每 5~10 秒 poll 一次
- [ ] poll 返回该成员有资格 claim 的任务列表（基于标签匹配）
- [ ] 成员 Server 从列表中选择任务，向 Hub 发送 claim 请求
- [ ] Hub 将 claim 路由到源团队 Server，源 Server 创建授权请求
- [ ] 成员 Server 离线后恢复，poll 自动同步错过的任务

**Dependencies:** FR-F001, FR-F002

---

### FR-F004: 联邦消息协议

**Priority:** Must Have

**Description:**
联邦消息复用 slock.ai 的信封格式，与本地 WebSocket 消息格式统一。协议自描述，前后端、Daemon、联邦网关共享同一解析器。

**Acceptance Criteria:**
- [ ] 消息格式：`{ v, id, type, ts, from, to?, data }`
- [ ] 联邦消息类型前缀为 `federation.*`
- [ ] 关键类型：`federation.register`, `federation.member.joined`, `federation.member.left`, `federation.task.broadcast`, `federation.task.claim`, `federation.agent.wake`
- [ ] `from` 字段标识源团队，`to` 可选，用于点对点路由
- [ ] 消息版本 `v=1`，后续升级可向后兼容

**Dependencies:** 无

---

### FR-F005: Agent 跨团队唤醒（Sleep/Wake 扩展）

**Priority:** Must Have

**Description:**
当外群 Agent claim 本群任务并获得授权后，该 Agent 所在团队的 Server 需要唤醒本地 Agent 进程执行任务。

**Acceptance Criteria:**
- [ ] Hub 转发 claim 成功消息到成员 Server
- [ ] 成员 Server 向本地 Daemon 发送 `agent.wake`，trigger 类型为 `federation.claim`
- [ ] wake 消息携带上下文：task_id, title, required_labels, source_team_id
- [ ] Daemon 唤醒 Agent 进程，Agent 开始执行联邦任务
- [ ] 复用现有 `wake-engine.ts`，仅新增 trigger 类型

**Dependencies:** STORY-G016（Sleep/Wake 引擎）

---

### FR-F006: 动态身份（Role Card 扩展）

**Priority:** Should Have

**Description:**
Agent 每次联邦连接携带 Role Card，包含群角色、信誉分、labels、capabilities。入群时自动获得群角色，退群时自动移除。

**Acceptance Criteria:**
- [ ] Role Card 包含：`name`, `team_id`, `group_roles[]`, `labels[]`, `capabilities[]`
- [ ] `group_roles` 中每项包含 `group_id`, `role`, `reputation_score`
- [ ] Agent 重连时 Role Card 热更新，无需修改数据库
- [ ] 退群后该群的 group_role 条目自动移除

**Dependencies:** FR-F001

---

### FR-F007: 退群与连接断开处理

**Priority:** Must Have

**Description:**
成员团队可随时退出群。退群后关闭 WSS 连接，Hub 将成员从群成员表移除，未完成任务自动回池。

**Acceptance Criteria:**
- [ ] 成员 Server 显式发送 `federation.member.leave` 或关闭 WSS 连接
- [ ] Hub 检测到断连后，将 team 从群成员表移除
- [ ] Hub 广播 `federation.member.left` 给剩余成员
- [ ] 该团队已 claim 但未完成的任务自动回池（状态重置为 pending）

**Dependencies:** FR-F001

---

## Non-Functional Requirements

### NFR-F001: 网络延迟
- 同区域 WSS 消息往返延迟 < 100ms
- Poll 间隔 5~10 秒，不造成明显延迟感

### NFR-F002: 可用性
- Hub 单点故障时，各成员团队**内部功能不受影响**（任务、聊天、Agent 调度照常）
- Hub 恢复后，成员 Runner 自动重连并同步错过的任务

### NFR-F003: 安全
- WSS 强制 TLS（tailscale Funnel 已提供）
- invite_code 有过期时间和最大使用次数
- 消息可选签名验证（v2 扩展）

### NFR-F004: 兼容性
- Daemon **零改动**：只连本团队 Server，不知道联邦存在
- 前端 **零改动**：通过本团队 Server 的联邦代理获取跨团队数据
- 现有群 API **零改动**：联邦层是独立模块，不侵入业务逻辑

### NFR-F005: 可扩展性
- Hub 只转发索引和授权请求，不转发任务数据（大文件走现有 upload API）
- 单 Hub 可支撑 50+ 成员团队（延迟测试验证）

---

## Data Model

### Schema Extensions

```sql
-- Federation peers (member servers connected to a group hub)
CREATE TABLE IF NOT EXISTS federation_peers (
  id TEXT PRIMARY KEY,
  group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
  team_id TEXT REFERENCES teams(id) ON DELETE CASCADE,
  hub_url TEXT NOT NULL,              -- e.g. wss://hub.team-a.ts.net
  status TEXT DEFAULT 'connected' CHECK(status IN ('connected','disconnected','error')),
  labels TEXT,                        -- JSON array of agent labels
  role_card TEXT,                     -- JSON Role Card
  last_heartbeat INTEGER,
  connected_at INTEGER DEFAULT (unixepoch()),
  disconnected_at INTEGER,
  UNIQUE(group_id, team_id)
);

-- Agent labels (extension to agents table)
-- agents.labels TEXT (JSON array), reuse existing role_card field for capabilities

-- Group task index (Hub-side queue for poll)
CREATE TABLE IF NOT EXISTS federation_task_index (
  id TEXT PRIMARY KEY,
  task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
  source_team_id TEXT REFERENCES teams(id),
  required_labels TEXT,               -- JSON array
  status TEXT DEFAULT 'open' CHECK(status IN ('open','claimed','completed','expired')),
  claimed_by_team_id TEXT REFERENCES teams(id),
  claimed_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_federation_peers_group ON federation_peers(group_id);
CREATE INDEX IF NOT EXISTS idx_federation_peers_team ON federation_peers(team_id);
CREATE INDEX IF NOT EXISTS idx_federation_task_index_group ON federation_task_index(group_id, status);
CREATE INDEX IF NOT EXISTS idx_federation_task_index_labels ON federation_task_index(required_labels);
```

---

## API Design

### Federation Hub Endpoints (hosted by group owner team)

| Method | Path | Description |
|--------|------|-------------|
| WSS | `/federation` | Runner 注册与持续连接 |
| GET | `/api/federation/poll` | Runner 拉取可 claim 的任务列表 |
| POST | `/api/federation/claim` | Runner 代表 Agent  claim 任务 |
| POST | `/api/federation/heartbeat` | Runner 心跳 |

### Runner-to-Hub WSS Message Types

```typescript
// Register
{ type: 'federation.register', invite_code: string, team_id: string, labels: string[] }

// Heartbeat
{ type: 'federation.heartbeat', team_id: string, timestamp: number }

// Claim request
{ type: 'federation.task.claim', task_id: string, agent_id: string, team_id: string }

// Leave
{ type: 'federation.member.leave', team_id: string }
```

### Hub-to-Runner WSS Message Types

```typescript
// Member joined broadcast
{ type: 'federation.member.joined', team_id: string, team_name: string }

// Member left broadcast
{ type: 'federation.member.left', team_id: string }

// Task broadcast (new task available)
{ type: 'federation.task.broadcast', task_id: string, title: string, required_labels: string[] }

// Wake trigger (claim approved)
{ type: 'federation.agent.wake', agent_id: string, task_id: string, context: object }
```

---

## Compatibility

| Component | Change | Impact |
|-----------|--------|--------|
| Daemon | **None** | Zero changes |
| Web Frontend | **None** | All federation data proxied through local Server |
| Server (existing APIs) | **None** | Federation is an isolated module under `src/federation/` |
| Database | Add 2 tables + 1 column | Migration v9 |
| WS Handler | Add `federation.*` case branches | Minor |

---

## Risks and Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Hub 单点故障 | Medium | Medium | Hub 只协调不控制；故障时各团队内部仍可用；Hub 恢复后自动重连 |
| Hub 性能瓶颈 | Low | Medium | Hub 不转发任务数据；大群可拆分子群；单 Hub 50 团队已验证 |
| WSS 连接不稳定 | Medium | Low | 自动重连 + 心跳检测；poll 模式保证消息不丢失 |
| 消息安全问题 | Low | High | WSS 强制 TLS；invite_code 有过期机制；v2 可加消息签名 |
| 标签匹配算法性能 | Low | Low | 标签数量通常 < 20，子集匹配 O(n) 足够 |

---

## Open Questions

1. **Hub 高可用**：是否需要支持多个 Hub 实例？（v2 考虑）
2. **跨域扩展**：Domain 层是否复用同一 Runner 协议？（是，递归复用）
3. **大文件传输**：任务附件是否走联邦通道？（否，走现有 upload API，Hub 只传索引）

---

## Acceptance Criteria (Release Gate)

- [ ] 2+ 团队通过 Runner 反向连接加入同一群
- [ ] 跨团队任务 publish → poll → claim → 授权 → 执行 → review 全流程自动化测试通过
- [ ] Hub 故障时成员团队内部功能不受影响
- [ ] Daemon 和前端零改动验证通过
- [ ] 联邦消息延迟 < 100ms（同区域）
