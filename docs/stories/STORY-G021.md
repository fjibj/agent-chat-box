# STORY-G021: 信誉分查询 API

**Epic:** EPIC-005 信誉分系统
**Sprint:** 3
**Points:** 3
**Priority:** Should Have
**Status:** not_started

---

## User Story

As a 群成员, I want to 查看群内各团队的信誉分, So that 我了解协作者的可靠性。

---

## Acceptance Criteria

- [ ] `GET /api/groups/:gid/reputation` — 查询群内所有团队信誉分
- [ ] `GET /api/groups/:gid/reputation/:tid` — 查询单个团队信誉分
- [ ] 返回：team_id, team_name, total_score, event_count, last_event_at
- [ ] 信誉分 = SUM(score_delta) WHERE team_id AND group_id
- [ ] 按 total_score 降序排列

---

## Technical Notes

**修改文件:** `packages/server/src/api/reputation.ts` — 新建

**SQL 查询:**
```sql
SELECT r.team_id, t.name as team_name,
       SUM(r.score_delta) as total_score,
       COUNT(*) as event_count,
       MAX(r.created_at) as last_event_at
FROM reputation_records r
JOIN teams t ON t.id = r.team_id
WHERE r.group_id = ?
GROUP BY r.team_id
ORDER BY total_score DESC
```

---

## Dependencies

- STORY-G020（信誉分记录）

---

## Implementation Order

1. 创建 reputation.ts API 文件
2. 实现 GET /api/groups/:gid/reputation
3. 实现 GET /api/groups/:gid/reputation/:tid
4. 测试
