# Product Requirements Document: Agent Chat Box — 群级扩展

**Date:** 2026-05-11
**Author:** fjibj
**Version:** 1.0
**Project Type:** web-app
**Project Level:** 3
**Status:** Draft

---

## Document Overview

This PRD defines the functional and non-functional requirements for expanding agent-chat-box from single-person multi-agent collaboration to multi-team group-level collaboration. Teams (person/group of persons + their agents, full trust, no org hierarchy) connect through group contracts to share agent capabilities and collaborate on tasks.

**Related Documents:**
- Product Brief: `docs/product-brief-agent-chat-box-group-expansion-2026-05-11.md`
- Expansion Plan: `docs/多Agents协作扩展方案.txt`
- Budget Design: `docs/budget-goal-design-for-agent-chat-box.md`
- Chain Design: `docs/chat-chain-and-task-design.md`
- Skill Analysis: `docs/agent-role-skill-analysis.md`

---

## Executive Summary

将 agent-chat-box 从「单人多机 Agent 协作」扩展到「多团队群级协作」。核心机制：团队抽象 + 群契约 + 两级任务池 + 授权闸门 + 跨团队 review + 信誉分。保持现有 claim 竞争哲学，仅加一层「授权」外壳。范围限定为群级，不做域和 World。

---

## Product Goals

### Business Objectives

- **BO-1**: 证明跨团队 Agent 协作在现有架构上可行（2+ 团队协作完成任务）
- **BO-2**: 吸引社区采用（5+ 外部团队，GitHub 100+ star）
- **BO-3**: 为未来 SaaS 托管和开放核心打基础

### Success Metrics

- **SM-1**: 2+ 团队在群内协作完成跨团队任务（claim + 授权 + 执行 + review 全流程）
- **SM-2**: 群契约配置 10 分钟内可完成群创建和加入
- **SM-3**: 授权闸门有效阻止未授权的外部 Agent 调用
- **SM-4**: 5+ 外部团队使用，GitHub 100+ star

---

## Functional Requirements

### Team Abstraction（团队抽象）

#### FR-001: 团队模型

**Priority:** Must Have

**Description:**
引入团队 (Team) 概念，作为 Agent 的顶层组织单元。一个团队 = 一个用户（或一组用户）+ 其拥有的所有 Agent。团队内完全信任，Agent 自由竞争任务。团队无组织层级。

**Acceptance Criteria:**
- [ ] 数据库新增 `teams` 表（id, name, owner_id, created_at）
- [ ] 现有 machines/agents 自动归属默认团队
- [ ] 团队内 Agent 间通信沿用现有 claim 机制，无变化
- [ ] 团队模型不引入任何层级关系（无 parent_team、无 department）

**Dependencies:** 无

---

#### FR-002: 团队成员管理

**Priority:** Must Have

**Description:**
团队 Owner 可以管理团队成员（Agent 和协作者）。Owner 可邀请其他用户作为协作者加入团队，协作者可查看团队状态但不能修改 Agent 配置。

**Acceptance Criteria:**
- [ ] 团队 Owner 可添加/移除 Agent
- [ ] 团队 Owner 可邀请协作者（通过邀请码或链接）
- [ ] 协作者有只读权限（查看任务、Agent 状态）
- [ ] Owner 可设置协作者权限级别

**Dependencies:** FR-001

---

### Group Contract（群契约）

#### FR-003: 群创建与配置

**Priority:** Must Have

**Description:**
任何团队 Owner 可创建群。群有唯一的契约配置，定义群内协作规则。契约通过 YAML 配置文件定义。

**Acceptance Criteria:**
- [ ] 创建群时生成默认契约模板
- [ ] 契约包含：shared_capabilities、resource_quota、authorization、trust_threshold、visibility
- [ ] 契约可在线编辑，修改后通知所有成员
- [ ] 群有唯一 ID 和名称

**Dependencies:** FR-001

---

#### FR-004: 群加入与退出

**Priority:** Must Have

**Description:**
团队可通过邀请码或直接邀请加入群。加入即表示同意群契约。任何团队可随时退出群。

**Acceptance Criteria:**
- [ ] 群 Owner 可生成邀请码（有过期时间）
- [ ] 团队 Owner 可通过邀请码申请加入群
- [ ] 群 Owner 可审批加入申请
- [ ] 任何团队可随时退出群
- [ ] 退出时，该团队已 claim 但未完成的任务自动回群任务池
- [ ] 已完成任务的结果副本不可撤回

