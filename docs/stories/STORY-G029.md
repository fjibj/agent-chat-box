# STORY-G029: TaskBoard 群任务视觉区分与 pending_authorization 状态

**Epic:** EPIC-006 群管理 UI Follow-up
**Sprint:** v0.2.0 Follow-up
**Points:** 5
**Priority:** Must Have
**Status:** ready

---

## User Story

As a 用户, I want to 在任务看板上清楚地区分内部任务、群任务和待授权任务, So that 我不会遗漏跨团队任务审批和执行状态。

---

## Acceptance Criteria

### Functional AC

- [ ] **AC-01:** TaskBoard 提供内部任务与群任务的视觉区分（标签、图标或颜色）。
- [ ] **AC-02:** 群任务卡片显示来源团队 `source_team_id` 的可读名称（非 UUID）。
- [ ] **AC-03:** 群任务卡片显示授权状态 `authorization_status`。
- [ ] **AC-04:** `pending_authorization` 状态有明确 badge 文案和颜色，不使用 fallback gray。
- [ ] **AC-05:** `pending_authorization` 任务在看板中可见，归类到 Pending 或单独 Authorization 列。
- [ ] **AC-06:** TaskDetailModal 显示群任务字段：group_id、source_team、authorization_status、review_status（如有）。
- [ ] **AC-07:** 支持按群筛选群任务（若不在本 Sprint 实现，必须登记 follow-up）。
- [ ] **AC-08:** 状态枚举完整性测试覆盖所有 task.status。

### UI Entry Points

- [ ] **UI-01 Page:** `/tasks` TaskBoard。
- [ ] **UI-02 Trigger:** 任务卡片、搜索框、群筛选下拉。
- [ ] **UI-03 Empty state:** 群任务为空时提示。
- [ ] **UI-04 Loading/Error:** 拉取任务失败时显示错误状态。

### State Mapping

| State field | State value | Badge text | Badge color | Board/List grouping | Detail view | Test case |
|-------------|-------------|------------|-------------|---------------------|-------------|-----------|
| task.status | pending_authorization | Pending Authorization | yellow/purple | Pending / Authorization | ✅ | TC-G029-003 |
| group_tasks.authorization_status | pending | Auth Pending | yellow | Task card | ✅ | TC-G029-004 |
| group_tasks.authorization_status | approved | Approved | blue/green | Task card | ✅ | TC-G029-005 |
| group_tasks.authorization_status | rejected | Rejected | red | Task card | ✅ | TC-G029-006 |
| group_tasks.authorization_status | expired | Expired | gray/red | Task card | ✅ | TC-G029-007 |

### Testability

- [ ] **TEST-01:** `TaskCard.test.tsx` 覆盖全部 task.status，禁止 fallback gray。
- [ ] **TEST-02:** `TaskBoard.test.tsx` 覆盖 `pending_authorization` 分栏可见。
- [ ] **TEST-03:** `TaskBoard.test.tsx` 覆盖群任务标识和来源团队展示。
- [ ] **TEST-04:** manual-verification M9.1~M9.12 通过。

---

## Technical Notes

**修改文件:**
- `packages/web/src/components/TaskBoard.tsx`
- `packages/web/src/components/TaskCard.tsx`
- `packages/web/src/components/TaskDetailModal.tsx`
- `packages/web/src/components/TaskCard.test.tsx`（新增）
- `packages/web/src/components/TaskBoard.test.tsx`（新增）
- `packages/server/src/api/tasks.ts`（确认返回群任务字段）

---

## Dependencies

- STORY-G010（群任务与授权表）
- STORY-G013（跨团队 Claim API）
- STORY-G014（Manual 授权模式）
- STORY-G024（跨团队任务看板）

---

## Traceability

- Related GAP: GAP-02, GAP-03, GAP-04
- Manual verification: M9.1~M9.12
- AC Coverage Matrix: G024-AC01~AC08
