# STORY-F009: 出入群联邦消息广播（member.joined / member.left）

**Epic:** EPIC-F02 跨团队任务路由与 E2E
**Sprint:** 2
**Points:** 3
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a 群成员, I want to 实时知道有哪些团队加入了或退出了群, So that 了解当前群的可协作资源。

---

## Acceptance Criteria

- [ ] 新团队通过 Runner 注册成功后，Hub 广播 `federation.member.joined` 给所有在线成员
- [ ] 团队断开连接或显式 leave 后，Hub 广播 `federation.member.left`
- [ ] 广播消息包含 `team_id` 和 `team_name`
- [ ] 成员团队的本地群成员列表（UI/API）实时更新
- [ ] 退群后，该团队已 claim 但未完成的任务自动回池（状态重置为 pending）

---

## Technical Notes

**修改文件:**
- `packages/server/src/federation/hub.ts` — 广播逻辑
- `packages/server/src/federation/runner.ts` — 接收广播并更新本地状态
- `packages/server/src/api/groups.ts` — 群成员 API 同步联邦成员状态

**退群回池逻辑:**
```typescript
// hub.ts on disconnect/leave
function handleMemberLeave(teamId: string) {
  // 1. 广播 member.left
  broadcast('federation.member.left', { team_id: teamId });
  // 2. 重置该团队已 claim 但未完成的任务
  db.run(`UPDATE federation_task_index SET status='open', claimed_by_team_id=NULL WHERE claimed_by_team_id=? AND status='claimed'`, [teamId]);
  // 3. 移除 federation_peers 记录
  db.run(`DELETE FROM federation_peers WHERE team_id=?`, [teamId]);
}
```

**复用:** 现有 `groups.ts` 的 leave 机制逻辑，扩展到联邦层。

---

## Dependencies

- STORY-F004（Hub 广播能力）
- STORY-F005（Runner 消息接收）

---

## Implementation Order

1. Hub 实现 member.joined / member.left 广播
2. Runner 接收广播并更新本地缓存
3. 实现退群回池逻辑
4. 测试：A 加入 → B 收到 joined → A 离开 → B 收到 left + 任务回池
