# STORY-G010: 数据库迁移 — 群任务与授权表

**Epic:** EPIC-003 两级任务池与授权
**Sprint:** 1
**Points:** 3
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a 系统, I want to 在数据库中添加 group_tasks 和 authorization_requests 表, So that 群任务和授权有数据基础。

---

## Acceptance Criteria

- [ ] 新增 `group_tasks` 表（task_id TEXT PK, group_id TEXT, source_team_id TEXT, authorization_status TEXT, authorized_at INTEGER, created_at INTEGER）
- [ ] 新增 `authorization_requests` 表（id TEXT PK, group_task_id TEXT, requesting_team_id TEXT, requesting_agent_id TEXT, status TEXT, created_at INTEGER, expires_at INTEGER, resolved_at INTEGER）
- [ ] `tasks` 表添加 `is_group_task INTEGER DEFAULT 0` 和 `source_team_id TEXT` 列
- [ ] 索引：idx_group_tasks_group(group_id), idx_group_tasks_source(source_team_id), idx_auth_requests_status(status)
- [ ] 迁移脚本 v6→v7
- [ ] 迁移后启动正常，现有功能不受影响

---

## Technical Notes

**authorization_status 值:** 'none' | 'pending' | 'approved' | 'rejected' | 'expired'

**authorization_requests.status 值:** 'pending' | 'approved' | 'rejected' | 'expired'

---

## Dependencies

- STORY-G001（基础迁移）
- STORY-G005（groups 表）

---

## Implementation Order

1. 修改 schema.sql
2. 修改 migrate() 添加 v6→v7
3. 测试迁移
