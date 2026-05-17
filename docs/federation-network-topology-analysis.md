# 群网络拓扑方案分析：slock.ai + GitHub Self-Hosted Runner 借鉴

**Date:** 2026-05-16
**Context:** Agent Chat Box 群级扩展的网络拓扑设计

---

## 1. 当前方案的瓶颈

之前的联邦式群网关设想：

```
团队A Server ◄────WSS────► 团队B Server ◄────WSS────► 团队C Server
     ↑                                              ↑
  Daemon A                                      Daemon C
```

**问题**：每个团队的 Server 都需要暴露公网地址（或 tailscale Funnel），否则无法被其他团队连接。这对小团队/个人用户不友好。

---

## 2. 参考项目核心机制

### 2.1 slock.ai — 单一总线协议 + Sleep/Wake

**来源**: github.com/botiverse/slock

| 机制 | 设计 | 价值 |
|------|------|------|
| **单一 WebSocket 总线** | 人类和 Agent 共用同一消息格式：`{ v, id, type, ts, data }` | 前后端、CLI、Agent 共享解析器，协议即产品 |
| **Sleep/Wake** | Agent 空闲时 sleep；服务器在 @mention / assign 时推送 `agent.wake` + 上下文 | 节省资源，Agent 不轮询，上下文自动携带 |
| **Role Card on hello** | 每次连接携带身份卡：`{ name, avatar, system_prompt, capabilities }` | 热更新身份，换提示词只需重连 |
| **首条消息定身份** | `auth.login` → 人类；`agent.hello` → Agent | 无预注册，协议自描述 |

**对我们的启示**：联邦消息可以复用 slock 的信封格式，Agent 跨团队唤醒可以复用 Sleep/Wake 机制。

### 2.2 GitHub Self-Hosted Runner — 反向连接 + 标签匹配 + 队列拉取

**来源**: docs.github.com/en/actions/hosting-your-own-runners

| 机制 | 设计 | 价值 |
|------|------|------|
| **反向连接** | Runner 主动 HTTPS/WSS 连接 GitHub Actions，不需要公网 IP | 解决 NAT，不需要开放入站端口 |
| **标签匹配** | `.yml` 中 `runs-on: [self-hosted, linux, gpu]` 匹配 runner labels | 精确任务路由，多维度筛选 |
| **队列拉取** | Runner 定期 `GET /runner/poll` 拉取 job，不是推送 | GitHub 不需要维护 runner 连接状态 |
| **动态注册** | `config.sh --url <repo> --token <token>`，token 有过期时间 | 安全，用完可注销 |
| **心跳机制** | Runner 定期心跳，GitHub 知道哪些在线 | 故障检测，自动重新分配 |

**对我们的启示**：用 Runner 模式替代"两两互联"，只有群 Hub 需要暴露公网。

---

## 3. 改进后的群网络拓扑：联邦 Hub + Runner 星型

### 3.1 拓扑结构

```
                    [群 Hub Server]
                    (群主团队托管)
                         ↑
        ┌────────────────┼────────────────┐
        │ WSS (反向连接)   │ WSS (反向连接)   │ WSS (反向连接)
        ↓                ↓                ↓
   [团队A Server]   [团队B Server]   [团队C Server]
        ↑                ↑                ↑
   [Daemon A1]      [Daemon B1]      [Daemon C1]
   [Daemon A2]      [Daemon B2]
```

**关键点**：
- **Hub Server**：群主团队托管，通过 tailscale Funnel 或公网暴露 WSS
- **成员 Server**：作为 Runner，反向连接到 Hub，**不需要公网 IP**
- **Daemon**：只连本团队 Server，完全不变
- **团队内部**：tailscale 组网不变

### 3.2 与当前代码的兼容

| 层级 | 当前 | 联邦化后 | 改动量 |
|------|------|---------|--------|
| Daemon | 反向连接本团队 Server | 不变 | 零改动 |
| 团队 Server | 单机 ACB Server | 增加 Runner 角色，反向连 Hub | 中 |
| 群 Hub | 无 | 新增，协调群成员 | 中 |
| 前端 | React 连本机 Server | 不变（通过本机 Server 联邦代理） | 零改动 |

---

## 4. 核心机制借鉴

### 4.1 入群：Runner 注册（借鉴 GitHub Runner 注册）

```
团队B 收到邀请码 "ABC123" + federation_url "wss://hub.team-a.ts.net"

1. 团队B Server 向 Hub 发起 WSS 连接
2. 握手：发送 { type: "federation.register", invite_code: "ABC123", team_id, labels }
3. Hub 验证 invite_code，将团队B 加入群成员列表
4. Hub 广播 { type: "federation.member.joined", team_id: "team-b" } 给所有成员
5. 团队B Server 开始定期 poll 群任务索引
```

