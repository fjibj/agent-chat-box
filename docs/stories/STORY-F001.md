# STORY-F001: 联邦消息协议定义（slock 信封格式）

**Epic:** EPIC-F01 联邦协议与基础设施
**Sprint:** 1
**Points:** 3
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a 开发者, I want to 定义统一的联邦消息协议格式, So that Hub、Runner、前后端、Daemon 共享同一解析器。

---

## Acceptance Criteria

- [ ] 定义 `FederationMessage` TypeScript 接口：`{ v, id, type, ts, from, to?, data }`
- [ ] 所有联邦消息类型以 `federation.` 为前缀
- [ ] 定义核心消息类型枚举：`register`, `heartbeat`, `member.joined`, `member.left`, `task.broadcast`, `task.claim`, `agent.wake`
- [ ] 消息 ID 使用 `fed_` 前缀 + nanoid，确保全局唯一
- [ ] 协议版本 `v=1`，预留扩展字段以便向后兼容
- [ ] 编写协议文档注释（JSDoc），供前后端复用

---

## Technical Notes

**修改文件:**
- `packages/server/src/federation/protocol.ts` — 新增协议定义文件

**接口定义:**
```typescript
export interface FederationMessage {
  v: number;           // protocol version, default 1
  id: string;          // unique message id, prefix: fed_
  type: string;        // federation.{register|heartbeat|member.joined|...}
  ts: number;          // unix timestamp (ms)
  from: string;        // source team_id
  to?: string;         // optional target team_id (point-to-point)
  data: unknown;       // payload, type-specific
}

export type FederationMessageType =
  | 'federation.register'
  | 'federation.heartbeat'
  | 'federation.member.joined'
  | 'federation.member.left'
  | 'federation.task.broadcast'
  | 'federation.task.claim'
  | 'federation.agent.wake'
  | 'federation.member.leave';
```

**复用:** 现有 `WSMessage` 接口格式（`packages/shared/src/types.ts`）作为参考，联邦协议是其超集。

---

## Dependencies

无

---

## Implementation Order

1. 新建 `packages/server/src/federation/` 目录
2. 创建 `protocol.ts`，定义接口和类型
3. 导出所有类型供 Hub、Runner、WS Handler 使用
4. 编写单元测试：验证消息序列化/反序列化
