# STORY-008: Agent 注册与身份管理

**Epic:** EPIC-002 Agent 生命周期
**Sprint:** 2
**Points:** 5
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a user, I want to create agents with names and identities, so that they appear as team members.

---

## Acceptance Criteria

- [ ] POST /api/agents 创建 Agent
- [ ] Agent 属性：name, runtime, description, capabilities
- [ ] agent.hello 消息注册，携带 role_card
- [ ] agent.welcome 返回订阅列表和上下文
- [ ] GET /api/agents 列表
- [ ] PATCH /api/agents/:id 更新
- [ ] DELETE /api/agents/:id 删除
- [ ] Agent 断线重连后自动重新注册

---

## Technical Notes

**api/agents.ts:**
```typescript
// POST /api/agents
app.post('/api/agents', async (req, res) => {
  const { machineId, name, runtime, description, capabilities } = req.body;
  const id = generateId();
  db.prepare(`
    INSERT INTO agents (id, machine_id, name, runtime, capabilities, role_card)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, machineId, name, runtime, JSON.stringify(capabilities),
    JSON.stringify({ name, description }));
  return { id, name, runtime };
});
```

**ws/daemon-handler.ts:**
```typescript
function handleAgentHello(client: Client, msg: WSMessage) {
  const { agent_id, role_card, runtime, capabilities } = msg.data;
  // 注册 Agent
  const agent = registerAgent(client.machineId, agent_id, role_card, runtime, capabilities);
  // 加入默认频道
  joinDefaultChannels(agent_id);
  // 返回上下文
  const contextWindow = getRecentMessages(DEFAULT_CHANNEL_ID, 20);
  send(client, msg.id, 'agent.welcome', {
    agent,
    subscriptions: getSubscriptions(agent_id),
    context_window: contextWindow,
  });
}
```

---

## Dependencies

- STORY-005, STORY-007

---

## Implementation Order

1. 实现 POST /api/agents
2. 实现 agent.hello 处理
3. 实现 agent.welcome 响应
4. 实现 Agent CRUD API
5. 测试注册流程
