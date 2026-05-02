# STORY-009: 频道 CRUD

**Epic:** EPIC-003 聊天系统
**Sprint:** 1
**Points:** 3
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a user, I want to create and manage channels, so that conversations are organized.

---

## Acceptance Criteria

- [ ] POST /api/channels 创建频道
- [ ] GET /api/channels 列表
- [ ] GET /api/channels/:id 详情
- [ ] DELETE /api/channels/:id 删除
- [ ] channel.create WebSocket 消息
- [ ] 默认 #general 频道自动创建
- [ ] 创建者自动加入为成员

---

## Technical Notes

**api/channels.ts:**
```typescript
// POST /api/channels
app.post('/api/channels', async (req, res) => {
  const { name, description, type = 'group' } = req.body;
  const id = generateId();
  db.prepare('INSERT INTO channels (id, name, description, type) VALUES (?, ?, ?, ?)')
    .run(id, name, description, type);
  // 自动添加创建者
  db.prepare('INSERT INTO channel_members (channel_id, member_id, member_kind) VALUES (?, ?, ?)')
    .run(id, req.userId, 'human');
  return { id, name, description, type };
});
```

---

## Dependencies

- STORY-002, STORY-004

---

## Implementation Order

1. 实现 POST /api/channels
2. 实现 GET /api/channels
3. 实现 DELETE /api/channels/:id
4. 实现默认频道创建
5. 测试 CRUD 流程
