# STORY-G017: 任务产出回流

**Epic:** EPIC-004 跨团队 Review
**Sprint:** 3
**Points:** 5
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a 任务拆解者, I want to 收到外部 Agent 的执行产出, So that 我可以 review 子任务质量。

---

## Acceptance Criteria

- [ ] 外部任务完成后，output 自动发送给原拆解者
- [ ] 通知通过 WebSocket `review.requested` 推送
- [ ] 通知包含：task_id, title, output, completed_at, source_agent_name, source_team_name
- [ ] 产出可见性受群契约 visibility.task_output 控制
- [ ] task_output=false 时不发送产出（仅通知任务完成）
- [ ] 拆解者通过 parent_task_id 链找到

---

## Technical Notes

**修改文件:**
- `packages/server/src/modules/task-queue.ts` — updateTask 完成时检查群任务
- `packages/server/src/modules/cross-team-review.ts` — 新建，处理产出回流逻辑

**触发时机:** updateTask status='completed' 时，检查 is_group_task=1 → 调用 sendOutputToDecomposer()

**拆解者查找:** 通过 parent_task_id 链向上查找 depth=0 的根任务的 creator_id。

---

## Dependencies

- STORY-G011（群任务发布）

---

## Implementation Order

1. 创建 cross-team-review.ts
2. 实现 sendOutputToDecomposer() 函数
3. 在 updateTask 完成时触发
4. 实现 visibility 检查
5. 测试：产出回流、visibility 控制
