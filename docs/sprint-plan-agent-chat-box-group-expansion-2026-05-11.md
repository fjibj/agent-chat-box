# Sprint Plan: Agent Chat Box — 群级扩展

**Date:** 2026-05-11
**Scrum Master:** fjibj
**Project Level:** 3
**Total Stories:** 26
**Total Points:** 87
**Planned Sprints:** 3

---

## Executive Summary

将 agent-chat-box 从单人多机 Agent 协作扩展到多团队群级协作。6 个 Epic 分解为 26 个用户故事，分 3 个 Sprint 实现。Sprint 1 搭建团队和群的基础数据模型与 API；Sprint 2 实现群任务池与授权闸门核心流程；Sprint 3 完成 Review、信誉分和 UI。

**Key Metrics:**
- Total Stories: 26
- Total Points: 87
- Sprints: 3
- Team Capacity: 30 points per sprint
- Target Completion: 6 weeks (3 × 2-week sprint)

---

## Story Inventory

### EPIC-001: 团队抽象

#### STORY-G001: 数据库迁移 — 团队表与 team_id 列

**Epic:** EPIC-001
**Priority:** Must Have
**Points:** 3

**User Story:**
As a 系统
I want to 在数据库中添加 teams 表和现有表的 team_id 列
So that 团队模型有数据基础

**Acceptance Criteria:**
- [ ] 新增 `teams` 表（id, name, owner_user_id, created_at）
- [ ] 新增 `team_members` 表（team_id, user_id, role, joined_at）
- [ ] `machines` 表添加 `team_id` 列
- [ ] `agents` 表添加 `team_id` 列
- [ ] 迁移脚本 v4→v5 自动执行
- [ ] 现有数据自动创建默认团队并关联

**Technical Notes:**
- 修改 `packages/server/src/db/schema.sql`
- 修改 `packages/server/src/db/index.ts` 的 `migrate()` 函数
- 默认团队名 "Default Team"，现有 machine/agent 全部归属

**Dependencies:** 无

---

#### STORY-G002: 团队 CRUD API

**Epic:** EPIC-001
**Priority:** Must Have
**Points:** 3

**User Story:**
As a 用户
I want to 创建、查询、更新、删除团队
So that 我可以管理我的团队

**Acceptance Criteria:**
- [ ] `POST /api/teams` — 创建团队
- [ ] `GET /api/teams/:id` — 查询团队（含成员列表）
- [ ] `PATCH /api/teams/:id` — 更新团队名称
- [ ] `DELETE /api/teams/:id` — 删除团队（需先移除所有 Agent）
- [ ] 创建团队时自动将当前用户设为 Owner

**Technical Notes:**
- 新建 `packages/server/src/api/teams.ts`
- 在 `index.ts` 注册路由

**Dependencies:** STORY-G001

---

#### STORY-G003: Agent 归属管理

**Epic:** EPIC-001
**Priority:** Must Have
**Points:** 3

**User Story:**
As a 团队 Owner
I want to 将 Agent 加入或移出我的团队
So that 我可以组织我的 Agent

**Acceptance Criteria:**
- [ ] `POST /api/teams/:id/agents/:aid` — 将 Agent 加入团队
- [ ] `DELETE /api/teams/:id/agents/:aid` — 将 Agent 移出团队
- [ ] `GET /api/teams/:id/agents` — 列出团队 Agent
- [ ] Agent 加入新团队时自动从旧团队移除
- [ ] Daemon 注册时自动归属 Owner 的团队

**Technical Notes:**
- 修改 `packages/server/src/api/agents.ts` — 注册时设置 team_id
- 修改 `packages/server/src/ws/handler.ts` — hello 时关联 team

**Dependencies:** STORY-G001

---

#### STORY-G004: 协作者管理

**Epic:** EPIC-001
**Priority:** Should Have
**Points:** 3

**User Story:**
As a 团队 Owner
I want to 邀请协作者加入我的团队
So that 他们可以查看团队状态

**Acceptance Criteria:**
- [ ] `POST /api/teams/:id/members` — 添加协作者（user_id + role）
- [ ] `DELETE /api/teams/:id/members/:uid` — 移除协作者
- [ ] `GET /api/teams/:id/members` — 列出成员
- [ ] 协作者默认 role=member（只读）
- [ ] Owner 可设置 role=admin（部分管理权限）