**Dependencies:** FR-003

---

#### FR-005: 群契约配置项

**Priority:** Must Have

**Description:**
群契约 YAML 包含以下核心配置项：

```yaml
group_id: "group-xxx"
group_name: "群名称"
shared_capabilities:        # 共享能力白名单
  - "code_review"
  - "generate_pr"
  - "browser_automation"
resource_quota:             # 资源配额
  max_tasks_per_hour: 5
  max_retry_per_task: 2
authorization: auto          # auto 或 manual
trust_threshold: 0.6         # auto 模式下信任阈值
visibility:                  # 可见性
  task_input: true
  task_output: true
  internal_log: false
```

**Acceptance Criteria:**
- [ ] shared_capabilities 控制哪些能力可在群内暴露
- [ ] resource_quota 限制每个成员团队的任务频率
- [ ] authorization 决定授权模式（auto/manual）
- [ ] trust_threshold 仅在 auto 模式下生效
- [ ] visibility 控制任务输入/输出/内部日志的可见性

**Dependencies:** FR-003

---

### Two-Tier Task Pool（两级任务池）

#### FR-006: 外部任务池

**Priority:** Must Have

**Description:**
在现有内部任务池基础上，新增外部任务池。群内团队可将任务发布到群任务池，群内所有成员可见。外部任务需携带所需能力标签。

**Acceptance Criteria:**
- [ ] 任务可标记为「群内可见」发布到群任务池
- [ ] 群任务池对群内所有成员可见
- [ ] 外部任务携带 required_capabilities 字段
- [ ] 仅 shared_capabilities 白名单内的能力可发布到群
- [ ] 内部任务池行为不变

**Dependencies:** FR-003, FR-005

---

#### FR-007: 跨团队 Claim

**Priority:** Must Have

**Description:**
群内 Agent 可 claim 群任务池中的任务。Claim 后不直接执行，需通过授权闸门。沿用现有「先 claim 先得」机制。

**Acceptance Criteria:**
- [ ] 群内 Agent 可看到群任务池中的任务
- [ ] Agent 可 claim 任务（先到先得）
- [ ] Claim 后任务状态变为 `pending_authorization`
- [ ] Claim 的 Agent 必须在群成员团队中
- [ ] Claim 的 Agent 能力需匹配任务 required_capabilities

**Dependencies:** FR-006

---

### Authorization Gate（授权闸门）

#### FR-008: Manual 授权模式

**Priority:** Must Have

**Description:**
Manual 模式下，外部 Agent claim 任务后，任务发布者的 Owner（或其指定守门人 Agent）收到审批通知。Owner 批准后任务开始执行，拒绝则任务回池。

**Acceptance Criteria:**
- [ ] claim 后生成 AuthorizationRequest 推送给任务发布者
- [ ] Owner 可批准或拒绝
- [ ] 批准后任务状态变为 `claimed`，开始执行
- [ ] 拒绝后任务回群任务池，其他 Agent 可重新 claim
- [ ] 审批有超时机制（可配置，默认 5 分钟）

**Dependencies:** FR-007

---

#### FR-009: Auto 授权模式

**Priority:** Should Have

**Description:**
Auto 模式下，若 claim Agent 所在团队信誉分 >= trust_threshold 且未超资源配额，自动授权执行。否则降级为 manual 模式。

**Acceptance Criteria:**
- [ ] 检查 claim 团队信誉分 >= trust_threshold → 自动授权
- [ ] 检查 claim 团队未超 resource_quota → 自动授权
- [ ] 信誉分不足或超配额 → 降级为 manual
- [ ] 新团队（无信誉分）默认走 manual

**Dependencies:** FR-007, FR-013

---

### Cross-Team Review（跨团队 Review）

#### FR-010: 任务产出回流

**Priority:** Must Have

**Description:**
外部 Agent 执行完毕后，必须将最终产出 (output) 送回给任务拆解者 review。这是群契约的强制部分——加入群即同意让任务产出被原拆解者 review。

**Acceptance Criteria:**
- [ ] 外部任务完成后，output 发送给原拆解者
- [ ] 拆解者可查看产出并标记 review 状态（approved/rejected）
- [ ] rejected 时任务可重新进入群池重试
- [ ] output 可见性受群契约 visibility.task_output 控制

**Dependencies:** FR-006, FR-005

---

#### FR-011: 过程隐私保护

**Priority:** Should Have

**Description:**
跨团队任务执行过程中，任务发布者只能看到最终产出，不能看到外部 Agent 的内部执行过程（工具调用、思考过程等）。

