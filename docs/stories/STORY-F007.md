# STORY-F007: 群任务队列拉取模式（poll 替代广播）

**Epic:** EPIC-F02 跨团队任务路由与 E2E
**Sprint:** 2
**Points:** 5
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a 成员团队 Server, I want to 定期 poll 群任务索引而不是被动接收广播, So that Hub 不需要维护成员的实时连接状态，离线后也能同步错过的任务。

---

## Acceptance Criteria

- [ ] Hub 维护 `federation_task_index` 表，记录所有开放中的群任务
- [ ] `GET /api/federation/poll` 接口：接受 `team_id`、`agent_labels` 参数，返回匹配的任务列表
- [ ] Runner 每 5~10 秒调用一次 poll
- [ ] poll 返回的任务包含：task_id、title、required_labels、source_team_id
- [ ] 任务被 claim 后，Hub 将索引状态更新为 `claimed`，后续 poll 不再返回
- [ ] 成员 Server 离线恢复后，poll 自动返回离线期间发布的任务

---

## Technical Notes

**修改文件:**
- `packages/server/src/federation/hub.ts` — 新增 poll HTTP 端点
- `packages/server/src/federation/runner.ts` — 实现 poll 循环
- `packages/server/src/modules/task-queue.ts` — 任务创建时同步写入联邦索引

**Hub poll 实现:**
```typescript
// hub.ts
app.get('/api/federation/poll', async (req, res) => {
  const { team_id, labels } = req.query;
  const tasks = db.query(
    `SELECT * FROM federation_task_index
     WHERE group_id = ? AND status = 'open'
     AND required_labels IS NULL OR required_labels = '[]'
     OR EXISTS (SELECT 1 FROM json_each(required_labels) WHERE value IN (SELECT value FROM json_each(?)))
     ORDER BY created_at DESC`,
    [groupId, labels]
  );
  return tasks;
});
```

**复用:** 现有 `task-queue.ts` 的 createTask 逻辑，扩展为同时写入 `federation_task_index`。

---

## Dependencies

- STORY-F004（Hub 端点）
- STORY-F005（Runner 客户端）
- STORY-F006（标签匹配）

---

## Implementation Order

1. 扩展 task-queue.ts，createTask 时写入 federation_task_index
2. Hub 实现 GET /api/federation/poll 端点
3. Runner 实现 poll 循环（定时器）
4. 测试：发布任务 → Runner poll 获取 → claim → 验证索引状态更新
