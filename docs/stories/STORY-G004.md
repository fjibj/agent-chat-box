# STORY-G004: 协作者管理

**Epic:** EPIC-001 团队抽象
**Sprint:** 1
**Points:** 3
**Priority:** Should Have
**Status:** not_started

---

## User Story

As a 团队 Owner, I want to 邀请协作者加入我的团队, So that 他们可以查看团队状态。

---

## Acceptance Criteria

- [ ] `POST /api/teams/:id/members` — 添加协作者（user_id + role）
- [ ] `DELETE /api/teams/:id/members/:uid` — 移除协作者
- [ ] `GET /api/teams/:id/members` — 列出成员
- [ ] 协作者默认 role=member（只读：查看任务、Agent 状态）
- [ ] Owner 可设置 role=admin（部分管理权限：可添加/移除 Agent）
- [ ] 只有 Owner 可添加/移除成员

---

## Technical Notes

**数据表:** team_members

**权限模型:**
- owner: 全部权限
- admin: 可管理 Agent，不可删除团队
- member: 只读

**简化实现:** 当前无用户系统，user_id 暂用 API Key hash 标识。

---

## Dependencies

- STORY-G001（team_members 表）
- STORY-G002（teams API）

---

## Implementation Order

1. 在 teams.ts 添加成员管理端点
2. 实现权限检查中间件
3. 测试：Owner 添加/移除协作者
4. 测试：协作者只读权限
