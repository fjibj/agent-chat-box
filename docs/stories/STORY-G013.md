# STORY-G013: 跨团队 Claim API

**Epic:** EPIC-003 两级任务池与授权
**Sprint:** 2
**Points:** 5
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a 群内 Agent, I want to claim 群任务池中的任务, So that 我可以接跨团队任务。

---

## Acceptance Criteria

- [ ] `POST /api/tasks/:tid/group-claim` — 跨团队 claim（body: { agentId }）
- [ ] 验证任务是群任务（is_group_task=1）
- [ ] 验证 Agent 所在团队是群成员
- [ ] 验证 Agent 能力匹配任务 required_capabilities
- [ ] Claim 后任务状态变为 `pending_authorization`（新增状态）
- [ ] 更新 group_tasks.authorization_status = 'pending'
- [ ] 创建 authorization_requests 记录（expires_at = now + 5min）
- [ ] 先到先得（原子操作，复用现有 claim 的事务模式）
- [ ] Claim 失败返回明确错误：NOT_FOUND / NOT_GROUP_TASK / NOT_GROUP_MEMBER / CAPABILITY_MISMATCH / ALREADY_CLAIMED

---

## Technical Notes

**新增任务状态:** `pending_authorization` — 在 tasks 表 status CHECK 中添加

**修改文件:**
- `packages/server/src/modules/task-queue.ts` — 添加 claimGroupTask()
- `packages/server/src/api/tasks.ts` — 添加 group-claim 端点

**原子操作:**
```typescript
db.run('BEGIN TRANSACTION');
try {
  // 1. 检查任务状态
  // 2. 更新 tasks SET status='pending_authorization', assignee_id=agentId
  // 3. 更新 group_tasks SET authorization_status='pending'
  // 4. 插入 authorization_requests
  db.run('COMMIT');
} catch {
  db.run('ROLLBACK');
}
```

---

## Dependencies

- STORY-G011（群任务发布）
- STORY-G010（group_tasks, authorization_requests 表）

---

## Implementation Order

1. 修改 tasks 表 status CHECK 添加 pending_authorization
2. 实现 claimGroupTask() 函数
3. 添加 group-claim 端点
4. 测试：正常 claim、能力不匹配、重复 claim