**Acceptance Criteria:**
- [ ] visibility.internal_log = false 时，外部 Agent 的内部日志不暴露
- [ ] 任务发布者只能看到 output，不能看到 execution_log
- [ ] 外部 Agent 的内部工具调用记录对其 Owner 可见

**Dependencies:** FR-010, FR-005

---

### Reputation System（信誉分系统）

#### FR-012: 信誉分记录

**Priority:** Should Have

**Description:**
记录每个团队在群内的任务执行表现。维度包括：任务完成率、平均响应时间、review 通过率。

**Acceptance Criteria:**
- [ ] 新团队初始信誉分 = 0
- [ ] 任务完成 +1，失败 -1，review rejected -2
- [ ] 信誉分按群独立计算（同一团队在不同群有不同信誉分）
- [ ] 信誉分可查询

**Dependencies:** FR-010

---

#### FR-013: 信誉分应用

**Priority:** Should Have

**Description:**
信誉分用于 auto 授权模式的判定。达到 trust_threshold 的团队获得自动授权。

**Acceptance Criteria:**
- [ ] auto 模式检查团队在该群的信誉分
- [ ] 信誉分 >= trust_threshold → 自动授权
- [ ] 信誉分 < trust_threshold → 降级 manual
- [ ] 信誉分计算规则可配置（未来扩展）

**Dependencies:** FR-012, FR-009

---

### Group Task Retry（群任务重试）

#### FR-014: 跨团队任务重试

**Priority:** Must Have

**Description:**
跨团队任务失败后自动回群任务池重新广播。同一团队对同一任务的重试次数受群契约 resource_quota.max_retry_per_task 限制。

**Acceptance Criteria:**
- [ ] 任务失败后自动回群任务池
- [ ] 其他 Agent 可重新 claim
- [ ] 同一团队对同一任务重试次数 <= max_retry_per_task
- [ ] 达到重试上限后，任务标记为 failed，通知任务发布者

**Dependencies:** FR-006, FR-005

---

### UI（界面改造）

#### FR-015: 群管理界面

**Priority:** Should Have

**Description:**
新增群管理页面，支持群创建、契约配置、成员管理、邀请码生成。

**Acceptance Criteria:**
- [ ] 群列表页：显示已加入的群
- [ ] 群详情页：契约配置、成员列表、邀请码
- [ ] 创建群表单：名称、初始契约配置
- [ ] 加入群入口：输入邀请码

**Dependencies:** FR-003, FR-004, FR-005

---

#### FR-016: 跨团队任务看板

**Priority:** Should Have

**Description:**
任务看板区分内部任务和群任务。群任务显示授权状态、执行团队、review 状态。

**Acceptance Criteria:**
- [ ] 任务看板有「内部」和「群」标签页
- [ ] 群任务显示：发布者、claim 团队、授权状态、review 状态
- [ ] 支持按群筛选任务
- [ ] 外部任务和内部任务视觉区分

**Dependencies:** FR-006, FR-007

---

#### FR-017: 授权审批流 UI

**Priority:** Should Have

**Description:**
Manual 授权模式下的审批界面。Owner 收到审批请求，可查看详情后批准或拒绝。

**Acceptance Criteria:**
- [ ] 审批请求列表（待处理/已处理）
- [ ] 审批详情：任务信息、claim 团队信息、信誉分
- [ ] 一键批准/拒绝
- [ ] 超时自动处理提示

**Dependencies:** FR-008, FR-015

---

#### FR-018: 信誉分展示

**Priority:** Could Have

**Description:**
在群成员列表和任务审批界面中展示团队信誉分。

**Acceptance Criteria:**
- [ ] 群成员列表显示各团队信誉分
- [ ] 审批界面显示 claim 团队信誉分
- [ ] 信誉分变化趋势（可选）

**Dependencies:** FR-012, FR-015

---

## Non-Functional Requirements

#### NFR-001: 性能 - 群任务广播延迟

**Priority:** Must Have

**Description:**
群任务广播到所有成员的延迟 < 5 秒（100 团队规模下）。

**Acceptance Criteria:**
- [ ] 群任务创建后 5 秒内所有成员可见
- [ ] 100 团队规模下性能不退化

**Rationale:** 竞争机制依赖快速广播，延迟过高影响公平性。

---

#### NFR-002: 安全 - 跨团队隔离

**Priority:** Must Have

