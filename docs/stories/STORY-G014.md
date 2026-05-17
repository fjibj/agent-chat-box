# STORY-G014: Manual 授权模式

**Epic:** EPIC-003 两级任务池与授权
**Sprint:** 2
**Points:** 5
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a 任务发布者, I want to 在 manual 模式下审批 claim 请求, So that 我可以控制谁执行我的任务。

---

## Acceptance Criteria

- [ ] claim 后 WebSocket 推送 `authorization.requested` 给任务发布者的团队 Owner
- [ ] 通知包含：task 详情、claim 团队名称、claim Agent 信息、过期时间
- [ ] `POST /api/authorizations/:id/approve` — 批准
- [ ] `POST /api/authorizations/:id/reject` — 拒绝
- [ ] 批准后：group_tasks.authorization_status='approved', task.status='claimed', task.assignee_id=claim Agent
- [ ] 拒绝后：task.status='pending', task.assignee_id=NULL, 其他 Agent 可重新 claim
- [ ] 审批超时（默认 5 分钟）→ authorization_requests.status='expired', task 回 pending
- [ ] `GET /api/authorizations/pending` — 查询当前团队待审批的请求

---

## Technical Notes

**新建文件:** `packages/server/src/api/authorizations.ts`

**超时检查:** 在现有 checkTimeouts() 中添加 authorization_requests 超时扫描

**WebSocket 通知:**
- `authorization.requested` → 推送给任务发布者团队 Owner
- `authorization.approved` → 推送给 claim 团队
- `authorization.rejected` → 推送给 claim 团队

---

## Dependencies

- STORY-G013（跨团队 claim）

---

## Implementation Order

1. 创建 authorizations.ts
2. 实现 approve/reject 端点
3. 实现 WebSocket 通知
4. 实现超时检查
5. 实现 pending 查询端点
6. 测试：批准、拒绝、超时
