# STORY-G012: 群任务广播（WebSocket）

**Epic:** EPIC-003 两级任务池与授权
**Sprint:** 2
**Points:** 5
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a 群内 Agent, I want to 实时收到群任务池的新任务通知, So that 我可以及时 claim。

---

## Acceptance Criteria

- [ ] WebSocket 消息类型 `group.task.created` 推送到群内所有成员的所有连接
- [ ] 消息包含：task 完整详情、group_id、source_team_id、source_team_name
- [ ] 群成员加入/退出时更新内存中的 group → team 映射
- [ ] 客户端断连时清理 team → client 映射
- [ ] 广播延迟 < 5 秒（50 团队规模）
- [ ] 不属于该群的连接不会收到广播

---

## Technical Notes

**内存映射（ws/handler.ts）:**
```typescript
// group → teams
const groupTeams = new Map<string, Set<string>>();
// team → clients
const teamClients = new Map<string, Set<string>>();

function broadcastToGroup(groupId: string, type: string, data: unknown): void {
  const teams = groupTeams.get(groupId);
  if (!teams) return;
  for (const teamId of teams) {
    const clientIds = teamClients.get(teamId);
    if (!clientIds) continue;
    for (const clientId of clientIds) {
      sendTo(clientId, { v: 1, type, ts: Date.now(), data });
    }
  }
}
```

**映射维护:**
- Daemon 认证时：查找 machine.team_id → 加入 teamClients
- 群成员变更时：更新 groupTeams
- 客户端断连时：从 teamClients 移除

---

## Dependencies

- STORY-G011（群任务发布）

---

## Implementation Order

1. 在 ws/handler.ts 实现 groupTeams 和 teamClients 映射
2. 实现 broadcastToGroup() 函数
3. Daemon 认证时维护 teamClients 映射
4. 群成员变更时维护 groupTeams 映射
5. 客户端断连时清理
6. 测试：50 团队群广播延迟