**对应代码位置**：
- 新增 `packages/server/src/federation/hub.ts` — Hub 端点
- 新增 `packages/server/src/federation/runner.ts` — Runner 客户端
- 复用 `packages/server/src/ws/handler.ts` — 消息格式复用 slock 信封

### 4.2 任务匹配：标签系统（借鉴 GitHub `runs-on`）

**当前设计（自由文本 JSON）**：
```ts
// Agent capabilities
JSON.stringify(['code', 'review'])
// Task required_capabilities
['code']
```

**改进后（结构化标签）**：
```yaml
# Agent 标签声明（Role Card 扩展）
labels:
  - python
  - review
  - linux
  - x64

# 群任务要求
required_labels:
  - python
  - review

# 匹配规则：required_labels ⊆ agent_labels
```

**好处**：
- 和 GitHub Actions 的 `runs-on` 语义一致，开发者熟悉
- 支持多维度筛选（语言、平台、硬件）
- 标签可以动态更新（Agent 重连时热更新）

**对应代码位置**：
- 修改 `packages/server/src/api/agents.ts` — Agent 注册增加 labels 字段
- 修改 `packages/server/src/api/group-tasks.ts` — 任务发布增加 required_labels
- 修改 `packages/server/src/modules/reputation.ts` — 信誉分可影响标签权重

### 4.3 任务分发：队列拉取（借鉴 GitHub poll 模式）

**当前设计（广播推送）**：
```
团队A 发布任务 → Hub 广播给 B、C → B/C 的 Agent 收到通知
```

**改进后（拉取模式）**：
```
团队A 发布任务 → Hub 存入群任务索引队列
团队B Server 定期 poll /api/federation/poll → 获取可 claim 的任务列表
团队B 的 Agent 从列表中 claim → 向 Hub 发送 claim 请求
Hub 路由 claim 到源服务器 A → A 创建授权请求
```

**好处**：
- Hub 不需要维护成员的实时连接状态
- 成员 Server 离线后恢复，自动同步错过的任务
- 和现有 `task-queue.ts` 的队列模型一致

**对应代码位置**：
- 修改 `packages/server/src/modules/task-queue.ts` — 增加群任务队列分支
- 新增 `packages/server/src/federation/poll.ts` — Runner 轮询端点

### 4.4 消息协议：复用 slock 信封（借鉴 slock 单总线）

**联邦消息格式**：
```jsonc
{
  "v": 1,
  "id": "fed_01HXY...",
  "type": "federation.task.broadcast",  // 或 federation.member.joined 等
  "ts": 1714400000000,
  "from": "team-a",
  "to": "team-b",  // 可选，点对点
  "data": {
    "task_id": "task-123",
    "title": "Review PR #42",
    "required_labels": ["python", "review"],
    "source_team_id": "team-a"
  }
}
```

**好处**：
- 和本地 WebSocket 消息格式统一（`ws/handler.ts` 已用类似格式）
- 前后端、Daemon、联邦网关共享同一解析器
- 协议自描述，易于调试

### 4.5 Agent 跨团队唤醒：Sleep/Wake 扩展（借鉴 slock Wake）

**场景**：团队A 的任务被团队B 的 Agent claim 后，需要唤醒 Agent。

```
1. 团队B 的 Agent 当前状态：SLEEPING
2. 团队B Server 收到 Hub 转发的 claim 成功消息
3. 团队B Server 向本地 Daemon 发送：
   { type: "agent.wake", agent_id: "agent-b1", trigger: "federation.claim", context: { task_id, title } }
4. Daemon 唤醒 Agent 进程，携带上下文
5. Agent 开始执行任务
```

**对应代码位置**：
- 复用 `packages/server/src/modules/wake-engine.ts`
- 新增 `federation.claim` 作为 wake trigger 类型

### 4.6 动态身份：Role Card 扩展（借鉴 slock Role Card）

**Agent 每次联邦连接携带的 Role Card**：
```yaml
role_card:
  name: "CodeReviewer-B"
  team_id: "team-b"
  group_roles:
    - group_id: "group-123"
      role: "member"
      reputation_score: 15
  labels:
    - python
    - review
  capabilities:
    - code_review
    - test_generation
```

**好处**：
- 入群时自动获得群角色和初始信誉分
- 退群时 Role Card 中该群条目自动移除
- 重连时热更新，无需修改数据库

---

## 5. 与 tailscale 的结合

### 5.1 群 Hub 的网络暴露方式

