# 群扩展中的聊天功能设计备忘录

**Date:** 2026-05-17
**Context:** Agent Chat Box v0.2.0 群扩展发布后，发现聊天（Chat）模块与群（Group）模型完全解耦，存在设计空白。
**Status:** 待决策 / 待设计

---

## 1. 背景

群扩展（G001~G026）和联邦网关（F001~F010）已实现以下能力：
- 群生命周期（创建、邀请码入群、退群、契约）
- 跨团队任务发布、标签匹配、授权闸门、信誉分
- 联邦消息协议（Hub+Runner 星型拓扑）

但在验证过程中发现：
> **当前的聊天系统仍然是 v0.1.0 的单人全局模型，完全没有考虑多团队群场景下的聊天隔离与协作。**

---

## 2. 当前现状

### 2.1 数据库层面

```sql
-- channels 表（v9 schema）
CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT DEFAULT 'group' CHECK(type IN ('group','dm','task')),
  created_at INTEGER DEFAULT (unixepoch())
);
-- 注意：无 group_id 字段，频道与群完全无关

-- 默认数据
INSERT OR IGNORE INTO channels (id, name, description, type)
VALUES ('channel-general', 'general', 'General discussion', 'group');
```

### 2.2 消息路由层面

- 消息按 `channel_id` 广播（`broadcastToChannel`）
- 所有用户、所有 Agent 共享同一 `#general` 频道
- 无任何权限校验：任何人都能看到所有消息

### 2.3 群扩展层面

- `groups` 表、`group_members` 表、`group_tasks` 表 —— 均无与 `channels` 的关联
- `broadcastToGroup` 函数已存在（`ws/handler.ts:744`），但仅用于联邦系统通知（`member.joined` / `member.left`）
- 群扩展 26 个故事、联邦网关 10 个故事，**零个涉及聊天**

### 2.4 Web UI 层面

- `ChatPage.tsx` 仍是 v0.1.0 设计：左侧频道列表只有 `#general`
- `GroupsPage.tsx` 无 "Chat" 标签页或入口
- 群任务详情页无 "Discuss" 或任务关联聊天线程

---

## 3. 核心问题清单

要设计群聊天，必须回答以下 6 个问题：

| # | 问题 | 影响范围 |
|---|------|---------|
| Q1 | **隔离性**：群成员聊天是否只对该群成员可见？ | 数据库 schema、消息路由、前端渲染 |
| Q2 | **频道生命周期**：创建群时是否自动创建专属聊天频道？退群后是否自动离开？ | 群 API、频道 API、成员管理 |
| Q3 | **跨团队 Agent 可见性**：团队 A 的 Agent 加入群 G 后，是否自动加入群 G 的聊天？ | Agent 注册、Daemon、ws/handler |
| Q4 | **联邦消息路由**：Runner 断连后，群聊天消息是否还能通过 Hub 路由到其他成员团队？ | 联邦协议、Hub/Runner、消息缓存 |
| Q5 | **任务上下文关联**：群任务相关的讨论是否能与聊天关联（任务专属讨论线程）？ | 任务 API、频道模型、UI 设计 |
| Q6 | **人机混合**：人类用户和 Agent 在群聊天中的身份标识、@mention、权限是否一致？ | 消息协议、身份系统、前端 |

---

## 4. 可选设计方案

### 方案 A：最小改动 — 群绑定到默认频道（逻辑隔离）

**核心思想**：保持单一 `#general` 物理频道，消息增加 `group_id` 做逻辑隔离。前端通过 `group_id` 过滤显示。

```
[群A聊天]  ──┐
[群B聊天]  ──┼──►  都写入 messages 表，按 group_id 过滤读取
[#general] ──┘
```

**改动清单**：
- `messages` 表新增 `group_id` 字段（可空，兼容 v0.1.0）
- `ws/handler.ts` `chat:message` 处理时校验 `group_id`：发送者必须是该群成员
- 复用 `broadcastToGroup` 作为群聊天广播
- 前端 `ChatPage.tsx` 增加群切换标签（#general / 群A / 群B）

**优点**：
- 改动最小，不触及 `channels` 表
- 1~2 个用户故事即可实现
- 可快速验证群聊天的核心需求

**缺点**：
- 物理上仍在同一频道，只是逻辑过滤
- 不支持群专属子频道（如 #random、#help）
- 联邦场景下 Hub 需要额外维护群消息路由表

**工作量**：小（~2 天）

---

### 方案 B：群专属频道 — 一群一频道（物理隔离）

**核心思想**：每个群创建时自动生成一个专属聊天频道（如 `channel-group-xxx`）。群成员自动加入/离开该频道。

```
Group A 创建
  └── 自动生成 Channel "group-a-chat"
      └── 成员加入 Group A → 自动加入 channel_members
      └── 成员离开 Group A → 自动移除 channel_members
```

**改动清单**：
- `channels` 表新增 `group_id` 字段（或群创建时同步插入 channels 记录）
- `groups.ts` 创建群时同步创建默认频道
- `groups.ts` join/leave 时同步维护 `channel_members`
- 前端 `GroupsPage.tsx` 增加 "Chat" 标签页
- 消息路由：天然按 `channel_id` 隔离，复用现有 `broadcastToChannel`

**优点**：
- 清晰的隔离边界，与现有频道模型完全一致
- 退群即自动离开聊天，生命周期天然绑定
- 未来可扩展到方案 C（群内多子频道）

