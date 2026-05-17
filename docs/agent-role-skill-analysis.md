# Agent 角色与技能分配策略分析

**日期**: 2026-05-06
**背景**: agent-chat-box 设计讨论——是否需要给 Agent 分配角色或技能列表

---

## 一、策略谱系

```
宽松 ◄────────────────────────────────────────► 严格

纯争抢     争抢+技能参考     技能匹配派发     角色+审批
(当前做法)                                      (Paperclip)
```

---

## 二、各方案对比

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|---------|
| **纯争抢** | 简单、快、无瓶颈 | 可能抢到不擅长的任务 | Agent 同质、快速迭代 |
| **争抢+技能参考** | Agent 自己判断是否合适 | 依赖 Agent 判断力 | 轻度差异化 |
| **技能匹配派发** | 效率高、错配少 | 需维护技能表、Server 复杂 | Agent 差异大、数量多 |
| **角色+审批** | 最可控 | 最重、最慢 | 合规要求高的生产环境 |

---

## 三、关键洞察

### Agent 不是人

人有明确技能边界（前端不会写 Rust），但 Claude Code/Codex 这类通用 Agent 什么都能做，只是质量有差异。给通用 Agent 做技能细分意义不大。

### 何时需要区分

| 情况 | 是否需要区分 | 原因 |
|------|------------|------|
| 全是同类型 Agent（如全是 Claude Code） | 不需要 | 能力一样 |
| 不同类型 Agent（Claude Code + Codex） | 轻度区分 | 代码风格偏好不同 |
| 通用 + 专用 Agent（如只做测试的 Agent） | 需要 | 专用 Agent 不能做所有事 |
| 不同配置（不同 model/temperature） | 可选 | 看质量差异是否明显 |

---

## 四、建议方案：争抢 + 软约束

### 设计原则

保留争抢制，加一层"自我过滤"，不强制不阻断。

### 流程

```
任务发布（带 tags）→ 广播所有 Agent
  → Agent 看到任务描述 + tags
  → Agent 自己判断：我能做吗？
  → 能做 → claim
  → 不能做 → 跳过
```

### 实现方式

wake 消息中加 tags 字段：

```json
{
  "task_id": "task-100",
  "title": "修复前端布局 bug",
  "tags": ["frontend", "react", "css"],
  "description": "移动端 flex 布局错位"
}
```

Agent 根据 tags 和 description 自行决定是否 claim。不强制，不阻断。

### 如果需要更强的技能路由

轻量方案：延迟优先窗口

```
task.claim 请求到达 Server
  → Server 检查 task.tags 和 agent.capabilities
  → 匹配度高 → 直接处理 claim
  → 匹配度低 → 延迟 3 秒再处理（给匹配 Agent 优先窗口）
  → 仍无人抢 → 开放给所有 Agent
```

**不是"不能做"，是"晚一点做"。** 保留竞争机制，只是给匹配 Agent 优先权。

### Agent 声明 capabilities（可选）

Agent hello 时声明：

```json
{
  "agent_id": "agent-1",
  "role_card": { "name": "Claude Code", "avatar": "..." },
  "capabilities": ["code", "review", "test"],
  "preferred_tags": ["frontend", "react"]
}
```

- `capabilities`: Agent 能做什么（结构性能力）
- `preferred_tags`: Agent 擅长什么（偏好，不阻断）

Server 可用于优先路由，但不阻止其他 Agent 竞争。

---

## 五、演进路径

```
阶段 1（当前）：纯争抢
  ↓ 观察到错配问题
阶段 2：任务加 tags + Agent 自我过滤
  ↓ Agent 数量多 + 模型差异大
阶段 3：Agent 声明 capabilities + 延迟优先窗口
  ↓ 合规/审计需求
阶段 4：角色 + 审批（参考 Paperclip）
```

---

## 六、结论

- 争抢制是正确选择，不需要照搬 Paperclip 的角色体系
- 角色/技能是优化手段，不是必须
- 过早加约束 = 过度设计
- 按需演进：先跑起来，出问题再加约束
- Paperclip 需要角色是因为它模拟公司，agent-chat-box 场景不需要
