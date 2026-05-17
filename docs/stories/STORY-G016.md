# STORY-G016: 跨团队任务重试

**Epic:** EPIC-003 两级任务池与授权
**Sprint:** 2
**Points:** 3
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a 系统, I want to 在跨团队任务失败后自动回池, So that 其他 Agent 可以重试。

---

## Acceptance Criteria

- [ ] 跨团队任务失败后自动回群任务池（task.status → pending）
- [ ] 其他 Agent 可重新 claim
- [ ] 同一团队对同一任务重试次数 <= resource_quota.max_retry_per_task
- [ ] 达到重试上限后任务标记为 failed，通知任务发布者
- [ ] Agent 断连后其 claim 的群任务自动回池
- [ ] 授权超时后任务自动回池

---

## Technical Notes

**修改文件:**
- `packages/server/src/modules/task-queue.ts` — 扩展 updateTask 的重试逻辑

**重试计数:** group_tasks 表可加 `retry_count_by_team JSON` 字段，记录每个团队的重试次数。

**Agent 断连处理:** 在 ws/handler.ts 的 close handler 中，检查断连 Agent 是否有群任务 → 回池。

---

## Dependencies

- STORY-G011（群任务发布）

---

## Implementation Order

1. 扩展 updateTask 支持群任务重试
2. 实现 per-team 重试计数
3. Agent 断连时任务回池
4. 测试：任务失败重试、达到上限、Agent 断连