**Technical Notes:**
- 使用 `team_members` 表
- 权限检查中间件

**Dependencies:** STORY-G001

---

### EPIC-002: 群契约与成员管理

#### STORY-G005: 数据库迁移 — 群表

**Epic:** EPIC-002
**Priority:** Must Have
**Points:** 3

**User Story:**
As a 系统
I want to 在数据库中添加 groups 和 group_members 表
So that 群功能有数据基础

**Acceptance Criteria:**
- [ ] 新增 `groups` 表（id, name, description, contract_yaml, owner_team_id, invite_code, invite_code_expires_at, invite_code_max_uses, invite_code_uses, created_at）
- [ ] 新增 `group_members` 表（group_id, team_id, role, joined_at）
- [ ] 索引：group_members(group_id), group_members(team_id)
- [ ] 迁移脚本 v5→v6

**Technical Notes:**
- 修改 schema.sql 和 migrate()
- contract_yaml 默认模板

**Dependencies:** STORY-G001

---

#### STORY-G006: 群 CRUD API

**Epic:** EPIC-002
**Priority:** Must Have
**Points:** 3

**User Story:**
As a 团队 Owner
I want to 创建、查询、更新、解散群
So that 我可以管理群

**Acceptance Criteria:**
- [ ] `POST /api/groups` — 创建群（自动生成默认契约，Owner 团队自动加入）
- [ ] `GET /api/groups/:id` — 查询群详情（含成员列表）
- [ ] `PATCH /api/groups/:id` — 更新群名称/描述
- [ ] `DELETE /api/groups/:id` — 解散群（所有成员退出，任务回池）
- [ ] `GET /api/groups` — 列出我加入的群

**Technical Notes:**
- 新建 `packages/server/src/api/groups.ts`
- 创建群时自动将 Owner 团队加入 group_members

**Dependencies:** STORY-G005

---

#### STORY-G007: 群契约配置

**Epic:** EPIC-002
**Priority:** Must Have
**Points:** 3

**User Story:**
As a 群 Owner
I want to 查看和编辑群契约配置
So that 我可以定义群内协作规则

**Acceptance Criteria:**
- [ ] `GET /api/groups/:id/contract` — 获取契约（返回 YAML 解析后的 JSON）
- [ ] `PATCH /api/groups/:id/contract` — 更新契约
- [ ] 默认契约模板包含：shared_capabilities, resource_quota, authorization, trust_threshold, visibility
- [ ] 更新契约后 WebSocket 通知所有群成员
- [ ] 契约验证：字段类型检查、值范围检查

**Technical Notes:**
- YAML 解析使用 `js-yaml` 库
- 默认契约模板在代码中定义
- WebSocket 消息类型 `group.contract.updated`

**Dependencies:** STORY-G006

---

#### STORY-G008: 邀请码与加入群

**Epic:** EPIC-002
**Priority:** Must Have
**Points:** 3

**User Story:**
As a 团队 Owner
I want to 通过邀请码加入群
So that 我可以参与跨团队协作

**Acceptance Criteria:**
- [ ] `POST /api/groups/:id/invite` — 生成邀请码（默认 24h 过期）
- [ ] `POST /api/groups/join` — 通过邀请码加入群
- [ ] 邀请码过期检查
- [ ] 邀请码使用次数检查（max_uses）
- [ ] 重复加入检查
- [ ] 加入后自动成为 group_members（role=member）
- [ ] 群 Owner 可吊销邀请码（设置 invite_code=NULL）

**Technical Notes:**
- 邀请码使用 UUID 截取 8 位
- 加入成功后 WebSocket 通知群成员 `group.joined`

**Dependencies:** STORY-G006

---

#### STORY-G009: 退出群

**Epic:** EPIC-002
**Priority:** Must Have
**Points:** 2

**User Story:**
As a 团队 Owner
I want to 退出群
So that 我可以停止参与协作

**Acceptance Criteria:**
- [ ] `POST /api/groups/:id/leave` — 退出群
- [ ] 退出时，该团队已 claim 但未完成的任务自动回群任务池
- [ ] 已完成任务的结果副本不可撤回
- [ ] 退出后 WebSocket 通知群成员 `group.left`

