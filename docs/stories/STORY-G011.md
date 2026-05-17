# STORY-G011: 群任务发布 API

**Epic:** EPIC-003 两级任务池与授权
**Sprint:** 2
**Points:** 3
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a 团队 Owner, I want to 将任务发布到群任务池, So that 其他团队的 Agent 可以帮忙执行。

---

## Acceptance Criteria

- [ ] `POST /api/groups/:gid/tasks` — 发布群任务
- [ ] 任务创建时设置 `is_group_task=1`, `source_team_id=当前团队`
- [ ] 创建 `group_tasks` 记录（authorization_status='none'）
- [ ] 任务 required_capabilities 必须在群契约 shared_capabilities 白名单内（空表 = 允许所有）
- [ ] 发布成功后 WebSocket 广播 `group.task.created` 到群内所有成员
- [ ] 广播包含：task 详情、group_id、source_team_name

---

## Technical Notes

**修改文件:**
- `packages/server/src/api/groups.ts` — 添加群任务端点
- `packages/server/src/modules/task-queue.ts` — 扩展 createTask 支持 group 字段

**复用:** 现有 createTask 函数，扩展 is_group_task 和 source_team_id 参数。

**WebSocket 广播:** 调用新增的 broadcastToGroup(groupId, type, data) 函数。

---

## Dependencies

- STORY-G007（群契约，用于验证 shared_capabilities）
- STORY-G010（group_tasks 表）

---

## Implementation Order

1. 实现 broadcastToGroup() 函数（ws/handler.ts）
2. 在 groups.ts 添加 POST /api/groups/:gid/tasks
3. 扩展 createTask 支持 group 参数
4. 测试：发布群任务、验证广播
