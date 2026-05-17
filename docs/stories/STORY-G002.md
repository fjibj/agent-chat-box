# STORY-G002: 团队 CRUD API

**Epic:** EPIC-001 团队抽象
**Sprint:** 1
**Points:** 3
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a 用户, I want to 创建、查询、更新、删除团队, So that 我可以管理我的团队。

---

## Acceptance Criteria

- [ ] `POST /api/teams` — 创建团队（name 必填），自动将当前用户设为 Owner
- [ ] `GET /api/teams/:id` — 查询团队详情（含成员列表、Agent 列表）
- [ ] `PATCH /api/teams/:id` — 更新团队名称
- [ ] `DELETE /api/teams/:id` — 删除团队（需先移除所有 Agent，需先退出所有群）
- [ ] `GET /api/teams` — 列出当前用户拥有的团队
- [ ] 只有 Owner 可修改/删除团队

---

## Technical Notes

**新建文件:** `packages/server/src/api/teams.ts`

**注册路由:** 修改 `packages/server/src/index.ts` 添加 `registerTeamRoutes(app)`

**数据表:** teams, team_members

**Owner 识别:** 通过 API Key 关联 machine → machine.team_id → team.owner_user_id。当前简化：API Key 对应的 machine 的 team_id 即为当前团队。

---

## Dependencies

- STORY-G001（teams 表）

---

## Implementation Order

1. 创建 `packages/server/src/api/teams.ts`
2. 实现 POST /api/teams
3. 实现 GET /api/teams/:id
4. 实现 PATCH /api/teams/:id
5. 实现 DELETE /api/teams/:id
6. 实现 GET /api/teams
7. 注册路由到 index.ts
8. 测试所有端点
