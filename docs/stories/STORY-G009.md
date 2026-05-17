# STORY-G009: 退出群

**Epic:** EPIC-002 群契约与成员管理
**Sprint:** 1
**Points:** 2
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a 团队 Owner, I want to 退出群, So that 我可以停止参与协作。

---

## Acceptance Criteria

- [ ] `POST /api/groups/:id/leave` — 退出群
- [ ] 退出时，该团队已 claim 但未完成的群任务自动回群任务池（status → pending）
- [ ] 已完成任务的结果副本不可撤回
- [ ] 退出后 WebSocket 通知群成员 `group.left`
- [ ] 群 Owner 不能退出（需先转让所有权或解散群）

---

## Technical Notes

**退出流程:**
1. 检查不是群 Owner
2. 查询 group_tasks 中该团队的 pending/claimed/running 任务
3. 将这些任务 status 重置为 pending，清除 assignee_id
4. 删除 group_members 记录
5. WebSocket 广播

---

## Dependencies

- STORY-G006（groups API）
- STORY-G010（group_tasks 表，用于任务回池）

---

## Implementation Order

1. 实现 POST /api/groups/:id/leave
2. 实现任务回池逻辑
3. 测试：正常退出、有未完成任务时退出
