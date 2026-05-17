# STORY-F002: 数据库迁移 — federation_peers、labels 字段

**Epic:** EPIC-F01 联邦协议与基础设施
**Sprint:** 1
**Points:** 2
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a 系统, I want to 在数据库中添加联邦相关的表和字段, So that Hub 和 Runner 有数据持久化基础。

---

## Acceptance Criteria

- [ ] 新增 `federation_peers` 表（见 PRD 数据模型）
- [ ] 新增 `federation_task_index` 表（见 PRD 数据模型）
- [ ] `agents` 表新增 `labels TEXT` 字段（JSON 数组，默认 `[]`）
- [ ] 迁移脚本 v8→v9 自动执行
- [ ] 现有数据不受影响，新字段默认值为空
- [ ] 迁移后 `pnpm dev` 启动正常

---

## Technical Notes

**修改文件:**
- `packages/server/src/db/schema.sql` — 新增表和字段定义
- `packages/server/src/db/index.ts` — migrate() 添加 v8→v9 迁移逻辑

**迁移逻辑:**
```typescript
// v8 → v9: 添加联邦网关表和 agent labels
if (version <= 8) {
  db.exec(`CREATE TABLE IF NOT EXISTS federation_peers (...)`);
  db.exec(`CREATE TABLE IF NOT EXISTS federation_task_index (...)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_federation_peers_group ON federation_peers(group_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_federation_task_index_group ON federation_task_index(group_id, status)`);
  db.exec(`ALTER TABLE agents ADD COLUMN labels TEXT DEFAULT '[]'`);
  db.run('PRAGMA user_version = 9');
  version = 9;
}
```

**SQLite 限制:** ALTER TABLE ADD COLUMN 不支持 REFERENCES，外键约束在应用层保证。

---

## Dependencies

无（schema 迁移独立）

---

## Implementation Order

1. 修改 schema.sql 添加 federation_peers、federation_task_index 定义
2. 修改 index.ts migrate() 添加 v8→v9 迁移
3. 测试：启动 server，验证迁移成功
4. 测试：验证现有数据不受影响
