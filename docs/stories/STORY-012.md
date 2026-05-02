# STORY-012: @mention 触发

**Epic:** EPIC-003 聊天系统
**Sprint:** 2
**Points:** 5
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a user, I want to @mention agents to wake them up, so that I can get their attention.

---

## Acceptance Criteria

- [ ] 消息中 @name 解析为 mention
- [ ] 被 @mention 的 Agent 收到消息
- [ ] 如果 Agent 在 SLEEPING，触发 agent.wake
- [ ] agent.wake 携带最近 10 条消息作为上下文
- [ ] Agent 收到 wake 后转为 AWAKE

---

## Technical Notes

**modules/msg-router.ts:**
```typescript
export class MsgRouter {
  checkMentions(message: Message): string[] {
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(message.content)) !== null) {
      mentions.push(match[1]);
    }
    return mentions;
  }

  async wakeAgent(agentId: string, trigger: WakeTrigger, context: Context) {
    const agent = getAgent(agentId);
    if (agent.status !== 'idle') return;

    // 获取最近消息
    const recentMessages = getRecentMessages(context.channelId, 10);

    // 发送 wake
    sendToAgent(agentId, {
      type: 'agent.wake',
      data: { trigger, context: { ...context, recent_messages: recentMessages } }
    });

    // 更新状态
    updateAgentStatus(agentId, 'idle'); // AWAKE
  }
}
```

---

## Dependencies

- STORY-011, STORY-016

---

## Implementation Order

1. 实现 @mention 解析
2. 实现 agent.wake 推送
3. 实现上下文打包
4. 测试 @mention 触发
