# STORY-033: Agent 管理面板

**Epic:** EPIC-006 Web 管理界面
**Sprint:** 5
**Points:** 8
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a user, I want an agent management panel, so that I can see and manage all machines and agents.

---

## Acceptance Criteria

- [ ] 机器列表：名称、IP、状态、运行时
- [ ] Agent 列表：名称、状态、当前任务
- [ ] 创建 Agent 表单
- [ ] 编辑 Agent
- [ ] 删除 Agent
- [ ] 复制 Daemon 连接命令

---

## Technical Notes

**布局:**
```
┌─────────────────────────────────────────────────────────┐
│ [+ 注册机器]                                             │
├─────────────────────────────────────────────────────────┤
│ 🖥 家用电脑 (192.168.1.100)                              │
│    状态: 🟢 在线 | 运行时: claude ✅ codex ✅            │
│    Agent: Claude-1 (运行中), Hermes-1 (空闲)             │
│    [添加Agent] [断开]                                    │
├─────────────────────────────────────────────────────────┤
│ 🖥 公司电脑 (10.0.0.50)                                  │
│    状态: 🟢 在线 | 运行时: codex ✅ openclaw ✅          │
│    Agent: Codex-1 (运行中)                               │
│    [添加Agent] [断开]                                    │
└─────────────────────────────────────────────────────────┘

Daemon 连接命令:
┌─────────────────────────────────────────────────────────┐
│ npx agent-chat-box-daemon --server-url ws://... --api-key sk_xxx [复制] │
└─────────────────────────────────────────────────────────┘
```

---

## Dependencies

- STORY-030, STORY-008

---

## Implementation Order

1. 实现机器列表
2. 实现 Agent 列表
3. 实现创建 Agent 表单
4. 实现编辑/删除
5. 实现连接命令复制
