# STORY-G022: 信誉分阈值判定

**Epic:** EPIC-005 信誉分系统
**Sprint:** 3
**Points:** 2
**Priority:** Should Have
**Status:** not_started

---

## User Story

As a 系统, I want to 根据信誉分判定是否自动授权, So that auto 模式可以工作。

---

## Acceptance Criteria

- [ ] `checkThreshold(teamId, groupId, threshold): boolean` 内部函数
- [ ] 计算团队在该群的总信誉分 = SUM(score_delta)
- [ ] 总分 >= threshold → return true
- [ ] 总分 < threshold → return false
- [ ] 无记录（新团队）→ return false
- [ ] 供 AuthorizationGate 在 auto 模式下调用

---

## Technical Notes

**修改文件:** `packages/server/src/modules/reputation.ts`

**实现:**
```typescript
export function checkThreshold(teamId: string, groupId: string, threshold: number): boolean {
  const db = getDatabase();
  const stmt = db.prepare(
    'SELECT COALESCE(SUM(score_delta), 0) as total FROM reputation_records WHERE team_id = ? AND group_id = ?'
  );
  stmt.bind([teamId, groupId]);
  if (!stmt.step()) { stmt.free(); return false; }
  const row = stmt.getAsObject() as { total: number };
  stmt.free();
  return row.total >= threshold;
}
```

---

## Dependencies

- STORY-G020（信誉分记录）

---

## Implementation Order

1. 实现 checkThreshold() 函数
2. 集成到 STORY-G015 的 auto 授权逻辑
3. 测试：高信誉通过、低信誉拒绝、新团队拒绝
