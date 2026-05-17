# Paperclip 深度研究 & 与 agent-chat-box 对比

**日期**: 2026-05-06
**项目地址**: https://github.com/paperclipai/paperclip

---

## 一、Paperclip 核心定位

"Open-source orchestration for zero-human companies"

- 不是 Agent 框架，是**公司模拟器**
- Agent = 员工，有老板、头衔、职位描述、预算、审批流程
- 口号："If OpenClaw is an employee, Paperclip is the company"
- 62k+ stars，MIT 协议

---

## 二、任务分配机制

**指派制，非争抢制。**

### 2.1 分配方式

- 单一 assignee 模型，人手动指派
- 原子 checkout：`POST /api/issues/{id}/checkout`
- 两 Agent 竞争同一任务时，一个成功一个收到 `409 Conflict`
- **409 不重试**，直接换任务

### 2.2 任务层级

```
Workspace
  Initiatives          (战略目标，跨季度)
    Projects           (时间绑定的交付物)
      Milestones       (项目内阶段)
        Issues         (核心工作单元)
          Sub-issues   (拆分的子任务)
```

### 2.3 依赖关系

四种类型：`blocks / blocked_by / related / duplicate`

- blocking 问题解决后自动变绿色标记
- duplicate 自动移入 Cancelled 状态

### 2.4 工作流状态

每个 Team 自定义状态，归属固定分类：

| 分类 | 用途 | 示例状态 |
|------|------|---------|
| Triage | 收件箱，需审查 | Triage |
| Backlog | 已接受，未就绪 | Backlog, Icebox |
| Unstarted | 就绪未开始 | Todo, Ready |
| Started | 活跃工作 | In Progress, In Review, In QA |
| Completed | 完成 | Done, Shipped |
| Cancelled | 拒绝/放弃 | Cancelled, Won't Fix |

### 2.5 标识符

人类可读：`{TEAM_KEY}-{NUMBER}`，如 `ENG-123`、`DES-45`。

---

## 三、Agent 协作机制

### 3.1 Heartbeat 执行模型

Agent 不持续运行，被唤醒执行：

```
触发（定时/分配/@mention/手动）
  → Agent 被唤醒
  → 检查任务列表（按优先级排序）
  → Checkout 任务
  → 执行
  → 更新状态 + 留评论
  → 回到睡眠
```

### 3.2 Sleep/Wake 协议

```
agent.hello → AWAKE → agent.sleep → SLEEPING
                    ↑                    │
                    │  agent.wake (server)│
                    └────────────────────┘
```

Server 控制何时唤醒，携带 trigger + 上下文。唤醒触发条件：
- 任务分配
- @mention
- 定时心跳
- 审批通过/拒绝
- Blocker 解除
- 子任务完成

### 3.3 Heartbeat 步骤

1. `GET /api/agents/me` — 获取身份、公司、角色、汇报线、预算
2. 处理审批（如有）
3. `GET /api/issues?assigneeAgentId={id}&status=todo,in_progress,in_review,blocked` — 获取任务列表
4. 按优先级选择：`in_progress` → `in_review`（被 comment 唤醒时）→ `todo`
5. Checkout 任务（原子操作）
6. 理解上下文（读取祖先任务理解 why）
7. 执行工作
8. 更新状态
9. 如需委派，创建子任务

### 3.4 委派模式（Delegation）

Manager 拆分任务指派给下属：

```
POST /api/companies/{companyId}/issues
{
  "title": "Implement caching layer",
  "assigneeAgentId": "{reportAgentId}",
  "parentId": "{parentIssueId}",
  "goalId": "{goalId}"
}
```

规则：
- 必须设 `parentId` 和 `goalId`
- 子任务完成时自动唤醒父任务
- 父任务完成时自动完成未完成的子任务

### 3.5 Execution Policy（审批流程）

**运行时强制执行**，不依赖 prompt：

```
Executor 完成 → 自动路由到 Reviewer
  → Reviewer 通过 → 路由到 Approver → 完成
  → Reviewer 打回 → 回到 Executor 重做 → 重新提交 → 再审查
```

特性：
- Review + Approval 两阶段
- 循环打回直到通过
- 每个决策记录审计日志
- 非参与者不能推进状态（422 错误）
- 空评论被拒绝

### 3.6 Comment Required Backstop

每次 Agent run 必须留评论：
- 运行完成但无评论 → 自动排队一次 retry wake
- 重试仍无评论 → 标记 `retry_exhausted`
- 防止"静默完成"

### 3.7 Goal Alignment（目标对齐）

每个任务关联 goal，Agent 知道**为什么做**而不只是做什么。goal ancestry 向上传递。

---

## 四、恢复机制

Paperclip 最复杂的部分。区分四个概念：结构（parent/sub）、依赖（blocker）、归属（owner）、执行（live path）。

### 4.1 崩溃恢复

| 场景 | 处理方式 |
|------|---------|
| 崩溃后 todo 任务无人认领 | 自动排队一次 recovery wake |
| 崩溃后 in_progress 无活跃 run | 自动排队一次 continuation wake |
| Recovery wake 也失败 | 移入 `blocked` + 留可见评论 |

### 4.2 Watchdog（沉默 Run 检测）

活跃 run 长时间无输出时分级处理：

| 级别 | 处理 |
|------|------|
| ok | 正常 |
| suspicious | 创建中优先级审查 issue |
| critical | 高优先级审查 + 阻塞源任务 |
| snoozed | 操作员选择的已知安静期 |
| not_applicable | 不适用 |

操作员决策：`snooze`（延后）、`continue`（确认正常）、`dismissed_false_positive`（误报）。

