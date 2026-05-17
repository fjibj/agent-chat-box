# STORY-F005: Runner 客户端（反向连接、poll、消息接收）

**Epic:** EPIC-F01 联邦协议与基础设施
**Sprint:** 1
**Points:** 5
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a 成员团队, I want to 我的 Server 作为 Runner 反向连接到群 Hub, So that 不需要公网 IP 就能接收群任务。

---

## Acceptance Criteria

- [ ] 新增 `FederationRunner` 类，负责反向连接 Hub
- [ ] Runner 启动时读取配置：`federation_url` + `invite_code`
- [ ] Runner 自动重连：断线后 5 秒重试，指数退避最多 60 秒
- [ ] Runner 定期发送心跳（每 30 秒）
- [ ] Runner 定期 poll `/api/federation/poll`（每 5~10 秒）获取可 claim 的任务列表
- [ ] Runner 接收 Hub 的 WSS 消息并分发到本地处理（task.broadcast、agent.wake 等）
- [ ] Runner 将本地群任务发布请求转发到 Hub

---

## Technical Notes

**修改文件:**
- `packages/server/src/federation/runner.ts` — 新增 Runner 客户端
- `packages/server/src/index.ts` — 启动时初始化 Runner（如果配置了 federation_url）

**Runner 核心类:**
```typescript
class FederationRunner {
  private ws: WebSocket | null;
  private config: { hubUrl: string; inviteCode: string; teamId: string };
  connect(): Promise<void>;
  private onMessage(msg: FederationMessage): void;
  private startHeartbeat(): void;
  private startPolling(): void;
  private pollTasks(): Promise<FederationTask[]>;
  publishTask(task: GroupTask): Promise<void>;
  claimTask(taskId: string, agentId: string): Promise<void>;
}
```

**配置来源:**
- 环境变量：`FEDERATION_URL`, `FEDERATION_INVITE_CODE`
- 或数据库 `groups` 表中的 `federation_url` 字段（扩展）

**复用:** 现有 `connection.ts` 的重连逻辑可作为参考。

---

## Dependencies

- STORY-F001（协议定义）
- STORY-F004（Hub 端点，需双方联调）

---

## Implementation Order

1. 实现 FederationRunner 类（runner.ts）
2. 在 index.ts 启动流程中条件初始化 Runner
3. 实现自动重连 + 心跳
4. 实现 poll 循环
5. 与 Hub 联调：注册 → 心跳 → 消息收发
