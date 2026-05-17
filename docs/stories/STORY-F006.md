# STORY-F006: 标签匹配任务路由（required_labels ⊆ agent_labels）

**Epic:** EPIC-F02 跨团队任务路由与 E2E
**Sprint:** 2
**Points:** 3
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a 任务发布者, I want to 发布带标签要求的群任务，系统自动匹配符合条件的 Agent, So that 任务能被有相应能力的 Agent 执行。

---

## Acceptance Criteria

- [ ] 群任务发布 API 支持 `required_labels` 字段（字符串数组）
- [ ] Hub 或源团队 Server 在任务入队时存储 `required_labels`
- [ ] Poll 接口返回任务时，按请求团队的 Agent labels 过滤
- [ ] 匹配规则：`required_labels` 是 `agent_labels` 的子集（集合包含）
- [ ] 多个 Agent 满足条件时，poll 返回任务但不指定分配者（仍由 claim 竞争）
- [ ] 信誉分可作为排序权重（高信誉优先展示，但不改变匹配逻辑）

---

## Technical Notes

**修改文件:**
- `packages/server/src/api/group-tasks.ts` — 任务发布增加 required_labels
- `packages/server/src/federation/hub.ts` — poll 端点实现标签过滤
- `packages/server/src/federation/runner.ts` — poll 时携带本团队 Agent labels

**匹配算法:**
```typescript
function matchesLabels(required: string[], agentLabels: string[]): boolean {
  return required.every(r => agentLabels.includes(r));
}
```

**复用:** 现有 `group-tasks.ts` 的 `required_capabilities` 逻辑。可将 `required_labels` 视为 `required_capabilities` 的结构化替代，逐步迁移。

---

## Dependencies

- STORY-F003（Agent labels）
- STORY-F005（Runner poll）

---

## Implementation Order

1. 扩展 group-tasks.ts 支持 required_labels
2. 在 Hub poll 端点实现标签子集匹配
3. Runner poll 时聚合本团队所有 Agent 的 labels 一并发送
4. 测试：发布任务（required_labels=['python']），验证只有 labels 含 python 的 Agent 能 poll 到
