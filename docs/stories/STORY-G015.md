# STORY-G015: Auto 授权模式

**Epic:** EPIC-003 两级任务池与授权
**Sprint:** 2
**Points:** 3
**Priority:** Should Have
**Status:** not_started

---

## User Story

As a 系统, I want to 在 auto 模式下自动授权高信誉团队, So that 协作更高效。

---

## Acceptance Criteria

- [ ] 群契约 authorization='auto' 时，claim 后自动检查信誉分
- [ ] 信誉分 >= trust_threshold → 自动批准（跳过审批通知）
- [ ] 信誉分 < trust_threshold → 降级为 manual（发送审批通知）
- [ ] 检查 claim 团队未超 resource_quota.max_tasks_per_hour
- [ ] 超配额 → 降级为 manual
- [ ] 新团队（无信誉分记录）→ 降级为 manual
- [ ] 自动批准后 WebSocket 通知 claim 团队 `authorization.approved`

---

## Technical Notes

**修改文件:**
- `packages/server/src/api/authorizations.ts` — 在 claim 流程中添加 auto 判定

**Auto 判定逻辑:**
```typescript
if (contract.authorization === 'auto') {
  const reputation = getReputation(teamId, groupId);
  const withinQuota = checkQuota(teamId, groupId, contract.resource_quota);
  if (reputation >= contract.trust_threshold && withinQuota) {
    // 自动批准
    approveAuthorization(requestId);
    return;
  }
  // 降级为 manual
}
```

**注意:** 需要 STORY-G020（信誉分记录）和 STORY-G022（阈值判定）先完成。Sprint 2 中先实现框架，信誉分查询用 stub。

---

## Dependencies

- STORY-G013（跨团队 claim）
- STORY-G020（信誉分记录，Sprint 2）
- STORY-G022（阈值判定，Sprint 3）

---

## Implementation Order

1. 实现 auto 判定逻辑（先用 stub 获取信誉分）
2. 实现配额检查
3. 集成到 claim 流程
4. 测试：高信誉自动通过、低信誉降级、超配额降级