**Technical Notes:**
- 退出时查询 group_tasks 中该团队的 pending/claimed 任务
- 将这些任务 status 重置为 pending

**Dependencies:** STORY-G006, STORY-G010

---

### EPIC-003: 两级任务池与授权

#### STORY-G010: 数据库迁移 — 群任务与授权表

**Epic:** EPIC-003
**Priority:** Must Have
**Points:** 3

**User Story:**
As a 系统
I want to 在数据库中添加 group_tasks 和 authorization_requests 表
So that 群任务和授权有数据基础

**Acceptance Criteria:**
- [ ] 新增 `group_tasks` 表（task_id, group_id, source_team_id, authorization_status, authorized_at, created_at）
- [ ] 新增 `authorization_requests` 表（id, group_task_id, requesting_team_id, requesting_agent_id, status, created_at, expires_at, resolved_at）
- [ ] `tasks` 表添加 `is_group_task` 和 `source_team_id` 列
- [ ] 索引：group_tasks(group_id), authorization_requests(status)
- [ ] 迁移脚本 v6→v7

**Technical Notes:**
- authorization_status: 'none' | 'pending' | 'approved' | 'rejected' | 'expired'

**Dependencies:** STORY-G001

---

#### STORY-G011: 群任务发布 API

**Epic:** EPIC-003
**Priority:** Must Have
**Points:** 3

**User Story:**
As a 团队 Owner
I want to 将任务发布到群任务池
So that 其他团队的 Agent 可以帮忙执行

**Acceptance Criteria:**
- [ ] `POST /api/groups/:gid/tasks` — 发布群任务
- [ ] 任务创建时设置 `is_group_task=1`, `source_team_id=当前团队`
- [ ] 创建 `group_tasks` 记录（authorization_status=none）
- [ ] 任务 required_capabilities 必须在群契约 shared_capabilities 白名单内
- [ ] 发布成功后 WebSocket 广播 `group.task.created` 到群内所有成员

**Technical Notes:**
- 复用现有 createTask 函数，扩展 group 相关字段
- WebSocket 广播使用 group → team → client 映射

**Dependencies:** STORY-G007, STORY-G010

---

#### STORY-G012: 群任务广播（WebSocket）

**Epic:** EPIC-003
**Priority:** Must Have
**Points:** 5

**User Story:**
As a 群内 Agent
I want to 实时收到群任务池的新任务通知
So that 我可以及时 claim

**Acceptance Criteria:**
- [ ] WebSocket 消息类型 `group.task.created` 推送到群内所有成员
- [ ] 消息包含：task 详情、group_id、source_team_id
- [ ] 群成员加入/退出时更新内存中的 group → team 映射
- [ ] 客户端断连时清理映射
- [ ] 广播延迟 < 5 秒（50 团队规模）

**Technical Notes:**
- 在 ws/handler.ts 中维护 `Map<groupId, Set<teamId>>`
- 在 ws/handler.ts 中维护 `Map<teamId, Set<clientId>>`
- 广播时：groupId → teamIds → clientIds → send

**Dependencies:** STORY-G011

---

#### STORY-G013: 跨团队 Claim API

**Epic:** EPIC-003
**Priority:** Must Have
**Points:** 5

**User Story:**
As a 群内 Agent
I want to claim 群任务池中的任务
So that 我可以接跨团队任务

**Acceptance Criteria:**
- [ ] `POST /api/tasks/:tid/group-claim` — 跨团队 claim
- [ ] 验证 Agent 所在团队是群成员
- [ ] 验证 Agent 能力匹配任务 required_capabilities
- [ ] Claim 后任务状态变为 `pending_authorization`
- [ ] 创建 `group_tasks` 记录（authorization_status=pending）
- [ ] 创建 `authorization_requests` 记录
- [ ] 先到先得（原子操作，复用现有 claim 的事务逻辑）

**Technical Notes:**
- 复用现有 claimTask 的原子事务模式
- 新增任务状态 `pending_authorization`

**Dependencies:** STORY-G011, STORY-G010

---

#### STORY-G014: Manual 授权模式