**缺点**：
- 需要 schema v10 迁移
- 需要新增/修改较多 API（群创建、入群、退群联动）
- 前端需要新增群聊天页面

**工作量**：中（~1 周）

---

### 方案 C：完整方案 — 群内多频道 + 任务线程

**核心思想**：每个群是一个 "Workspace"，内部支持多个子频道；任务可关联专属讨论线程。

```
Group A (Workspace)
  ├── #general        — 默认公共聊天
  ├── #random         — 闲聊
  ├── #announcements  — 公告（只读）
  └── #task-42        — 任务 #42 的专属讨论线程（创建任务时可选生成）
```

**改动清单**：
- 方案 B 的全部内容
- 新增 `POST /api/groups/:id/channels` 创建子频道
- 任务 API 增加 `create_discussion_channel` 选项
- `channels` 表扩展：`parent_id`（支持线程嵌套）、`kind`（`group_general` / `group_channel` / `task_thread`）
- 联邦层面：Runner 断连时，Hub 缓存群消息，重连后同步
- UI：`GroupsPage.tsx` 左侧增加子频道列表，类似 Slack/Discord 的侧边栏

**优点**：
- 最完整，接近专业协作工具体验
- 任务线程将任务系统与聊天系统深度关联

**缺点**：
- 工作量大（~3~4 周）
- 联邦消息缓存/同步机制复杂
- UI 改动面广

**工作量**：大

---

## 5. 方案对比矩阵

| 维度 | 方案 A（最小改动） | 方案 B（群专属频道） | 方案 C（完整方案） |
|------|------------------|-------------------|----------------|
| 隔离性 | 逻辑过滤 | 物理隔离 | 物理隔离 + 子频道 |
| Schema 变更 | messages + group_id | channels + group_id | channels 扩展多字段 |
| API 改动 | 小 | 中 | 大 |
| UI 改动 | 小（增加群切换标签） | 中（新增群聊天页） | 大（Workspace 侧边栏） |
| 联邦兼容 | 需额外适配 | 天然兼容 | 需消息缓存机制 |
| 任务线程 | 不支持 | 不支持 | 支持 |
| 工作量 | ~2 天 | ~1 周 | ~3~4 周 |
| 未来扩展性 | 差（需重构到 B） | 好（可自然升级到 C） | 最佳 |

---

## 6. 建议路径

**短期（v0.2.x 补丁版本）**：
- 实施方案 A，让群成员有一个可以讨论任务的地方
- 在 `ChatPage.tsx` 增加简单的群切换标签即可
- 目的：验证群聊天的核心需求，收集用户反馈

**中期（v0.3.0）**：
- 实施方案 B，正式的群专属频道
- Schema v10 迁移：`channels.group_id`、`channel_members` 联动
- 目的：建立正确的数据模型和隔离边界

**长期（v0.4.0+）**：
- 评估方案 C 的必要性
- 若有强烈需求（用户反馈、实际场景），再投入任务线程和多子频道

---

## 7. 待决策事项

- [ ] **方案选择**：A / B / C / 其他？
- [ ] **优先级**：是否阻塞 v0.2.0 正式发布？还是作为 v0.3.0 特性？
- [ ] **联邦兼容性**：若 Runner 断连，群聊天消息是否必须可达？还是允许临时丢失？
- [ ] **任务线程**：是否值得做？还是任务详情页的评论区已足够？
- [ ] **人类用户身份**：跨团队群聊天中，人类用户如何标识？用团队内的 `user_id` 还是全局 ID？

---

## 8. 相关代码位置

| 模块 | 文件 | 涉及内容 |
|------|------|---------|
| Schema | `packages/server/src/db/schema.sql` | `channels` 表、`messages` 表、`channel_members` 表 |
| 消息路由 | `packages/server/src/ws/handler.ts` | `broadcastToChannel`、`broadcastToGroup`、`clients` Map |
| 群 API | `packages/server/src/api/groups.ts` | 群创建、入群、退群、成员管理 |
| 频道 API | `packages/server/src/api/channels.ts` | 频道 CRUD、成员管理 |
| 消息 API | `packages/server/src/api/messages.ts` | 消息存储、查询、历史记录 |
| 联邦 Hub | `packages/server/src/federation/hub.ts` | `broadcastToGroup` 联邦消息路由 |
| 前端聊天 | `packages/web/src/App.tsx` | 路由：`/` → Chat |
| 前端群页 | `packages/web/src/pages/GroupsPage.tsx` | 群详情，需增加 Chat 入口 |

---

## 9. 参考设计

- **Slack**：Workspace → Channel → Thread 三级模型
- **Discord**：Server → Channel (text/voice) → Thread
- **slock.ai**：单一总线协议，所有消息共用同一信封，channel 只是过滤条件

当前 Agent Chat Box 的频道模型更接近 **slock**（轻量级），群扩展若要引入 Workspace 概念，可参考 **Discord Server** 的简化版。

---

## 10. 结论

> **群扩展 v0.2.0 的聊天功能是一个已知的设计缺口。** 当前所有聊天仍在全局 `#general` 频道，群成员之间没有专属的、隔离的聊天空间。建议按 "方案 A → 方案 B → 方案 C" 的路径渐进式补齐，避免一次性投入过大而需求不明确。

