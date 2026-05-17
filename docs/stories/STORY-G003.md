# STORY-G003: Agent 归属管理

**Epic:** EPIC-001 团队抽象
**Sprint:** 1
**Points:** 3
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a 团队 Owner, I want to 将 Agent 加入或移出我的团队, So that 我可以组织我的 Agent。

---

## Acceptance Criteria

- [ ] `POST /api/teams/:id/agents/:aid` — 将 Agent 加入团队
- [ ] `DELETE /api/teams/:id/agents/:aid` — 将 Agent 移出团队
- [ ] `GET /api/teams/:id/agents` — 列出团队 Agent
- [ ] Agent 加入新团队时自动从旧团队移除（更新 agents.team_id）
- [ ] Daemon 注册时自动归属 Owner 的团队（通过 API Key 关联 machine.team_id）
- [ ] WebSocket hello 处理中自动设置 agent.team_id

---

## Technical Notes

**修改文件:**
- `packages/server/src/api/agents.ts` — 注册时设置 team_id
- `packages/server/src/api/teams.ts` — 添加 Agent 归属端点
- `packages/server/src/ws/handler.ts` — hello 时关联 team

**Daemon 注册流程:**
1. Daemon 用 API Key 认证
2. Server 查找 machine → machine.team_id
3. 注册 Agent 时自动设置 agent.team_id = machine.team_id

---

## Dependencies

- STORY-G001（agents.team_id 列）
- STORY-G002（teams API）

---

## Implementation Order

1. 修改 agents.ts 注册时设置 team_id
2. 修改 ws/handler.ts hello 时关联 team
3. 在 teams.ts 添加 Agent 归属端点
4. 测试：Daemon 注册后 Agent 自动归属团队
5. 测试：手动移动 Agent 到其他团队
