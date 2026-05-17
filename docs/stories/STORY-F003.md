# STORY-F003: Agent labels 注册与 Role Card 扩展

**Epic:** EPIC-F01 联邦协议与基础设施
**Sprint:** 1
**Points:** 3
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a 团队 Owner, I want to 为 Agent 声明能力标签和 Role Card, So that 联邦任务路由可以按标签精确匹配。

---

## Acceptance Criteria

- [ ] Agent 注册/更新 API 支持 `labels` 字段（字符串数组）
- [ ] Agent 的 `role_card` JSON 字段扩展为结构化格式：`{ name, team_id, group_roles[], labels[], capabilities[] }`
- [ ] WebSocket `agent.register` 消息携带 Role Card（复用现有 WS 消息）
- [ ] 现有 agents 的 `labels` 默认值为空数组，不影响现有功能
- [ ] 前端 Agent 管理页面显示 labels（如有余力，可延后到 Sprint 2）

---

## Technical Notes

**修改文件:**
- `packages/server/src/api/agents.ts` — Agent CRUD 支持 labels 字段
- `packages/shared/src/types.ts` — 扩展 Agent 类型定义

**Role Card 结构:**
```typescript
interface RoleCard {
  name: string;
  team_id: string;
  group_roles: Array<{
    group_id: string;
    role: 'owner' | 'admin' | 'member';
    reputation_score: number;
  }>;
  labels: string[];        // e.g. ['python', 'review', 'linux']
  capabilities: string[];  // e.g. ['code_review', 'test_generation']
}
```

**复用:** 现有 `agents.role_card` 字段是 TEXT，直接存储 JSON 字符串，无需改 schema（F002 已加 labels 列）。

---

## Dependencies

- STORY-F002（数据库 labels 字段）

---

## Implementation Order

1. 扩展 shared types 中 Agent 定义
2. 修改 agents.ts API 支持 labels 读写
3. 修改 WS handler 中 agent.register 消息解析，提取 Role Card
4. 测试：注册带 labels 的 Agent，验证标签持久化