**Description:**
外部 Agent 不能访问任务发布者的内部数据（Agent 配置、内部任务、聊天记录等），只能看到群契约允许的共享数据。

**Acceptance Criteria:**
- [ ] 外部 Agent 只能访问任务描述和输入数据
- [ ] 不能查询发布者的 agent 列表、内部任务
- [ ] 不能访问发布者的 WebSocket 连接
- [ ] API 权限按 team_id 隔离

**Rationale:** 跨团队协作的核心安全保障。

---

#### NFR-003: 安全 - 邀请码安全

**Priority:** Should Have

**Description:**
群邀请码有过期时间，支持一次性使用。防止邀请码泄露导致未授权加入。

**Acceptance Criteria:**
- [ ] 邀请码默认 24 小时过期
- [ ] 可设置最大使用次数
- [ ] 群 Owner 可随时吊销邀请码

**Rationale:** 控制群成员准入。

---

#### NFR-004: 可靠性 - 任务不丢失

**Priority:** Must Have

**Description:**
跨团队任务在任何环节失败（网络断开、Agent 崩溃、授权超时）都能回退到群任务池，不丢失。

**Acceptance Criteria:**
- [ ] Agent 断连后，其 claim 的群任务自动回池
- [ ] 授权超时后任务自动回池
- [ ] 任务状态变更持久化到数据库

**Rationale:** 任务丢失是最严重的用户体验问题。

---

#### NFR-005: 可维护性 - 向后兼容

**Priority:** Must Have

**Description:**
群功能对现有单团队使用场景完全透明。不使用群功能的用户不受任何影响。

**Acceptance Criteria:**
- [ ] 现有 API 行为不变
- [ ] 现有 WebSocket 协议不变
- [ ] 现有数据库表结构兼容（新增表，不修改现有表结构，或兼容性迁移）
- [ ] 未加入任何群的团队，行为与扩展前完全一致

**Rationale:** 保护现有用户，降低升级风险。

---

#### NFR-006: 可扩展性 - 群规模

**Priority:** Should Have

**Description:**
单群支持 50+ 团队，单服务器支持 20+ 群。

**Acceptance Criteria:**
- [ ] 50 团队群内任务广播 < 5 秒
- [ ] 20 个群同时运行无性能问题
- [ ] 数据库查询有适当索引

**Rationale:** 初期规模目标，为后续增长留空间。

---

## Epics

### EPIC-001: 团队抽象

**Description:**
引入团队模型，将现有单人 Agent 抽象为团队。为群功能打基础。

**Functional Requirements:**
- FR-001
- FR-002

**Story Count Estimate:** 3-4

**Priority:** Must Have

**Business Value:** 团队是群的基本单元，没有团队模型就无法实现群功能。

---

### EPIC-002: 群契约与成员管理

**Description:**
实现群的创建、加入、退出，以及群契约的配置和管理。

**Functional Requirements:**
- FR-003
- FR-004
- FR-005

**Story Count Estimate:** 4-6

**Priority:** Must Have

**Business Value:** 群契约是整个跨团队协作的规则基础。

---

### EPIC-003: 两级任务池与授权

**Description:**
实现外部任务池、跨团队 claim、授权闸门（manual/auto）。

**Functional Requirements:**
- FR-006
- FR-007
- FR-008
- FR-009
- FR-014

**Story Count Estimate:** 6-8

**Priority:** Must Have

**Business Value:** 核心功能——让跨团队任务从发布到执行的全流程跑通。

---

### EPIC-004: 跨团队 Review

**Description:**
实现任务产出回流、拆解者 review、过程隐私保护。

**Functional Requirements:**
- FR-010
- FR-011

**Story Count Estimate:** 3-4

**Priority:** Must Have

**Business Value:** Review 机制保证跨团队任务质量，隐私保护建立信任。

---

### EPIC-005: 信誉分系统

**Description:**
实现团队信誉分的记录、计算和应用（auto 授权判定）。

**Functional Requirements:**
- FR-012
- FR-013

**Story Count Estimate:** 3-4

**Priority:** Should Have

**Business Value:** 信誉分是 auto 授权的基础，让可靠团队获得更快的协作体验。

---

### EPIC-006: 群管理 UI

**Description:**
群管理界面、跨团队任务看板、授权审批流、信誉分展示。

**Functional Requirements:**
- FR-015
- FR-016
- FR-017
- FR-018

**Story Count Estimate:** 5-7

**Priority:** Should Have

**Business Value:** UI 是用户与群功能交互的入口，决定易用性。

---

