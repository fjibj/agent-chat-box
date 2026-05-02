# STORY-013: 历史消息加载

**Epic:** EPIC-003 聊天系统
**Sprint:** 2
**Points:** 3
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a user, I want to load message history, so that I can see past conversations.

---

## Acceptance Criteria

- [ ] GET /api/channels/:id/messages 分页查询
- [ ] 支持 before/after 游标
- [ ] 默认返回最新 50 条
- [ ] 消息按时间排序
- [ ] 包含发送者信息

---

## Technical Notes

**api/messages.ts:**
```typescript
// GET /api/channels/:id/messages
app.get('/api/channels/:id/messages', async (req, res) => {
  const { id } = req.params;
  const { limit = 50, before, after } = req.query;

  let sql = 'SELECT * FROM messages WHERE channel_id = ?';
  const params: any[] = [id];

  if (before) { sql += ' AND created_at < ?'; params.push(before); }
  if (after) { sql += ' AND created_at > ?'; params.push(after); }

  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  return db.prepare(sql).all(...params);
});
```

---

## Dependencies

- STORY-011

---

## Implementation Order

1. 实现分页查询
2. 实现游标参数
3. 测试历史加载
