# 聊天链式调用与任务区分设计

**日期**: 2026-05-06
**背景**: agent-chat-box 聊天协议设计——链式 @mention、防循环、聊天与任务区分

---

## 一、链式 @mention 机制

### 场景

```
人 @A: "帮我写个登录页面"
  A 需要后端 API → A @B: "写个登录 API"
    B 完成 → B @A: "API 好了，endpoint: /api/login"
  A 拿到 API → A 写前端
A 完成 → A @人: "登录页面做好了"
```

### 消息信封

```json
{
  "type": "message.send",
  "data": {
    "channel_id": "ch-1",
    "text": "写个登录 API，endpoint /api/login",
    "mentions": ["agent-B"],
    "chain": {
      "id": "chain-abc123",
      "origin": "human-1",
      "hop": 1,
      "max_hop": 5,
      "visited": ["human-1", "agent-A"],
      "reply_to": "agent-A"
    }
  }
}
```

| 字段 | 作用 |
|------|------|
| `chain.id` | 整条链唯一标识 |
| `chain.origin` | 发起者（人或 Agent） |
| `chain.hop` | 当前第几跳（仅转发递增） |
| `chain.max_hop` | 最大跳数（默认 5） |
| `chain.visited` | 主动调用过的 Agent 列表（防环用） |
| `chain.reply_to` | 完成后回复给谁 |

### 回复机制

回复沿 `reply_to` 回溯，链条自然回流，无需额外逻辑。

---

## 二、防循环规则（修正版）

### 核心区分：回复 vs 转发

- **回复**：目标是 `reply_to` 指向的 Agent → 始终允许，不递增 hop，不检查环
- **转发**：目标是新 Agent → 递增 hop，检查环

### 三条规则

```
1. hop >= max_hop → 不能再转发，只能回复
2. 转发目标已在 visited 中 → 拒绝，只能回复
3. 回复 reply_to → 始终允许，不递增 hop
```

### 判定逻辑

```typescript
function isReply(chain, targetAgent): boolean {
  return targetAgent === chain.reply_to;
}

if (isReply(chain, targetAgent)) {
  // 回复：直接发，不改 chain
  send(targetAgent, message);
} else {
  // 转发：检查限制，更新 chain
  if (chain.hop >= chain.max_hop) {
    replyTo(chain.reply_to, "达到深度上限");
    return;
  }
  if (chain.visited.includes(targetAgent)) {
    replyTo(chain.reply_to, "检测到环路");
    return;
  }
  chain.hop++;
  chain.visited.push(targetAgent);
  chain.reply_to = myself;
  send(targetAgent, message);
}
```

### 场景验证

#### 场景 1：正常多轮对话

```
人 @A → A @B（转发，hop=1，visited=[人,A,B]）
  B @A（回复，hop 不变）  ← 允许
  A @B（回复，hop 不变）  ← 允许
  B @A（回复，hop 不变）  ← 允许
A @人（回复）             ← 允许
```

A 和 B 可以来回多轮对话，没问题。

#### 场景 2：中间再找第三方

```
人 @A → A @B（转发，hop=1，visited=[人,A,B]）
  B @A（回复）  ← 允许
  A 需要 C → A @C（转发，hop=2，visited=[人,A,B,C]）
    C @A（回复）  ← 允许
  A @B（回复）  ← 允许
A @人（回复）
```

#### 场景 3：防环

```
A @B（转发，hop=1，visited=[A,B]）
  B @C（转发，hop=2，visited=[A,B,C]）
    C 想 @A（转发）→ A 在 visited 中 → 拒绝
    C @B（回复）→ B 是 reply_to → 允许
```

#### 场景 4：hop 上限

```
A @B（hop=1）→ B @C（hop=2）→ C @D（hop=3）→ D @E（hop=4）→ E @F（hop=5）
  F 想转发给 G → hop=5 >= max_hop=5 → 拒绝
  F 只能回复给 E
```

---

## 三、聊天 vs 任务区分

### 核心区别

| | 聊天 | 任务 |
|---|------|------|
| 生命周期 | 短，消息即结束 | 长，有状态流转 |
| 结果 | 文本回复 | 代码/文件/产出物 |
| 跟踪 | 不需要 | 需要（状态、进度、重试） |
| Agent 行为 | 读消息 → 回复 | claim → 执行 → 更新状态 |
| 触发方式 | @mention | task.create / claim |

### 消息类型

```json
// 聊天消息
{
  "type": "message.send",
  "data": {
    "channel_id": "ch-1",
    "text": "这个 bug 怎么修？",
    "mentions": ["agent-A"]
  }
}

// 任务指令
{
  "type": "task.create",
  "data": {
    "channel_id": "ch-1",
    "title": "修复登录 bug",
    "description": "JWT token 过期处理有误",
    "mode": "compete"
  }
}
```

### Agent 行为判定

```
收到 message.send + @我 → 聊天模式：读消息 → 回复
收到 task.create / task.claim → 任务模式：claim → 执行 → 更新状态
```

### 混合场景

```
人 @A: "帮我修登录 bug"（聊天触发）
  A 判断需要创建任务 → A 创建 task（切到任务模式）
  任务被 B 抢到 → B 执行
  B 完成 → B 更新 task 状态 + @A（回到聊天模式）
A 看到任务完成 → A @人: "修好了"
```

### 判定规则

```
@mention + 无 task 关联 → 聊天
@mention + 有 task 关联 → 任务上下文的聊天
task.create / task.claim → 任务
Agent 间 chain → 默认聊天，需要时可升级为任务
```

---

## 四、完整规则集

### 链式 @mention

```
1. 消息带 chain 字段（id, origin, hop, max_hop, visited, reply_to）
2. 回复 reply_to → 始终允许，不递增 hop，不检查环
3. 转发新 Agent → hop+1，检查 visited，更新 reply_to
4. hop >= max_hop → 不能再转发
5. 目标在 visited 中 → 拒绝转发
```

### 聊天 vs 任务

```
1. @mention 无 task 关联 → 聊天，Agent 直接回复
2. task.create / task.claim → 任务，走生命周期
3. Agent 可在聊天中创建任务（升级）
4. 任务完成可触发 @mention 回复（降级回聊天）
```

### 防循环

```
三条规则足够：
- hop 上限（硬限制）
- visited 不回环（转发限制）
- 回复始终允许（不限制对话）
```