## User Stories (High-Level)

### EPIC-001: 团队抽象

- "As a 团队 Owner, I want to 将我的 Agent 组织为一个团队 so that 我可以作为一个整体加入群"
- "As a 团队 Owner, I want to 邀请协作者加入我的团队 so that 他们可以查看团队状态"
- "As a 系统, I need to 自动将现有 Agent 归属默认团队 so that 升级不破坏现有功能"

### EPIC-002: 群契约与成员管理

- "As a 团队 Owner, I want to 创建一个群并配置契约 so that 我可以邀请其他团队协作"
- "As a 团队 Owner, I want to 通过邀请码加入群 so that 我可以参与跨团队任务"
- "As a 团队 Owner, I want to 随时退出群 so that 我可以停止参与协作"
- "As a 群 Owner, I want to 编辑群契约 so that 我可以调整协作规则"

### EPIC-003: 两级任务池与授权

- "As a 任务发布者, I want to 将任务发布到群任务池 so that 其他团队的 Agent 可以帮忙执行"
- "As a 群内 Agent, I want to 看到群任务池的任务并 claim so that 我可以接跨团队任务"
- "As a 任务发布者, I want to 在 manual 模式下审批 claim 请求 so that 我可以控制谁执行我的任务"
- "As a 系统, I need to 在 auto 模式下自动授权高信誉团队 so that 协作更高效"
- "As a 系统, I need to 在任务失败后自动回池 so that 其他 Agent 可以重试"

### EPIC-004: 跨团队 Review

- "As a 任务拆解者, I want to 收到外部 Agent 的执行产出 so that 我可以 review 子任务质量"
- "As a 任务拆解者, I want to rejected 后任务自动回池 so that 其他 Agent 可以重新执行"
- "As a 外部 Agent Owner, I want to 我的执行过程不被暴露 so that 我的工具链和策略保持私密"

### EPIC-005: 信誉分系统

- "As a 系统, I need to 记录团队任务表现 so that 信誉分可用于 auto 授权"
- "As a 群 Owner, I want to 查看成员团队信誉分 so that 我可以调整信任阈值"
- "As a 系统, I need to 信誉分不足时降级为 manual 模式 so that 新团队不能直接获得自动授权"

### EPIC-006: 群管理 UI

- "As a 团队 Owner, I want to 通过 UI 管理群 so that 我不需要编辑 YAML 文件"
- "As a 任务发布者, I want to 在看板上区分内部和群任务 so that 我能清楚任务来源"
- "As a 任务发布者, I want to 在 UI 上一键审批 claim 请求 so that 操作便捷"
- "As a 群成员, I want to 在 UI 上看到各团队信誉分 so that 我了解协作者的可靠性"

---

## User Personas

### Persona 1: 独立开发者 (Primary)

- **背景**: 拥有 2-5 个 Agent（Claude Code、Codex 等）分布在不同机器上
- **目标**: 让闲置 Agent 帮朋友/社区成员执行任务，同时借用他人的 Agent 算力
- **痛点**: 没有安全机制，要么全信要么全不信
- **使用频率**: 每天

### Persona 2: 开源社区贡献者 (Secondary)

- **背景**: 参与多个开源项目，想让自己的 Agent 帮社区做 code review、写测试
- **目标**: 贡献算力给社区，同时获得社区 Agent 帮助
- **痛点**: 缺乏标准化的跨项目协作机制
- **使用频率**: 每周

---

## User Flows

### Flow 1: 创建群并邀请成员

```
团队 Owner A → 创建群 → 配置契约（shared_capabilities, authorization=manual）
  → 生成邀请码 → 发送给朋友 B
  B → 输入邀请码 → 申请加入 → A 审批 → B 加入群
  → B 的 Agent 可见群任务池
```

### Flow 2: 跨团队任务执行（Manual 模式）

```
A 发布任务到群任务池（required_capabilities: ["code_review"]）
  → B 的 Agent claim → 状态 pending_authorization
  → A 收到审批通知 → 查看 B 的信誉分 → 批准
  → B 的 Agent 执行任务 → 完成 → 产出发送给 A
  → A review 产出 → approved → 任务完成，B 信誉分 +1
```

### Flow 3: 跨团队任务执行（Auto 模式）

```
群契约 authorization=auto, trust_threshold=0.6
A 发布任务 → B 的 Agent claim
  → 系统检查 B 信誉分 = 0.8 >= 0.6 → 自动授权
  → B 的 Agent 执行 → 完成 → 产出发送给 A
  → A review → approved → 信誉分 +1
```