**Epic:** EPIC-003
**Priority:** Must Have
**Points:** 5

**User Story:**
As a 任务发布者
I want to 在 manual 模式下审批 claim 请求
So that 我可以控制谁执行我的任务

**Acceptance Criteria:**
- [ ] claim 后 WebSocket 推送 `authorization.requested` 给任务发布者的团队 Owner
- [ ] `POST /api/authorizations/:id/approve` — 批准
- [ ] `POST /api/authorizations/:id/reject` — 拒绝
- [ ] 批准后：group_tasks.authorization_status=approved, task.status=claimed, assignee_id=claim Agent
- [ ] 拒绝后：task 回 pending 状态，其他 Agent 可重新 claim
- [ ] 审批超时（默认 5 分钟）→ 自动 expired，task 回 pending

**Technical Notes:**
- 超时检查：定时扫描 authorization_requests 中 status=pending 且 expires_at < now
- 批准/拒绝后 WebSocket 通知 claim 团队

**Dependencies:** STORY-G013

---

#### STORY-G015: Auto 授权模式

**Epic:** EPIC-003
**Priority:** Should Have
**Points:** 3

**User Story:**
As a 系统
I want to 在 auto 模式下自动授权高信誉团队
So that 协作更高效

**Acceptance Criteria:**
- [ ] 群契约 authorization=auto 时，检查 claim 团队信誉分
- [ ] 信誉分 >= trust_threshold → 自动批准
- [ ] 信誉分 < trust_threshold → 降级为 manual
- [ ] 检查 claim 团队未超 resource_quota
- [ ] 超配额 → 降级为 manual
- [ ] 新团队（无信誉分）→ 降级为 manual

**Technical Notes:**
- 调用 ReputationEngine.checkThreshold()
- auto 模式下跳过 WebSocket 审批通知

**Dependencies:** STORY-G013, STORY-G020, STORY-G022

---

#### STORY-G016: 跨团队任务重试

**Epic:** EPIC-003
**Priority:** Must Have
**Points:** 3

**User Story:**
As a 系统
I want to 在跨团队任务失败后自动回池
So that 其他 Agent 可以重试

**Acceptance Criteria:**
- [ ] 任务失败后自动回群任务池（status=pending）
- [ ] 其他 Agent 可重新 claim
- [ ] 同一团队对同一任务重试次数 <= max_retry_per_task（群契约配置）
- [ ] 达到重试上限后任务标记为 failed，通知任务发布者
- [ ] Agent 断连后其 claim 的群任务自动回池

**Technical Notes:**
- 复用现有 updateTask 的重试逻辑
- 新增 per-team 重试计数（group_tasks 表可加 retry_count_by_team）

**Dependencies:** STORY-G011

---

### EPIC-004: 跨团队 Review

#### STORY-G017: 任务产出回流

**Epic:** EPIC-004
**Priority:** Must Have
**Points:** 5

**User Story:**
As a 任务拆解者
I want to 收到外部 Agent 的执行产出
So that 我可以 review 子任务质量

**Acceptance Criteria:**
- [ ] 外部任务完成后，output 发送给原拆解者（通过 WebSocket `review.requested`）
- [ ] 产出包含：task_id, output, completed_at, source_agent_id
- [ ] 产出可见性受群契约 visibility.task_output 控制
- [ ] task_output=false 时不发送产出

**Technical Notes:**
- 在 updateTask status=completed 时，检查 is_group_task
- 如果是群任务，查找 parent_task 的 creator（拆解者）
- 通过 WebSocket 发送给拆解者的团队 Owner

**Dependencies:** STORY-G011

---

#### STORY-G018: Review 状态管理

**Epic:** EPIC-004
**Priority:** Must Have
**Points:** 3

**User Story:**
As a 任务拆解者
I want to 对外部任务产出进行 review
So that 我可以保证任务质量

**Acceptance Criteria:**
- [ ] `POST /api/tasks/:tid/review` — 提交 review（approved/rejected）
- [ ] approved：记录信誉分（review_approved, +1）
- [ ] rejected：任务回群池，记录信誉分（review_rejected, -2）
- [ ] review 结果 WebSocket 通知执行团队 `review.completed`
- [ ] review 有超时机制（可配置，默认 30 分钟）

