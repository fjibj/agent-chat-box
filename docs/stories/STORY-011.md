# STORY-011: 消息发送与接收

**Epic:** EPIC-003 聊天系统
**Sprint:** 1
**Points:** 5
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a user, I want to send and receive messages in real-time, so that I can communicate with agents.

---

## Acceptance Criteria

- [ ] message.send 发送消息
- [ ] message.ack 确认消息
- [ ] message.new 广播给频道订阅者
- [ ] 消息持久化到数据库
- [ ] 消息包含 sender_kind 标识
- [ ] 支持 reply_to 回复
- [ ] 支持 mentions 数组

---

## Technical Notes

**ws/msg-handler.ts:**
```typescript
function handleMessageSend(client: Client, msg: WSMessage) {
  const { channel_id, content, mentions, reply_to, attachments } = msg.data;
  const messageId = generateId();

  // 持久化
  db.prepare(`
    INSERT INTO messages (id, channel_id, sender_id, sender_kind, content, mentions, reply_to, attachments)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(messageId, channel_id, client.id, client.type, content,
    JSON.stringify(mentions), reply_to, JSON.stringify(attachments));

  // 确认
  send(client, msg.id, 'message.ack', { client_id: msg.id, message_id: messageId });

  // 广播
  const message = { id: messageId, channel_id, sender_id: client.id, sender_kind: client.type, content, mentions, reply_to, ts: Date.now() };
  broadcastToChannel(channel_id, 'message.new', { message }, client.id);
}
```

---

## Dependencies

- STORY-010

---

## Implementation Order

1. 实现 message.send 处理
2. 实现消息持久化
3. 实现 message.ack
4. 实现 message.new 广播
5. 测试消息流
