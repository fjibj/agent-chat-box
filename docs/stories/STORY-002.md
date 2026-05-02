# STORY-002: 数据库 Schema 初始化

**Epic:** EPIC-001 基础设施
**Sprint:** 1
**Points:** 3
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a developer, I want the SQLite database schema, so that the server can persist all data.

---

## Acceptance Criteria

- [ ] better-sqlite3 集成到 server 包
- [ ] 所有表创建：machines, agents, channels, channel_members, messages, tasks
- [ ] 索引创建（8个索引）
- [ ] FTS5 虚拟表 messages_fts
- [ ] WAL 模式启用
- [ ] 迁移机制（版本号管理）
- [ ] db/index.ts 导出 Database 实例

---

## Technical Notes

**Schema 参考 architecture-agent-chat-box 数据库设计部分**

**db/index.ts:**
```typescript
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = process.env.DATA_DIR || './data';
const DB_PATH = path.join(DATA_DIR, 'chatbox.sqlite');

export function createDatabase(): Database.Database {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

function migrate(db: Database.Database) {
  // 版本号检查和迁移
  const version = db.pragma('user_version', { simple: true });
  if (version === 0) {
    db.exec(SCHEMA_SQL);
    db.pragma('user_version = 1');
  }
}
```

---

## Dependencies

- STORY-001

---

## Implementation Order

1. 安装 better-sqlite3
2. 创建 db/schema.sql
3. 创建 db/index.ts
4. 实现迁移机制
5. 测试数据库创建和表结构
