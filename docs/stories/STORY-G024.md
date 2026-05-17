# STORY-G024: 跨团队任务看板

**Epic:** EPIC-006 群管理 UI
**Sprint:** 3
**Points:** 5
**Priority:** Should Have
**Status:** not_started

---

## User Story

As a 用户, I want to 在看板上区分内部和群任务, So that 我能清楚任务来源。

---

## Acceptance Criteria

- [ ] 任务看板有「内部」和「群」标签页
- [ ] 群任务列表显示：任务标题、发布者团队、claim 团队、授权状态、review 状态
- [ ] 支持按群筛选任务（下拉选择群）
- [ ] 外部任务和内部任务视觉区分（不同颜色/标签）
- [ ] 群任务状态标签：pending_authorization（黄）、authorized（蓝）、review_pending（紫）
- [ ] 点击任务可查看详情（含 output、review 结果）

---

## Technical Notes

**修改文件:** 扩展现有任务看板组件

**API 调用:**
- `GET /api/groups/:gid/tasks` — 群任务列表
- `GET /api/tasks?is_group_task=1` — 所有群任务

**筛选参数:** group_id, authorization_status, review_status

---

## Dependencies

- STORY-G011（群任务 API）

---

## Implementation Order

1. 扩展任务看板组件添加标签页
2. 实现群任务列表视图
3. 实现群筛选下拉
4. 实现状态标签样式
5. 实现任务详情弹窗
6. 测试