**Technical Notes:**
- 新建 `packages/server/src/api/reviews.ts`
- rejected 时调用 updateTask status=pending

**Dependencies:** STORY-G017

---

#### STORY-G019: 过程隐私保护

**Epic:** EPIC-004
**Priority:** Should Have
**Points:** 3

**User Story:**
As a 外部 Agent Owner
I want to 我的执行过程不被暴露
So that 我的工具链和策略保持私密

**Acceptance Criteria:**
- [ ] visibility.internal_log=false 时，外部 Agent 的内部日志不暴露
- [ ] 任务详情 API 检查 is_group_task + visibility 配置
- [ ] 外部 Agent 的 execution_log 不返回给任务发布者
- [ ] 只返回最终 output

**Technical Notes:**
- 任务详情 API 增加 visibility 检查
- group_tasks 表可加 visibility 快照（从群契约复制）

**Dependencies:** STORY-G007

---

### EPIC-005: 信誉分系统

#### STORY-G020: 信誉分记录

**Epic:** EPIC-005
**Priority:** Should Have
**Points:** 3

**User Story:**
As a 系统
I want to 记录团队在群内的任务表现
So that 信誉分可用于授权判定

**Acceptance Criteria:**
- [ ] 新增 `reputation_records` 表（id, team_id, group_id, event_type, score_delta, task_id, created_at）
- [ ] 事件类型：task_completed(+1), task_failed(-1), review_approved(+1), review_rejected(-2)
- [ ] 新团队初始信誉分 = 0（无记录）
- [ ] 信誉分按群独立计算

**Technical Notes:**
- 新建 `packages/server/src/modules/reputation.ts`
- `recordReputation(teamId, groupId, eventType, taskId)` 函数

**Dependencies:** STORY-G010

---

#### STORY-G021: 信誉分查询 API

**Epic:** EPIC-005
**Priority:** Should Have
**Points:** 3

**User Story:**
As a 群成员
I want to 查看群内各团队的信誉分
So that 我了解协作者的可靠性

**Acceptance Criteria:**
- [ ] `GET /api/groups/:gid/reputation` — 查询群内所有团队信誉分
- [ ] `GET /api/groups/:gid/reputation/:tid` — 查询单个团队信誉分
- [ ] 返回：team_id, total_score, event_count, last_event_at
- [ ] 信誉分 = SUM(score_delta) WHERE team_id AND group_id

**Technical Notes:**
- 使用 SQL 聚合查询
- 索引 reputation_records(team_id, group_id)

**Dependencies:** STORY-G020

---

#### STORY-G022: 信誉分阈值判定

**Epic:** EPIC-005
**Priority:** Should Have
**Points:** 2

**User Story:**
As a 系统
I want to 根据信誉分判定是否自动授权
So that auto 模式可以工作

**Acceptance Criteria:**
- [ ] `checkThreshold(teamId, groupId, threshold): boolean` 函数
- [ ] 计算团队在该群的总信誉分
- [ ] 总分 >= threshold → true
- [ ] 总分 < threshold → false
- [ ] 无记录（新团队）→ false

**Technical Notes:**
- 复用 STORY-G021 的查询逻辑
- 供 AuthorizationGate 调用

**Dependencies:** STORY-G020

---

### EPIC-006: 群管理 UI

#### STORY-G023: 群管理页面

**Epic:** EPIC-006
**Priority:** Should Have
**Points:** 5

**User Story:**
As a 团队 Owner
I want to 通过 UI 管理群
So that 我不需要编辑 YAML 文件

**Acceptance Criteria:**
- [ ] 群列表页：显示已加入的群（名称、成员数、我的角色）
- [ ] 群详情页：契约配置（表单化）、成员列表、邀请码
- [ ] 创建群表单：名称、描述
- [ ] 加入群入口：输入邀请码
- [ ] 契约编辑：shared_capabilities 多选、resource_quota 表单、authorization 单选、trust_threshold 滑块、visibility 开关

**Technical Notes:**
- React 组件，使用 shadcn/ui
- 路由：/groups, /groups/:id

**Dependencies:** STORY-G006, STORY-G007, STORY-G008

---

#### STORY-G024: 跨团队任务看板

