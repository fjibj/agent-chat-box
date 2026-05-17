# STORY-G001: 数据库迁移 — 团队表与 team_id 列

**Epic:** EPIC-001 团队抽象
**Sprint:** 1
**Points:** 3
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a 系统, I want to 在数据库中添加 teams 表和现有表的 team_id 列, So that 团队模型有数据基础。

---

## Acceptance Criteria

- [ ] 新增 `teams` 表（id TEXT PK, name TEXT, owner_user_id TEXT, created_at INTEGER）
- [ ] 新增 `team_members` 表（team_id TEXT, user_id TEXT, role TEXT, joined_at INTEGER, PK(team_id, user_id)）
- [ ] `machines` 表添加 `team_id TEXT REFERENCES teams(id)` 列
- [ ] `agents` 表添加 `team_id TEXT REFERENCES teams(id)` 列
- [ ] 迁移脚本 v4→v5 自动执行
- [ ] 现有数据自动创建默认团队 "Default Team" 并将所有 machine/agent 关联
- [ ] 迁移后 `pnpm dev` 启动正常，现有功能不受影响

---

## Technical Notes

**修改文件:**
- `packages/server/src/db/schema.sql` — 新增表定义
- `packages/server/src/db/index.ts` — migrate() 添加 v4→v5 迁移逻辑

**迁移逻辑:**
```typescript
// v4 → v5: 添加团队模型
if (version <= 4) {
  // 创建 teams 表
  db.exec(`CREATE TABLE IF NOT EXISTS teams (...)`);
  // 创建 team_members 表
  db.exec(`CREATE TABLE IF NOT EXISTS team_members (...)`);
  // 创建默认团队
  db.run(`INSERT INTO teams (id, name, owner_user_id) VALUES (?, ?, ?)`, [defaultTeamId, 'Default Team', 'system']);
  // 现有 machines/agents 关联到默认团队
  db.run(`ALTER TABLE machines ADD COLUMN team_id TEXT REFERENCES teams(id)`);
  db.run(`ALTER TABLE agents ADD COLUMN team_id TEXT REFERENCES teams(id)`);
  db.run(`UPDATE machines SET team_id = ?`, [defaultTeamId]);
  db.run(`UPDATE agents SET team_id = ?`, [defaultTeamId]);
  db.run('PRAGMA user_version = 5');
}
```

**SQLite ALTER TABLE 限制:** SQLite 不支持 ADD COLUMN ... REFERENCES（外键约束）。team_id 列只添加 TEXT，外键在应用层保证。

---

## Dependencies

无

---

## Implementation Order

1. 修改 schema.sql 添加 teams 和 team_members 表定义
2. 修改 index.ts migrate() 添加 v4→v5 迁移
3. 测试：启动 server，验证迁移成功
4. 测试：验证现有数据（machines/agents）自动关联默认团队
5. 测试：验证现有功能不受影响