### 4.3 Non-Terminal Liveness Contract

Agent 拥有的非终态任务，系统必须能回答"下一步谁推动？"。如果无法回答，必须显式上报而非静默。

有效的 action path：
- 活跃 run
- 排队的 wake/continuation
- 执行策略参与者
- 待处理的 interaction/approval
- 一次性 monitor（定时检查）
- 人类 owner
- 健康的 blocker 链
- 显式的 recovery issue

### 4.4 三级恢复策略

| 策略 | 适用场景 | 行为 |
|------|---------|------|
| Auto-Recover | 归属清晰，仅丢失执行连续性 | 保留 owner，重试一次 |
| Explicit Recovery | 能识别问题但不能安全自动完成 | 创建 recovery issue |
| Human Escalation | 下一步依赖 Board 判断 | 留可见评论/issue |

---

## 五、预算与成本控制

- Token 级追踪：按 company、agent、project、goal、issue、provider、model
- 月度预算策略：warning threshold + hard stop
- 超限自动暂停 Agent + 取消排队任务
- 不可 override

---

## 六、其他系统

| 系统 | 说明 |
|------|------|
| Org Chart | 层级、角色、汇报线、权限 |
| Multi-Company | 单部署多公司，完全数据隔离 |
| Governance | Board 审批、配置变更可回滚 |
| Routines | 定时任务（cron/webhook/API 触发） |
| Plugins | 进程外 worker，能力门控 |
| Secrets | 实例级 + 公司级加密存储 |
| Company Portability | 导入导出整个组织（含 secret 清洗） |
| Activity Log | 所有变更记录不可变审计日志 |

---

## 七、Paperclip vs agent-chat-box 对比

### 7.1 架构对比

| 维度 | Paperclip | agent-chat-box |
|------|-----------|----------------|
| 定位 | 公司模拟器 | 跨机任务协作平台 |
| 技术栈 | Node.js + PostgreSQL (嵌入式) | Fastify + ws + SQLite |
| 前端 | React | React + Vite + Tailwind |
| 复杂度 | 高（14 个子系统） | 低（轻量） |
| 跨机 | Daemon 反向连接 | Daemon 反向连接 |

### 7.2 任务分配对比

| 维度 | Paperclip | agent-chat-box |
|------|-----------|----------------|
| 分配方式 | 指派制（单 assignee） | **争抢制（多 Agent 竞争 claim）** |
| checkout 冲突 | 409 不重试，换任务 | **争抢失败重新进入池中** |
| 任务层级 | Initiative → Project → Milestone → Issue → Sub-issue | Task → Subtask |
| 依赖关系 | blocks/blocked_by/related/duplicate 四种 | 较简单 |
| 工作流状态 | 每 Team 自定义，6 大分类 | 固定状态 |

### 7.3 Agent 协作对比

| 维度 | Paperclip | agent-chat-box |
|------|-----------|----------------|
| Agent 间关系 | 组织架构（上下级汇报线） | **平等频道聊天** |
| 协作方式 | Manager 拆 sub-issue 指派 | **自动拆分 + 自动竞争** |
| 审批流程 | Review + Approval 两阶段强制 | 无（宽松原则） |
| 执行模型 | 心跳唤醒（定时/事件触发） | Daemon 持续在线 |
| 实时聊天 | 无（只有 Issue 评论） | **实时频道聊天 + @mention** |
| 目标对齐 | Goal ancestry（每任务知道 why） | 无 |

### 7.4 恢复与干预对比

| 维度 | Paperclip | agent-chat-box |
|------|-----------|----------------|
| 失败处理 | Recovery wake → blocked → 人工介入 | **自动重试 + 重试也竞争** |
| 人可干预 | Board governance + 审批门 | **强行完成/失败** |
| Watchdog | 沉默 run 分级检测 | 无 |
| 预算控制 | Token 级月度预算 + 自动暂停 | 无 |

### 7.5 各自独有

**Paperclip 有但 agent-chat-box 没有的**：
- 审批门（review/approval 运行时强制）
- 预算控制（token 级 + 自动暂停）
- 目标对齐（goal ancestry）
- Watchdog（沉默 run 检测）
- 组织架构（org chart + 汇报线）
- 多公司隔离
- Company Portability（导入导出）
- 不可变审计日志
- Routines（定时任务）
- Plugin 系统

**agent-chat-box 有但 Paperclip 没有的**：
- 任务争抢（竞争 claim）
- 实时 Agent 聊天
- 自动重试 + 重试也竞争
- 强行完成/失败干预
- 轻量级部署

---

## 八、设计哲学对比

| | Paperclip | agent-chat-box |
|---|-----------|----------------|
| 核心隐喻 | Agent 是员工 | Agent 是队友 |
| 管理风格 | 层级、审批、合规 | 平等、竞争、快速 |
| 任务流动 | 人指派 → Agent 执行 → 人审批 | 发布 → 争抢 → 自动执行 |
| 失败策略 | 保守：重试一次 → blocked → 人工 | 激进：自动重试 + 重试也竞争 |
| 人角色 | Board（治理层） | 队友（可干预但不必须） |
| 适合场景 | 长期运营真实业务 | 快速开发迭代 |

---

## 九、结论

- Paperclip 是目前最完整的 Agent 公司编排系统，治理模型成熟
- agent-chat-box 的争抢制 + 自动重试在快速迭代场景更合适
- 两者不矛盾，可互补：Paperclip 的审批/预算/watchdog 思路可选择性借鉴
- Paperclip 复杂度高（14 个子系统），agent-chat-box 轻量优势明显
