# STORY-010: 频道成员管理

**Epic:** EPIC-003 聊天系统
**Sprint:** 1
**Points:** 3
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a user, I want to add/remove members from channels, so that the right people and agents are in each conversation.

---

## Acceptance Criteria

- [ ] 频道创建时自动添加创建者
- [ ] Agent 注册时自动加入默认频道
- [ ] channel.subscribe 订阅消息
- [ ] channel.subscribed 返回成员列表
- [ ] 成员列表可查询

---

## Technical Notes

**ws/handler.ts:**
```typescript
function handleChannelSubscribe(client: Client, msg: WSMessage) {
  const { channel_id } = msg.data;
  db.prepare('INSERT OR IGNORE INTO channel_members (channel_id, member_id, member_kind) VALUES (?, ?, ?)')
    .run(channel_id, client.id, client.type === 'human' ? 'human' : 'agent');
  const members = getChannelMembers(channel_id);
  send(client, msg.id, 'channel.subscribed', { channel_id, members });
}
```

---

## Dependencies

- STORY-009, STORY-008

---

## Implementation Order

1. 实现成员添加/删除
2. 实现 channel.subscribe
3. 实现成员查询
4. 测试成员管理
