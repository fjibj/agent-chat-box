# STORY-F010: E2E：跨团队任务发布 → claim → 完成全流程

**Epic:** EPIC-F02 跨团队任务路由与 E2E
**Sprint:** 2
**Points:** 5
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a 测试工程师, I want to 有一个完整的 E2E 测试覆盖跨团队任务全流程, So that 联邦网关发布前可验证核心链路。

---

## Acceptance Criteria

- [ ] E2E 测试启动 2 个 Server 实例：Hub Server（团队A）+ Runner Server（团队B）
- [ ] 测试覆盖完整流程：
  1. 团队A 创建群并生成邀请码
  2. 团队B 的 Runner 使用邀请码反向连接到 Hub
  3. 团队A 发布群任务（带 required_labels）
  4. 团队B 的 Runner poll 到任务
  5. 团队B 的 Agent claim 任务
  6. 团队A 授权批准
  7. 团队B 的 Agent 被唤醒并执行
  8. 任务完成，结果回流到团队A
- [ ] 测试验证 Hub 故障时团队B 内部功能不受影响
- [ ] 测试使用 Vitest + 内存 SQLite，不依赖真实 tailscale

---

## Technical Notes

**修改文件:**
- `e2e/federation.spec.ts` — 新增联邦网关 E2E 测试

**测试架构:**
```typescript
// 模拟双节点
test('Federation full flow', async () => {
  // 1. 启动 Hub Server（端口 3001）
  const hubApp = await startServer({ port: 3001, mode: 'hub' });
  // 2. 启动 Runner Server（端口 3002）
  const runnerApp = await startServer({ port: 3002, mode: 'runner', hubUrl: 'ws://localhost:3001/federation' });
  // 3. 执行完整流程...
});
```

**复用:** 现有 `e2e/core-flows.spec.ts` 的 API helper 模式。

---

## Dependencies

- STORY-F001 ~ STORY-F009（全部前置故事）

---

## Implementation Order

1. 搭建双 Server E2E 测试环境
2. 实现完整流程测试用例
3. 实现 Hub 故障容错验证
4. 确保测试在 CI 中可稳定运行