**Epic:** EPIC-006
**Priority:** Should Have
**Points:** 5

**User Story:**
As a 用户
I want to 在看板上区分内部和群任务
So that 我能清楚任务来源

**Acceptance Criteria:**
- [ ] 任务看板有「内部」和「群」标签页
- [ ] 群任务显示：发布者团队、claim 团队、授权状态、review 状态
- [ ] 支持按群筛选任务
- [ ] 外部任务和内部任务视觉区分（颜色/标签）

**Technical Notes:**
- 扩展现有任务看板组件
- 新增筛选参数 group_id

**Dependencies:** STORY-G011

---

#### STORY-G025: 授权审批 UI

**Epic:** EPIC-006
**Priority:** Should Have
**Points:** 3

**User Story:**
As a 任务发布者
I want to 在 UI 上审批 claim 请求
So that 操作便捷

**Acceptance Criteria:**
- [ ] 审批请求列表（待处理/已处理）
- [ ] 审批详情：任务信息、claim 团队信息、信誉分
- [ ] 一键批准/拒绝按钮
- [ ] 超时倒计时显示

**Technical Notes:**
- 路由：/authorizations
- 调用 approve/reject API

**Dependencies:** STORY-G014, STORY-G023

---

#### STORY-G026: 信誉分展示

**Epic:** EPIC-006
**Priority:** Could Have
**Points:** 2

**User Story:**
As a 群成员
I want to 在 UI 上看到各团队信誉分
So that 我了解协作者可靠性

**Acceptance Criteria:**
- [ ] 群成员列表显示各团队信誉分
- [ ] 审批界面显示 claim 团队信誉分
- [ ] 信誉分用数字 + 颜色表示（高绿、中黄、低红）

**Technical Notes:**
- 调用 reputation API
- 颜色阈值可配置

**Dependencies:** STORY-G021, STORY-G023

---

## Sprint Allocation

### Sprint 1 (Weeks 1-2) — 基础设施与群管理

**Goal:** 完成团队模型、群契约、成员管理、邀请码——群的基础设施全部就绪

**Stories:**
| Story | Title | Points | Priority |
|-------|-------|--------|----------|
| STORY-G001 | 数据库迁移 — 团队表 | 3 | Must |
| STORY-G002 | 团队 CRUD API | 3 | Must |
| STORY-G003 | Agent 归属管理 | 3 | Must |
| STORY-G004 | 协作者管理 | 3 | Should |
| STORY-G005 | 数据库迁移 — 群表 | 3 | Must |
| STORY-G006 | 群 CRUD API | 3 | Must |
| STORY-G007 | 群契约配置 | 3 | Must |
| STORY-G008 | 邀请码与加入群 | 3 | Must |
| STORY-G009 | 退出群 | 2 | Must |
| STORY-G010 | 数据库迁移 — 群任务表 | 3 | Must |

**Total:** 29 / 30 capacity (97%)

**Risks:**
- SQLite 迁移脚本复杂度（ALTER TABLE 限制多）
- 内存映射设计需仔细

---

### Sprint 2 (Weeks 3-4) — 群任务池与授权

**Goal:** 群任务从发布到授权执行的全流程跑通——Manual 和 Auto 两种授权模式都可用

**Stories:**
| Story | Title | Points | Priority |
|-------|-------|--------|----------|
| STORY-G011 | 群任务发布 API | 3 | Must |
| STORY-G012 | 群任务广播 (WebSocket) | 5 | Must |
| STORY-G013 | 跨团队 Claim API | 5 | Must |
| STORY-G014 | Manual 授权模式 | 5 | Must |
| STORY-G015 | Auto 授权模式 | 3 | Should |
| STORY-G016 | 跨团队任务重试 | 3 | Must |
| STORY-G020 | 信誉分记录 | 3 | Should |

**Total:** 27 / 30 capacity (90%)

**Risks:**
- 授权超时处理的定时器设计
- 跨团队 claim 的原子性保证

---

### Sprint 3 (Weeks 5-6) — Review、信誉分与 UI

**Goal:** 完成跨团队 Review、信誉分查询、群管理 UI——群功能完整可用

