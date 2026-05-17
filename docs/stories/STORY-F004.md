# STORY-F004: 群 Hub Server 端点（注册、心跳、消息路由）

**Epic:** EPIC-F01 联邦协议与基础设施
**Sprint:** 1
**Points:** 5
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a 群主团队, I want to 部署一个联邦 Hub 来接收成员团队的反向连接, So that 成员不需要公网 IP 就能加入群。

---

## Acceptance Criteria

- [ ] 新增 WSS 端点 `/federation`，接收 Runner 连接
- [ ] 握手阶段解析 `federation.register` 消息，验证 invite_code
- [ ] 验证通过后将会话关联到 `federation_peers` 表记录
- [ ] 实现心跳检测：Runner 每 30 秒发送 heartbeat，Hub 超时 120 秒未收到则标记 disconnected
- [ ] Hub 支持向指定 team 发送点对点消息（`to` 字段）
- [ ] Hub 支持广播消息到所有在线成员（member.joined / member.left）
- [ ] Hub 记录连接日志（connected_at, disconnected_at）

---

## Technical Notes

**修改文件:**
- `packages/server/src/federation/hub.ts` — 新增 Hub 核心逻辑
- `packages/server/src/ws/handler.ts` — 注册 `/federation` WSS 路由

**Hub 核心类:**
```typescript
class FederationHub {
  private peers: Map<string, WebSocket>; // team_id -> ws
  register(ws: WebSocket, msg: FederationRegisterMessage): boolean;
  heartbeat(team_id: string): void;
  broadcast(type: string, data: unknown, excludeTeam?: string): void;
  sendTo(team_id: string, msg: FederationMessage): boolean;
  disconnect(team_id: string, reason: string): void;
}
```

**复用:** 现有 `ws/handler.ts` 的 WebSocket 升级逻辑；复用 `groups.ts` 的 invite_code 验证逻辑。

---

## Dependencies

- STORY-F001（协议定义）
- STORY-F002（federation_peers 表）
- STORY-G008（邀请码机制，复用验证逻辑）

---

## Implementation Order

1. 实现 FederationHub 类（hub.ts）
2. 在 ws/handler.ts 注册 `/federation` 路由
3. 实现 register 握手流程（验证 invite_code → 写入 peers → 广播 joined）
4. 实现心跳检测与超时断开
5. 测试：2 个 Server 实例模拟 Hub + Runner 注册流程
