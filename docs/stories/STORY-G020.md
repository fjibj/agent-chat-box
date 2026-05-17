# STORY-G020: 信誉分记录

**Epic:** EPIC-005 信誉分系统
**Sprint:** 2
**Points:** 3
**Priority:** Should Have
**Status:** not_started

---

## User Story

As a 系统, I want to 记录团队在群内的任务表现, So that 信誉分可用于授权判定。

---

## Acceptance Criteria

- [ ] 新增 `reputation_records` 表（id TEXT PK, team_id TEXT, group_id TEXT, event_type TEXT, score_delta INTEGER, task_id TEXT, created_at INTEGER）
- [ ] 事件类型和分值：task_completed(+1), task_failed(-1), review_approved(+1), review_rejected(-2)
- [ ] 新团队初始信誉分 = 0（无记录）
- [ ] 信誉分按群独立计算（同一团队在不同群有不同信誉分）
- [ ] `recordReputation(teamId, groupId, eventType, taskId)` 内部函数

---

## Technical Notes

**新建文件:** `packages/server/src/modules/reputation.ts`

**数据表:** reputation_records（在 STORY-G010 迁移中创建）

**触发点:**
- task_completed: updateTask status='completed' 时
- task_failed: updateTask status='failed' 时
- review_approved: review API approved 时
- review_rejected: review API rejected 时

---

## Dependencies

- STORY-G010（reputation_records 表）

---

## Implementation Order

1. 创建 reputation.ts
2. 实现 recordReputation() 函数
3. 在 task 完成/失败时触发
4. 在 review 完成时触发
5. 测试：验证记录正确写入
