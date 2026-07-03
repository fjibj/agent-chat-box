# STORY-G031: Review 工作流 UI

**Epic:** EPIC-004 跨团队 Review UI Follow-up
**Sprint:** v0.2.0 Follow-up
**Points:** 5
**Priority:** Must Have
**Status:** ready

---

## User Story

As a 任务发布者, I want to 在 Web UI 中查看并审批外部 Agent 的任务产出, So that Review 工作流不需要通过 API 手动执行。

---

## Acceptance Criteria

### Functional AC

- [ ] **AC-01:** 新增 Review 入口，可位于 Tasks 详情弹窗或独立 `/reviews` 页面。
- [ ] **AC-02:** 已完成的群任务显示 `Request Review` 或 `Review` 区域。
- [ ] **AC-03:** Review 面板显示 task title、output、assignee agent、source team、completed_at。
- [ ] **AC-04:** 提供 `Approve` 和 `Reject` 按钮。
- [ ] **AC-05:** 点击 `Approve` 调用 `POST /api/tasks/:tid/review` decision=approved，并显示成功状态。
- [ ] **AC-06:** 点击 `Reject` 调用 `POST /api/tasks/:tid/review` decision=rejected，任务回到 Pending。
- [ ] **AC-07:** Review 结果写入任务详情或时间线，刷新后可见。
- [ ] **AC-08:** 非群任务或未完成任务不显示 Review 操作。
- [ ] **AC-09:** visibility.task_output=false 时，Review UI 不显示 output 正文，只显示任务完成通知。

### UI Entry Points

- [ ] **UI-01 Page:** `/tasks` → TaskDetailModal，或新增 `/reviews`。
- [ ] **UI-02 Trigger:** Review tab / Review button。
- [ ] **UI-03 Fields:** Output viewer、decision buttons、optional comment。
- [ ] **UI-04 Empty state:** 无待 review 任务时提示。
- [ ] **UI-05 Error state:** API 400/500 时展示错误。

### State Mapping

| State field | State value | Badge text | Badge color | Board/List grouping | Detail view | Test case |
|-------------|-------------|------------|-------------|---------------------|-------------|-----------|
| review.status | pending | Review Pending | purple | Reviews list / task detail | ✅ | TC-G031-001 |
| review.status | approved | Review Approved | green | Reviews list / task detail | ✅ | TC-G031-002 |
| review.status | rejected | Review Rejected | red | Reviews list / task detail | ✅ | TC-G031-003 |

### Testability

- [ ] **TEST-01:** Review UI approve path 集成测试。
- [ ] **TEST-02:** Review UI reject path 集成测试。
- [ ] **TEST-03:** 未完成任务不显示 Review 操作。
- [ ] **TEST-04:** visibility.task_output=false 时 output 被隐藏。
- [ ] **TEST-05:** manual-verification M7.1~M7.8 通过。

---

## Technical Notes

**修改文件:**
- `packages/web/src/components/TaskDetailModal.tsx` 或新增 `packages/web/src/pages/ReviewsPage.tsx`
- `packages/server/src/api/reviews.ts`（如需 list/review history API）
- `packages/web/src/App.tsx`（如新增路由）

**API:**
- `POST /api/tasks/:tid/review`
- 可新增 `GET /api/reviews?team_id=...` 或 `GET /api/tasks/review-pending`

---

## Dependencies

- STORY-G017（任务产出回流）
- STORY-G018（Review 状态管理）
- STORY-G019（过程隐私保护）
- STORY-G029（TaskBoard 群任务详情）

---

## Traceability

- Related GAP: GAP-07
- Manual verification: M7.1~M7.8
- AC Coverage Matrix: Review UI Missing
