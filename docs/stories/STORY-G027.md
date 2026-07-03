# STORY-G027: Groups 页面补齐群生命周期 UI

**Epic:** EPIC-006 群管理 UI Follow-up
**Sprint:** v0.2.0 Follow-up
**Points:** 5
**Priority:** Must Have
**Status:** ready

---

## User Story

As a 团队 Owner, I want to 在 Groups 页面完整管理群生命周期和契约能力, So that 我不需要通过 API/SQL 完成退群、解散群、shared capabilities 配置等操作。

---

## Acceptance Criteria

### Functional AC

- [ ] **AC-01:** 群详情页支持编辑 `shared_capabilities`，至少支持添加、删除、保存字符串能力项。
- [ ] **AC-02:** 群详情页支持编辑 `resource_quota.max_retry_per_task`。
- [ ] **AC-03:** 群详情页支持编辑 `visibility.task_input`。
- [ ] **AC-04:** 非 owner 成员团队在群详情页看到 `Leave Group` 按钮。
- [ ] **AC-05:** 点击 `Leave Group` 显示确认弹窗；确认后调用 `POST /api/groups/:id/leave`。
- [ ] **AC-06:** 群 owner 在群详情页看到 `Delete Group` 按钮。
- [ ] **AC-07:** 点击 `Delete Group` 显示危险确认弹窗；确认后调用 `DELETE /api/groups/:id`。
- [ ] **AC-08:** 退群或解散成功后，左侧群列表刷新，已退出/删除的群不再显示。
- [ ] **AC-09:** API 错误以页面顶部红色错误横幅展示，不只写 console。

### UI Entry Points

- [ ] **UI-01 Page:** `GroupsPage` 群详情区域。
- [ ] **UI-02 Trigger:** `Save Contract`、`Leave Group`、`Delete Group` 按钮。
- [ ] **UI-03 Fields:** shared_capabilities tag input、max_retry_per_task number input、visibility.task_input checkbox。
- [ ] **UI-04 Empty state:** 无群时显示空列表和创建入口。
- [ ] **UI-05 Loading state:** 保存/退群/删除期间按钮禁用或显示 loading。
- [ ] **UI-06 Error state:** 失败时显示可见错误横幅。

### State Mapping

| State field | State value | Badge text | Badge color | Board/List grouping | Detail view | Test case |
|-------------|-------------|------------|-------------|---------------------|-------------|-----------|
| group_members.role | owner | owner | gray/purple | Members | ✅ | TC-G027-003 |
| group_members.role | member | member | gray | Members | ✅ | TC-G027-004 |

### Testability

- [ ] **TEST-01:** `GroupsPage.test.tsx` 覆盖 shared_capabilities 添加/删除/保存。
- [ ] **TEST-02:** `GroupsPage.test.tsx` 覆盖 Leave Group 成功和失败。
- [ ] **TEST-03:** `GroupsPage.test.tsx` 覆盖 Delete Group 成功和失败。
- [ ] **TEST-04:** manual-verification M2.23~M2.30 通过。

---

## Technical Notes

**修改文件:**
- `packages/web/src/pages/GroupsPage.tsx`
- `packages/web/src/pages/GroupsPage.test.tsx`

**API:**
- `PATCH /api/groups/:id/contract`
- `POST /api/groups/:id/leave`
- `DELETE /api/groups/:id`

---

## Dependencies

- STORY-G006（群 CRUD API）
- STORY-G007（群契约配置）
- STORY-G009（退出群 API）
- STORY-G023（群管理页面）

---

## Traceability

- Related GAP: GAP-05, GAP-09, GAP-13
- Manual verification: M2.23~M2.42
- AC Coverage Matrix: G023-AC05, G023-AC07, G023-AC10, G023-AC13, G023-AC14
