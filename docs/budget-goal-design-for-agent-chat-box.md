# agent-chat-box 借鉴方案：预算控制 + 目标对齐

**日期**: 2026-05-06
**来源**: Paperclip 项目研究
**目标**: 在 agent-chat-box 现有架构上轻量实现

---

## 一、预算控制

### 1.1 Paperclip 做法（参考）

三层预算：Company → Agent → Project

- Agent 按月循环预算（calendar_month_utc）
- Project 按生命周期总预算（lifetime）
- 软告警 80%：仅通知，不停工
- 硬停 100%：自动暂停 + 创建 approval + 阻塞新任务
- Preflight 检查：事前拦截（心跳调度前、任务 checkout 前、手动唤醒前）
- 账单分类：metered_api 和 subscription_overage 计入预算，subscription_included 不计入

### 1.2 agent-chat-box 轻量方案

#### 数据表

```sql
-- 预算策略表
CREATE TABLE budget_policies (
  id TEXT PRIMARY KEY,
  scope_type TEXT NOT NULL,       -- 'agent'
  scope_id TEXT NOT NULL,         -- agent_id
  monthly_limit_cents INTEGER NOT NULL,
  warn_percent INTEGER DEFAULT 80,
  hard_stop INTEGER DEFAULT 1,    -- 1=启用硬停
  is_active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL
);

-- 成本事件表
CREATE TABLE cost_events (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  task_id TEXT,
  provider TEXT NOT NULL,         -- 'anthropic', 'openai' 等
  model TEXT NOT NULL,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cost_cents INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);
```

#### 执行流程

```
Agent run 结束
  → Daemon 上报 cost_event 到 Server
  → Server 写入 cost_events 表
  → 查询该 agent 当月累计 cost_cents
  → 对比 budget_policies.monthly_limit_cents

  若 >= 80% 且 < 100%:
    → 频道发软告警消息: "⚠️ Agent XX 本月已用 82% 预算"
    → 不影响执行

  若 >= 100%:
    → 标记 agent 为 paused
    → 频道发硬停消息: "🛑 Agent XX 预算用尽，已暂停"
    → 阻止该 agent 新 claim 任务
```

#### Preflight 检查（事前拦截）

在以下时机检查预算：

- `task.claim` 时：检查 agent 是否预算暂停
- `agent.wake` 时：检查是否还有预算
- 人手动分配任务时：检查目标 agent 预算状态

返回明确错误：`{ "error": "agent_budget_paused", "agent_id": "xxx" }`

#### 恢复方式

不需要 approval 系统，用聊天命令：

```
@bot budget set agent-1 5000     # 设置月预算 $50
@bot budget status               # 查看所有 agent 预算
@bot resume agent-1              # 恢复暂停的 agent
```

#### 报告查询

```sql
-- Agent 当月累计
SELECT agent_id, SUM(cost_cents) as total
FROM cost_events
WHERE created_at >= ?  -- 月初时间戳
GROUP BY agent_id;

-- 按 provider/model 分解
SELECT provider, model, SUM(cost_cents), SUM(input_tokens), SUM(output_tokens)
FROM cost_events
WHERE agent_id = ? AND created_at >= ?
GROUP BY provider, model;
```

### 1.3 实现优先级

| 步骤 | 内容 | 工作量 |
|------|------|--------|
| 1 | 建表 + Daemon 上报 cost_event | 小 |
| 2 | 月累计计算 + 软告警 | 小 |
| 3 | 硬停 + agent 暂停 | 中 |
| 4 | 聊天命令控制 | 中 |
| 5 | 频道报告 | 小 |

---

## 二、目标对齐

### 2.1 Paperclip 做法（参考）

独立 goals 表，三层级：Company → Team → Agent

- 每个 Issue 关联 goalId
- 创建子任务时必须设置 goalId
- Agent 执行时看到：任务 → 子目标 → 公司目标，整条链路

### 2.2 agent-chat-box 轻量方案

不需要独立 goals 表，复用现有 Task 模型。

#### 方案：Task 扩展字段

```sql
-- Task 表增加字段
ALTER TABLE tasks ADD COLUMN tags TEXT;          -- JSON 数组，如 ["认证模块", "Q1-MVP"]
ALTER TABLE tasks ADD COLUMN parent_id TEXT;      -- 父任务 ID
ALTER TABLE tasks ADD COLUMN goal_hint TEXT;      -- 简短的 why 描述
```

#### 数据示例

```json
{
  "id": "task-100",
  "title": "实现 JWT 签名",
  "tags": ["认证模块", "Q1-MVP"],
  "parent_id": "task-90",
  "goal_hint": "认证模块是 MVP 核心功能，上线前必须完成"
}
```

#### Agent 视角

Agent claim 任务时，Server 在 wake 消息中附带上下文：

```
你认领了任务: 实现 JWT 签名
所属模块: 认证模块
上层任务: 完成认证模块 (task-90)
目标: 认证模块是 MVP 核心功能，上线前必须完成
```

#### 实现方式

1. Task 支持 `parent_id` + `tags` + `goal_hint`
2. `task.claim` 时 Server 递归查 parent chain
3. 在 wake 消息中拼装上下文推送给 Agent
4. Agent 自动获得 why 信息

```typescript
// Server 端拼装上下文
function buildGoalContext(taskId: string): string {
  const chain: string[] = [];
  let current = getTask(taskId);
  while (current) {
    if (current.goal_hint) chain.push(current.goal_hint);
    if (current.tags?.length) chain.push(`模块: ${current.tags.join(', ')}`);
    current = current.parent_id ? getTask(current.parent_id) : null;
  }
  return chain.reverse().join(' → ');
}
```

### 2.3 实现优先级

| 步骤 | 内容 | 工作量 |
|------|------|--------|
| 1 | Task 表加 parent_id + tags + goal_hint | 小 |
| 2 | 创建任务时支持设置这些字段 | 小 |
| 3 | claim 时拼装上下文推送 | 中 |
| 4 | UI 显示目标链路 | 中 |

---

## 三、总结

两个功能都不需要改架构，在现有 Task + Agent 模型上加字段 + 逻辑即可。

| 功能 | 核心改动 | 复杂度 |
|------|---------|--------|
| 预算控制 | cost_events 表 + 月累计 + 暂停逻辑 | 中 |
| 目标对齐 | Task 加 3 字段 + claim 时拼装上下文 | 低 |

预算控制建议先做软告警（观察 token 消耗模式），再加硬停。目标对齐可以快速实现，立竿见影。
