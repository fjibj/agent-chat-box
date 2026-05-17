# STORY-G005: 数据库迁移 — 群表

**Epic:** EPIC-002 群契约与成员管理
**Sprint:** 1
**Points:** 3
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a 系统, I want to 在数据库中添加 groups 和 group_members 表, So that 群功能有数据基础。

---

## Acceptance Criteria

- [ ] 新增 `groups` 表（id TEXT PK, name TEXT, description TEXT, contract_yaml TEXT, owner_team_id TEXT, invite_code TEXT UNIQUE, invite_code_expires_at INTEGER, invite_code_max_uses INTEGER, invite_code_uses INTEGER DEFAULT 0, created_at INTEGER）
- [ ] 新增 `group_members` 表（group_id TEXT, team_id TEXT, role TEXT DEFAULT 'member', joined_at INTEGER, PK(group_id, team_id)）
- [ ] 索引：idx_group_members_group(group_id), idx_group_members_team(team_id)
- [ ] 迁移脚本 v5→v6
- [ ] 迁移后启动正常

---

## Technical Notes

**修改文件:**
- `packages/server/src/db/schema.sql`
- `packages/server/src/db/index.ts`

**contract_yaml 默认模板:**
```yaml
shared_capabilities: []
resource_quota:
  max_tasks_per_hour: 10
  max_retry_per_task: 3
authorization: manual
trust_threshold: 0.6
visibility:
  task_input: true
  task_output: true
  internal_log: false
```

---

## Dependencies

- STORY-G001

---

## Implementation Order

1. 修改 schema.sql 添加 groups 和 group_members 表
2. 修改 migrate() 添加 v5→v6
3. 测试迁移
