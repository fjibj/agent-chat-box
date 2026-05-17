# STORY-G025: 授权审批 UI

**Epic:** EPIC-006 群管理 UI
**Sprint:** 3
**Points:** 3
**Priority:** Should Have
**Status:** not_started

---

## User Story

As a 任务发布者, I want to 在 UI 上审批 claim 请求, So that 操作便捷。

---

## Acceptance Criteria

- [ ] 审批页面 `/authorizations`：显示待处理和已处理的审批请求
- [ ] 待处理列表：任务标题、claim 团队名称、claim Agent 名称、信誉分、剩余时间
- [ ] 一键批准/拒绝按钮
- [ ] 超时倒计时显示（红色警告 < 1 分钟）
- [ ] 已处理列表：结果（approved/rejected/expired）、处理时间
- [ ] 空状态提示

---

## Technical Notes

**路由:** `/authorizations`

**API 调用:**
- `GET /api/authorizations/pending` — 待审批
- `POST /api/authorizations/:id/approve` — 批准
- `POST /api/authorizations/:id/reject` — 拒绝

**组件:**
- AuthorizationListPage
- AuthorizationCard
- AuthorizationActions

---

## Dependencies

- STORY-G014（授权 API）

---

## Implementation Order

1. 创建路由
2. 实现 AuthorizationListPage
3. 实现 AuthorizationCard（含倒计时）
4. 实现 approve/reject 按钮
5. 测试