**Stories:**
| Story | Title | Points | Priority |
|-------|-------|--------|----------|
| STORY-G017 | 任务产出回流 | 5 | Must |
| STORY-G018 | Review 状态管理 | 3 | Must |
| STORY-G019 | 过程隐私保护 | 3 | Should |
| STORY-G021 | 信誉分查询 API | 3 | Should |
| STORY-G022 | 信誉分阈值判定 | 2 | Should |
| STORY-G023 | 群管理页面 | 5 | Should |
| STORY-G024 | 跨团队任务看板 | 5 | Should |
| STORY-G025 | 授权审批 UI | 3 | Should |
| STORY-G026 | 信誉分展示 | 2 | Could |

**Total:** 31 / 30 capacity (103%)

**Risks:**
- UI 工作量可能超出预估
- 可将 STORY-G026 (2pts) 移到下个 sprint 缓冲

---

## Epic Traceability

| Epic ID | Epic Name | Stories | Total Points | Sprint |
|---------|-----------|---------|--------------|--------|
| EPIC-001 | 团队抽象 | G001~G004 | 12 | Sprint 1 |
| EPIC-002 | 群契约与成员管理 | G005~G009 | 14 | Sprint 1 |
| EPIC-003 | 两级任务池与授权 | G010~G016 | 26 | Sprint 1-2 |
| EPIC-004 | 跨团队 Review | G017~G019 | 11 | Sprint 3 |
| EPIC-005 | 信誉分系统 | G020~G022 | 8 | Sprint 2-3 |
| EPIC-006 | 群管理 UI | G023~G026 | 15 | Sprint 3 |

---

## Functional Requirements Coverage

| FR ID | FR Name | Story | Sprint |
|-------|---------|-------|--------|
| FR-001 | 团队模型 | G001 | 1 |
| FR-002 | 团队成员管理 | G002, G003, G004 | 1 |
| FR-003 | 群创建与配置 | G005, G006 | 1 |
| FR-004 | 群加入与退出 | G008, G009 | 1 |
| FR-005 | 群契约配置项 | G007 | 1 |
| FR-006 | 外部任务池 | G010, G011, G012 | 1-2 |
| FR-007 | 跨团队 Claim | G013 | 2 |
| FR-008 | Manual 授权 | G014 | 2 |
| FR-009 | Auto 授权 | G015 | 2 |
| FR-010 | 任务产出回流 | G017 | 3 |
| FR-011 | 过程隐私保护 | G019 | 3 |
| FR-012 | 信誉分记录 | G020 | 2 |
| FR-013 | 信誉分应用 | G022 | 3 |
| FR-014 | 跨团队重试 | G016 | 2 |
| FR-015 | 群管理 UI | G023 | 3 |
| FR-016 | 跨团队任务看板 | G024 | 3 |
| FR-017 | 授权审批 UI | G025 | 3 |
| FR-018 | 信誉分展示 | G026 | 3 |

---

## Risks and Mitigation

**High:**
- SQLite ALTER TABLE 限制可能导致迁移脚本复杂 → 缓解：使用 CREATE TABLE new → INSERT → DROP → RENAME 模式
- Sprint 3 可能超载（31 pts > 30 capacity）→ 缓解：将 STORY-G026 移到缓冲

**Medium:**
- 跨团队 claim 原子性 → 缓解：复用现有事务模式
- WebSocket 广播性能 → 缓护：内存映射 + 索引

**Low:**
- UI 工作量预估不准 → 缓解：先做核心功能，细节迭代

---

## Definition of Done

For a story to be considered complete:
- [ ] Code implemented and committed
- [ ] 单元测试通过
- [ ] API 端点可调用
- [ ] 向后兼容验证（现有功能不受影响）
- [ ] manual-verification.md 更新验证项

---

## Next Steps

**Immediate:** Begin Sprint 1

Run `/create-story STORY-G001` to create detailed story document, or `/dev-story STORY-G001` to start implementation.

**Implementation order within Sprint 1:**
1. STORY-G001 → G005 → G010（数据库迁移，顺序执行）
2. G002 → G003 → G004（团队 API）
3. G006 → G007 → G008 → G009（群 API）

---

**This plan was created using BMAD Method v6 - Phase 4 (Implementation Planning)**