| 场景 | 暴露方式 | 说明 |
|------|---------|------|
| 群主有公网服务器 | 直接公网 IP + TLS | 最简单 |
| 群主只有 tailscale | tailscale Funnel | `tailscale funnel 3000` 暴露 HTTPS/WSS |
| 群主想完全私有 | 所有成员加入同一 tailnet | 但这违反了"松耦合"原则 |

**推荐**：tailscale Funnel。群主不需要公网服务器，只需暴露一个端口。

### 5.2 成员团队的连接方式

```
成员团队B：
  内部：Daemon ←──tailscale──→ Server B（本地回环或 tailnet）
  外部：Server B ←──WSS──→ Hub Server（通过 Funnel 公网地址）
```

成员团队内部仍用 tailscale，但**不需要**和其他团队共享 tailnet。

---

## 6. 出入群机制

### 6.1 入群

```
团队A（群主）创建群 → 生成 invite_code + federation_url
       ↓
团队B 使用 invite_code
       ↓
团队B Server 反向连接到 federation_url
       ↓
Hub 验证 invite_code，将 team-b 加入群成员表
       ↓
Hub 广播 member.joined 给所有成员
       ↓
团队B 开始 poll 群任务
```

### 6.2 退群

```
团队B 选择退出群
       ↓
团队B Server 关闭到 Hub 的 WSS 连接
       ↓
Hub 检测到连接断开（或显式发送 member.leave）
       ↓
Hub 将 team-b 从群成员表移除
       ↓
Hub 广播 member.left 给剩余成员
       ↓
团队B 已 claim 但未完成的任务自动回池
```

**这和当前 `groups.ts` 的 leave 机制完全一致**，只是把数据库操作扩展为联邦消息。

---

## 7. 风险与缓解

| 风险 | 缓解措施 |
|------|---------|
| Hub 单点故障 | Hub 可由群主团队的任意机器承担，故障时群暂停，各团队内部仍可用 |
| Hub 性能瓶颈 | Hub 只转发索引和授权请求，不转发任务数据；大群可拆分多个子群 |
| 消息延迟 | WSS 长连接 + 心跳，延迟 < 100ms（同区域）|
| 安全风险 | invite_code 有过期时间；WSS 强制 TLS；消息签名验证 |

---

## 8. 代码改动清单

| 文件 | 改动 | 工作量 |
|------|------|--------|
| `packages/server/src/federation/hub.ts` | 新增 Hub 端点（注册、心跳、消息路由） | 中 |
| `packages/server/src/federation/runner.ts` | 新增 Runner 客户端（反向连接、poll、消息接收） | 中 |
| `packages/server/src/federation/protocol.ts` | 联邦消息协议定义（复用 slock 信封） | 小 |
| `packages/server/src/ws/handler.ts` | 增加 federation 消息类型处理 | 小 |
| `packages/server/src/api/agents.ts` | 增加 labels 字段，Role Card 扩展 | 小 |
| `packages/server/src/api/group-tasks.ts` | 任务匹配改为标签子集匹配 | 小 |
| `packages/server/src/modules/wake-engine.ts` | 增加 `federation.claim` wake trigger | 小 |
| `packages/server/src/db/schema.sql` | 增加 federation_peers、labels 字段 | 小 |
| `packages/daemon/src/connection.ts` | **零改动** | — |
| `packages/web/src/*` | **零改动**（通过本机 Server 联邦代理） | — |

---

## 9. 总结

| 借鉴来源 | 核心机制 | 在我们的方案中的应用 |
|---------|---------|-------------------|
| **slock.ai** | 单一总线协议 | 联邦消息复用同一信封格式 |
| **slock.ai** | Sleep/Wake | 跨团队 Agent 远程唤醒 |
| **slock.ai** | Role Card | 动态群身份 + 标签声明 |
| **GitHub Runner** | 反向连接 | 成员 Server 不需要公网 IP |
| **GitHub Runner** | 标签匹配 | 任务路由精确匹配 |
| **GitHub Runner** | 队列拉取 | Hub 不需要维护实时连接状态 |
| **GitHub Runner** | 动态注册 | 邀请码 + token 过期机制 |

**最终拓扑**：
- **团队内部**：tailscale + Daemon 反向连接（当前架构，不变）
- **团队之间**：联邦 Hub + Runner 星型（借鉴 GitHub Runner）
- **消息协议**：复用 slock 信封（借鉴 slock.ai）
- **Agent 唤醒**：Sleep/Wake 扩展（借鉴 slock.ai）

这个方案保持了：
1. **松耦合**：每个团队自治，数据本地化
2. **非中心化**：Hub 只协调，不控制；Hub 挂了各团队内部仍可用
3. **方便进出**：邀请码入群，断连退出
4. **代码兼容**：Daemon 和前端零改动

