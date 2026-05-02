# STORY-023: 任务时间线

**Epic:** EPIC-004 任务系统
**Sprint:** 5
**Points:** 3
**Priority:** Could Have
**Status:** not_started

---

## User Story

As a user, I want to see a task's timeline, so that I can track its full history.

---

## Acceptance Criteria

- [ ] GET /api/tasks/:id/timeline
- [ ] 记录：创建、claim、进度更新、完成/失败
- [ ] 关联的频道讨论
- [ ] 时间线可导出

---

## Technical Notes

- 从 messages 和 tasks 联合查询
- 按时间排序

---

## Dependencies

- STORY-019

---

## Implementation Order

1. 实现时间线查询 API
2. 实现关联消息查询
3. 测试时间线
