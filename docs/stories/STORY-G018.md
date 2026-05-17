# STORY-G018: Review 状态管理

**Epic:** EPIC-004 跨团队 Review
**Sprint:** 3
**Points:** 3
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a 任务拆解者, I want to 对外部任务产出进行 review, So that 我可以保证任务质量。

---

## Acceptance Criteria

- [ ] `POST /api/tasks/:tid/review` — 提交 review（body: { result: 'approved' | 'rejected', comment? }）
- [ ] approved：记录信誉分（review_approved, +1），任务保持 completed
- [ ] rejected：任务回群池（status → pending），记录信誉分（review_rejected, -2）
- [ ] review 结果 WebSocket 通知执行团队 `review.completed`
- [ ] review 有超时机制（默认 30 分钟，超时自动 approved）
- [ ] 只有拆解者（或其团队 Owner）可 review

---

## Technical Notes

**新建文件:** `packages/server/src/api/reviews.ts`

**Review 流程:**
1. 验证调用者是拆解者
2. approved: 记录信誉分，通知执行团队
3. rejected: 重置任务为 pending，记录信誉分，通知执行团队

**超时检查:** 在 checkTimeouts() 中添加 review 超时扫描。

---

## Dependencies

- STORY-G017（产出回流）

---

## Implementation Order

1. 创建 reviews.ts
2. 实现 POST /api/tasks/:tid/review
3. 实现 WebSocket 通知
4. 实现超时检查
5. 测试：批准、拒绝、超时
