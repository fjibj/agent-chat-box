# STORY-G028: Agents 页面补齐 labels 输入与展示

**Epic:** EPIC-006 群管理 UI Follow-up
**Sprint:** v0.2.0 Follow-up
**Points:** 3
**Priority:** Must Have
**Status:** ready

---

## User Story

As a 团队管理员, I want to 在 Agents 页面配置和查看 Agent labels, So that 联邦任务路由可以基于 `required_labels ⊆ agent_labels` 正确匹配。

---

## Acceptance Criteria

### Functional AC

- [ ] **AC-01:** `+ Add Agent` 模态框提供 labels 输入字段，支持逗号分隔或 tag input。
- [ ] **AC-02:** 创建 Agent 时，前端向 `POST /api/agents` 发送 `labels: string[]`。
- [ ] **AC-03:** Agent 卡片显示 labels badge 列表。
- [ ] **AC-04:** labels 为空时显示 `No labels` 或不显示 badge，但不报错。
- [ ] **AC-05:** 页面刷新后 labels 仍然正确显示。
- [ ] **AC-06:** labels 输入去重、trim，并过滤空字符串。
- [ ] **AC-07:** 后续联邦 poll 使用这些 labels 参与匹配。

### UI Entry Points

- [ ] **UI-01 Page:** `/agents`。
- [ ] **UI-02 Trigger:** `+ Add Agent` 模态框。
- [ ] **UI-03 Fields:** Machine、Name、Runtime、Labels。
- [ ] **UI-04 Empty state:** 无 labels 时行为明确。
- [ ] **UI-05 Error state:** 创建失败时在模态框展示错误。

### State Mapping

| State field | State value | Badge text | Badge color | Board/List grouping | Detail view | Test case |
|-------------|-------------|------------|-------------|---------------------|-------------|-----------|
| agent.labels | python | python | gray/blue | Agent card | ✅ | TC-G028-002 |
| agent.labels | review | review | gray/blue | Agent card | ✅ | TC-G028-002 |

### Testability

- [ ] **TEST-01:** `AgentsPage.test.tsx` 覆盖 labels 输入解析。
- [ ] **TEST-02:** `AgentsPage.test.tsx` 覆盖 Agent 卡片 labels badge 渲染。
- [ ] **TEST-03:** 集成测试覆盖 `POST /api/agents` labels 持久化。
- [ ] **TEST-04:** manual-verification M3.7~M3.15 通过。

---

## Technical Notes

**修改文件:**
- `packages/web/src/pages/AgentsPage.tsx`
- `packages/web/src/pages/AgentsPage.test.tsx`（新增）
- `packages/server/src/api/agents.ts`（确认 labels 入参已支持）

---

## Dependencies

- STORY-F003（Agent labels）
- STORY-F006（标签匹配任务路由）
- STORY-G023（群管理 UI）

---

## Traceability

- Related GAP: GAP-01
- Manual verification: M3.7~M3.15
- AC Coverage Matrix: Process / Quality Stories B-1, F006
