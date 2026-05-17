# STORY-G006: 群 CRUD API

**Epic:** EPIC-002 群契约与成员管理
**Sprint:** 1
**Points:** 3
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a 团队 Owner, I want to 创建、查询、更新、解散群, So that 我可以管理群。

---

## Acceptance Criteria

- [ ] `POST /api/groups` — 创建群（name 必填），自动生成默认契约，Owner 团队自动加入为 group_members(role=owner)
- [ ] `GET /api/groups/:id` — 查询群详情（含成员列表、契约摘要）
- [ ] `PATCH /api/groups/:id` — 更新群名称/描述
- [ ] `DELETE /api/groups/:id` — 解散群（所有成员退出，群任务回池）
- [ ] `GET /api/groups` — 列出当前团队加入的所有群
- [ ] 只有群 Owner 可修改/解散群

---

## Technical Notes

**新建文件:** `packages/server/src/api/groups.ts`

**创建群流程:**
1. 插入 groups 表（contract_yaml = 默认模板）
2. 插入 group_members（team_id=当前团队, role=owner）
3. 返回群详情

**解散群流程:**
1. 查询 group_tasks 中该群的 pending/claimed 任务
2. 将这些任务 status 重置为 pending, is_group_task=0
3. 删除 group_members
4. 删除 groups

---

## Dependencies

- STORY-G005（groups 表）
- STORY-G002（teams API，用于获取当前团队）

---

## Implementation Order

1. 创建 groups.ts
2. 实现 POST /api/groups
3. 实现 GET /api/groups/:id
4. 实现 PATCH /api/groups/:id
5. 实现 DELETE /api/groups/:id
6. 实现 GET /api/groups
7. 注册路由
8. 测试所有端点
