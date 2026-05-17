# STORY-G026: 信誉分展示

**Epic:** EPIC-006 群管理 UI
**Sprint:** 3
**Points:** 2
**Priority:** Could Have
**Status:** not_started

---

## User Story

As a 群成员, I want to 在 UI 上看到各团队信誉分, So that 我了解协作者可靠性。

---

## Acceptance Criteria

- [ ] 群成员列表显示各团队信誉分（数字 + 颜色）
- [ ] 审批界面显示 claim 团队信誉分
- [ ] 颜色规则：>= 5 绿色、1-4 黄色、<= 0 红色
- [ ] 信誉分详情弹窗（事件列表：时间、类型、分值）

---

## Technical Notes

**API 调用:**
- `GET /api/groups/:gid/reputation` — 群内所有团队信誉分
- `GET /api/groups/:gid/reputation/:tid` — 单个团队详情

**组件:**
- ReputationBadge（数字 + 颜色）
- ReputationDetail（事件列表）

---

## Dependencies

- STORY-G021（信誉分查询 API）
- STORY-G023（群管理页面）

---

## Implementation Order

1. 实现 ReputationBadge 组件
2. 集成到群成员列表
3. 集成到审批界面
4. 实现详情弹窗
5. 测试
