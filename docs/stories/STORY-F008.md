# STORY-F008: Agent 跨团队唤醒（federation.claim wake trigger）

**Epic:** EPIC-F02 跨团队任务路由与 E2E
**Sprint:** 2
**Points:** 3
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a 外群 Agent, I want to 在 claim 成功并被授权后自动被唤醒, So that 可以开始执行跨团队任务。

---

## Acceptance Criteria

- [ ] Hub 在 claim 被源团队授权批准后，向 Runner 发送 `federation.agent.wake` 消息
- [ ] Runner 收到 wake 消息后，向本地 Daemon 发送 `agent.wake` WS 消息
- [ ] wake trigger 类型新增 `federation.claim`（复用现有 wake-engine）
- [ ] wake 上下文包含：task_id、title、required_labels、source_team_id
- [ ] Agent 被唤醒后开始执行任务，和本地任务执行流程完全一致

---

## Technical Notes

**修改文件:**
- `packages/server/src/federation/hub.ts` — 授权批准后转发 wake 消息
- `packages/server/src/federation/runner.ts` — 接收 wake 并调用本地 wake-engine
- `packages/server/src/modules/wake-engine.ts` — 新增 `federation.claim` trigger 类型

**Wake 流程:**
```
Hub: authorization approved
  → send WS to Runner: { type: 'federation.agent.wake', agent_id, task_id, context }
Runner: onMessage()
  → call local wakeEngine.wakeAgent(agent_id, 'federation.claim', context)
Daemon: receive agent.wake
  → spawn agent process with task context
```

**复用:** 现有 `wake-engine.ts` 的 `wakeAgent()` 函数，只需扩展 trigger 类型枚举。

---

## Dependencies

- STORY-F004（Hub 消息路由）
- STORY-F005（Runner 消息接收）
- STORY-G016（Sleep/Wake 引擎）

---

## Implementation Order

1. 扩展 wake-engine.ts，新增 `federation.claim` trigger
2. Hub 在授权批准后发送 federation.agent.wake
3. Runner 接收 wake 并调用本地 wakeEngine
4. 测试：claim → 授权 → wake → Agent 进程启动