---

## 附录：与分层组织架构四层模型的关系

### A.1 四层模型回顾

在 `docs/多Agents协作扩展方案.txt` 中定义了分层组织架构的四层模型：

```
World（公共层）
    ↑
  Domain（域）—— 行业联盟 / 大型组织
    ↑
   Group（群）—— 跨团队项目组
    ↑
   Team（团队）—— 个人 + 其 Agents
```

各层的信任边界与协作规则：

| 层级 | 信任模型 | 成员单位 | 协作规则 |
|------|---------|---------|---------|
| **Team** | 完全信任 | 个人的 Agents | 自由竞争 claim，全透明通信 |
| **Group** | 契约信任 | Team 作为整体加入 | 群契约约束，授权竞争，结果 review |
| **Domain** | 声誉信任 | Group 作为整体加入 | 能力注册中心，跨群信誉，不直接调度 |
| **World** | 零信任 / 验证信任 | 任意 Agent / Team | 全局发现，最低限度协作，每次验证 |

### A.2 联邦网关在四层模型中的定位

当前实现的联邦网关（Hub + Runner 星型拓扑）**严格对应 Group 层**：

- **成员单位**：Team（不是单个 Agent，也不是 Domain）
- **信任模型**：契约信任（通过群契约 `contract_yaml` 实现）
- **协作规则**：授权竞争（`auto` / `manual` 授权闸门）
- **网络拓扑**：星型（Hub = 群主团队的 Server，Runner = 成员团队的 Server）

```
Domain（未来扩展层）
    ↑
  ┌─────────────────────────┐
  │      Group 层（当前）      │  ← 联邦网关实现
  │   [Hub] ←──WSS──→ [Runner]│
  │      ↑                  │
  │   Team A             Team B  │
  │  (Daemon)          (Daemon)  │
  └─────────────────────────┘
    ↑
  Team 层（已有）
```

### A.3 为什么不阻塞 Domain / World 扩展

**核心设计原则：递归复用同一协议**

联邦网关的协议（`federation.*` 消息类型）设计时预留了递归性：

1. **消息格式可复用**：`{ v, id, type, ts, from, to, data }` 这一信封格式在 Group 层是 `federation.register`，在 Domain 层可以直接复用为 `domain.register`，只需更换前缀。

2. **Runner 模式可嵌套**：当前 Runner 连接的是 Group Hub；未来 Domain 中的 Runner 可以连接的是 Domain Hub。同一套 `initFederationRunner()` 逻辑只需更换 `FEDERATION_URL` 目标地址。

3. **标签匹配可升级**：当前 `required_labels ⊆ agent_labels` 是集合包含匹配；Domain 层可以在此之上增加信誉分权重排序，但不改变匹配逻辑本身。

4. **契约信任可叠加**：Group 的契约是 `contract_yaml`；Domain 的契约可以是一份更高阶的契约，约束群与群之间的关系（如跨群任务转发的费率、仲裁机制），但契约解析器复用同一套 YAML 结构。

### A.4 从 Group 到 Domain 的演进路径

| 当前（Group） | 未来（Domain） | 变化量 |
|--------------|---------------|--------|
| Hub 由群主团队托管 | Hub 由域管理员托管 | 托管方变更，Hub 代码不变 |
| Runner 是 Team Server | Runner 是 Group Hub Server | 嵌套：Group Hub 作为 Domain Runner |
| 成员是 Team | 成员是 Group | 身份标识从 `team_id` 升级为 `group_id` |
| 契约约束 Team 行为 | 契约约束 Group 行为 | 契约字段扩展，解析器不变 |
| 邀请码入群 | 邀请码入域 / 资质审核 | 入口策略扩展，协议不变 |
| 标签匹配 Agent | 标签匹配 Group（聚合能力） | 匹配逻辑不变，数据源从 Agent 表变为 Group 聚合表 |

### A.5 关键结论

> **联邦网关的星型拓扑 + slock 信封协议 + Runner 反向连接模式，是 Group 层的具体实现，同时也是 Domain 和 World 层的协议模板。**
>
> 保持群的设计简单（Hub 只协调不控制、Runner 只 poll 不推送、消息只路由不存储），正是为了让同一套机制可以在更高层级递归复用，而不引入额外的复杂度。
>
> 后续设计 Domain 时，核心工作不是重新发明网络拓扑，而是：
> 1. 定义 Domain 层契约（约束 Group 而非 Team）
> 2. 实现 Group Hub 作为 Domain Runner 的嵌套逻辑
> 3. 扩展信誉体系从 Team 级到 Group 级
