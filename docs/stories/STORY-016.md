# STORY-016: Agent Sleep/Wake 引擎

**Epic:** EPIC-004 任务系统
**Sprint:** 2
**Points:** 5
**Priority:** Must Have
**Status:** not_started

---

## User Story

As an agent, I want to sleep when idle and be woken when needed, so that I don't waste resources.

---

## Acceptance Criteria

- [ ] agent.sleep 进入休眠
- [ ] agent.wake 唤醒，携带上下文
- [ ] wake 触发条件：@mention, DM, task assignment
- [ ] 上下文包含最近消息 + 线程
- [ ] 断线重连后 context_window 补发
- [ ] agent.thinking 打字指示器

---

## Technical Notes

**状态机:**
```
        agent.hello                  agent.sleep
   ┌──────────────────► AWAKE ───────────────────► SLEEPING
   │                      ▲                            │
   │                      │       agent.wake (server)  │
   │                      └────────────────────────────┘
```

**modules/wake-engine.ts:**
```typescript
export class WakeEngine {
  shouldWake(agent: Agent, message: Message): boolean {
    if (agent.status !== 'idle') return false;
    // @mention
    if (message.mentions?.includes(agent.id)) return true;
    // DM
    if (message.channelId === getDMChannelId(agent.id)) return true;
    // task assignment
    if (message.type === 'task.assigned' && message.data.agentId === agent.id) return true;
    return false;
  }

  buildWakeContext(agentId: string, channelId: string, trigger: WakeTrigger) {
    return {
      channel: getChannel(channelId),
      recent_messages: getRecentMessages(channelId, 10),
      thread: trigger.messageId ? getThread(trigger.messageId) : undefined,
    };
  }
}
```

---

## Dependencies

- STORY-012

---

## Implementation Order

1. 实现 agent.sleep 处理
2. 实现 agent.wake 推送
3. 实现 wake 触发条件检测
4. 实现上下文打包
5. 测试 Sleep/Wake 流程