---

## Dependencies

### Internal Dependencies

- 现有 TaskQueue 模块（需扩展支持群任务池）
- 现有 AgentRegistry（需扩展支持团队模型）
- 现有 WebSocket handler（需扩展支持群消息广播）
- 现有数据库（需新增 teams、groups、group_members 等表）
- 现有 WebUI（需新增群管理页面）

### External Dependencies

- 无新的外部依赖
- 保持现有技术栈（Node.js + SQLite + WebSocket）

---

## Assumptions

- 团队和群都是纯抽象结构，无组织层级概念
- 初期用户规模小（< 100 团队，< 20 群）
- Agent 间通信延迟可接受（< 5 秒）
- 用户有基本技术能力，能自部署
- 信誉分冷启动阶段默认 manual 授权模式
- 现有 claim 机制在群内仍然适用（先到先得）

---

## Out of Scope

- 域 (Domain) 级协作
- World 公共层
- 商业化功能（SaaS 托管、计费系统）
- 组织层级管理（公司/部门/科室）
- Agent 能力自动发现（初期靠手动配置 shared_capabilities）
- 跨服务器分布式调度（仍为单服务器架构）

---

## Open Questions

1. **群内聊天**: 群内是否需要公共聊天频道？还是只有任务相关通信？
   - 建议：初期只有任务相关通信，后续可扩展群聊天

2. **Agent 身份**: 跨团队时，外部 Agent 是否需要标准化身份标识（如 agent:// URI）？
   - 建议：初期用现有 agent_id + team_id 组合标识，后续再考虑标准化

3. **任务定价**: 群任务是否需要预算/积分机制？
   - 建议：初期不引入，信誉分足够。后续结合预算控制功能扩展

4. **契约版本**: 群契约修改后，是否需要版本管理和成员重新确认？
   - 建议：初期修改即生效 + 通知，后续可加版本管理

---

## Approval & Sign-off

### Stakeholders

- **fjibj (Project Owner / 唯一开发者)** - 高影响力。项目设计、开发、推广全部由一人负责。

### Approval Status

- [ ] Product Owner
- [ ] Engineering Lead
- [ ] Design Lead
- [ ] QA Lead

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-11 | fjibj | Initial PRD for Group Expansion |

---

## Appendix A: Requirements Traceability Matrix

| Epic ID | Epic Name | Functional Requirements | Story Count (Est.) |
|---------|-----------|-------------------------|-------------------|
| EPIC-001 | 团队抽象 | FR-001, FR-002 | 3-4 |
| EPIC-002 | 群契约与成员管理 | FR-003, FR-004, FR-005 | 4-6 |
| EPIC-003 | 两级任务池与授权 | FR-006, FR-007, FR-008, FR-009, FR-014 | 6-8 |
| EPIC-004 | 跨团队 Review | FR-010, FR-011 | 3-4 |
| EPIC-005 | 信誉分系统 | FR-012, FR-013 | 3-4 |
| EPIC-006 | 群管理 UI | FR-015, FR-016, FR-017, FR-018 | 5-7 |
| **Total** | | **18 FRs** | **24-33 stories** |

---

## Appendix B: Prioritization Details

### Functional Requirements

| Priority | Count | FRs |
|----------|-------|-----|
| Must Have | 11 | FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-010, FR-014, FR-009 |
| Should Have | 6 | FR-009, FR-011, FR-012, FR-013, FR-015, FR-016, FR-017 |
| Could Have | 1 | FR-018 |

### Non-Functional Requirements

| Priority | Count | NFRs |
|----------|-------|------|
| Must Have | 4 | NFR-001, NFR-002, NFR-004, NFR-005 |
| Should Have | 2 | NFR-003, NFR-006 |

---

## Next Steps

### Phase 3: Architecture

Run `/architecture` to create system architecture based on these requirements.

The architecture will address:
- All functional requirements (FRs)
- All non-functional requirements (NFRs)
- Data model design (teams, groups, group_members, reputation)
- API design (group CRUD, task broadcast, authorization)
- WebSocket protocol extension
- Database migration strategy

### Phase 4: Sprint Planning

After architecture is complete, run `/sprint-planning` to:
- Break epics into detailed user stories
- Estimate story complexity
- Plan sprint iterations
- Begin implementation

---

**This document was created using BMAD Method v6 - Phase 2 (Planning)**

*To continue: Run `/workflow-status` to see your progress and next recommended workflow.*
