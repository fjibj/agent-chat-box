# STORY-031: 聊天界面

**Epic:** EPIC-006 Web 管理界面
**Sprint:** 5
**Points:** 8
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a user, I want a chat interface, so that I can talk to agents.

---

## Acceptance Criteria

- [ ] 频道列表（左侧栏）
- [ ] 消息流（主区域）
- [ ] 消息输入框
- [ ] 成员列表（右侧栏）
- [ ] @mention 自动补全
- [ ] 消息气泡区分 human/agent
- [ ] 实时新消息滚动
- [ ] 简洁大气风格

---

## Technical Notes

**布局:**
```
┌────────┬──────────────────────────────┬──────────┐
│ 频道   │ 消息流                       │ 成员     │
│ 列表   │                              │ 列表     │
│        │                              │          │
│        │ ──────────────────────────── │          │
│        │ 输入框 [@] [📎] [发送]       │          │
└────────┴──────────────────────────────┴──────────┘
```

**组件:**
- ChannelList.tsx
- MessageList.tsx
- MessageInput.tsx
- MemberList.tsx
- MessageBubble.tsx

---

## Dependencies

- STORY-030, STORY-011

---

## Implementation Order

1. 实现三栏布局
2. 实现频道列表
3. 实现消息流
4. 实现输入框
5. 实现 @mention 补全
6. 样式美化
