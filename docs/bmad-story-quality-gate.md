# BMAD Story Quality Gate

**项目:** Agent Chat Box  
**适用阶段:** BMAD Phase 2~4（PRD / Architecture / Sprint Planning / Create Story）  
**来源:** [process-retrospective-v0.2.0.md](./process-retrospective-v0.2.0.md)  
**目的:** 防止 v0.2.0 中出现的「后端 API 已实现，但 UI 入口、状态映射、测试映射缺失」问题在后续 Sprint 重复发生。

---

## 1. Gate 结论定义

| 结论 | 含义 | 是否允许进入 Dev |
|------|------|------------------|
| **PASS** | 故事 AC 完整，UI/API/状态/测试均有闭环 | ✅ |
| **CONDITIONAL PASS** | 有明确缺口，但已登记 follow-up story 且不阻塞当前 Sprint | ✅（需 PO/Architect 确认） |
| **FAIL** | 存在未覆盖的用户入口、状态枚举或测试映射，且未登记 follow-up | ❌ |

---

## 2. Story 必填结构

后续所有新增故事建议使用以下结构。已有故事如进入重构/补丁阶段，也应补齐这些小节。

```markdown
# STORY-XXX: <title>

**Epic:** <epic>
**Sprint:** <sprint>
**Points:** <points>
**Priority:** Must Have | Should Have | Could Have
**Status:** draft | ready | in_progress | done | deferred

## User Story

As a <role>, I want <feature>, so that <benefit>.

## Acceptance Criteria

### Functional AC
- [ ] AC-01: ...
- [ ] AC-02: ...

### UI Entry Points
- [ ] UI-01: 在 `<Page>` 页面提供 `<button/input/select>`，用户执行 `<action>` 时触发 `<API/event>`
- [ ] UI-02: 页面必须处理 loading / empty / error 状态

### State Mapping
- [ ] STATE-01: 新增/变更状态 `<state>` 在列表、卡片、详情页均有文案与颜色映射
- [ ] STATE-02: `<state>` 在看板/筛选/计数逻辑中归类明确

### Notifications / Realtime
- [ ] RT-01: 若状态变化需要实时反馈，必须定义 WebSocket/SSE/轮询策略

### Testability
- [ ] TEST-01: 每条 AC 在 AC Coverage Matrix 中至少有 1 个 Unit / Integration / E2E / Manual 验证项
- [ ] TEST-02: 展示型组件必须有「组件被页面使用」的集成测试

## Dependencies

- Depends on: STORY-...
- Blocks: STORY-...

## Implementation Notes

## Out of Scope

## Traceability

- Related GAP: GAP-XX
- Related manual verification: Mx-xx
- Related test cases: TC-...
```

---

## 3. Gate B-1：UI Entry Point 检查

凡是影响用户操作的能力，不能只写 API。必须明确：**用户在哪个页面，通过哪个控件触发什么行为**。

### 检查问题

- [ ] 这个故事是否需要用户在 Web UI 触发？
- [ ] 如果需要，是否写明页面名？
- [ ] 是否写明按钮 / 输入框 / 下拉 / 弹窗？
- [ ] 是否写明 loading / empty / error 状态？
- [ ] 如果本故事不做 UI，是否新建了 follow-up UI story？

### 反例

```markdown
- [ ] POST /api/groups/:id/leave — 退出群
```

问题：只有 API，没有 UI 入口。

### 正例

```markdown
- [ ] GroupsPage 群详情头部对非 owner 团队显示 "Leave Group" 按钮
- [ ] 点击 "Leave Group" 后显示确认弹窗
- [ ] 确认后调用 POST /api/groups/:id/leave，并从群列表移除该群
- [ ] 失败时在页面顶部显示错误提示
```

---

## 4. Gate B-2：能力闭环表

每个 Epic 在 Sprint Planning 结束前必须填写能力闭环表。任何一列为 ❌ 都必须：
1. 补当前故事 AC；或
2. 新建 follow-up story；或
3. 明确标为 Out of Scope 并由 PO/Architect 签字。

| 能力 | 后端 API | UI 入口 | 状态可视化 | 实时通知/刷新 | 测试映射 | 结论 |
|------|----------|---------|------------|---------------|----------|------|
| <能力1> | ✅/❌/N/A | ✅/❌/N/A | ✅/❌/N/A | ✅/❌/N/A | ✅/❌ | PASS/FAIL |
| <能力2> | | | | | | |

### v0.2.0 反例参考

| 能力 | 后端 API | UI 入口 | 状态可视化 | 实时通知/刷新 | 测试映射 | 结论 |
|------|----------|---------|------------|---------------|----------|------|
| Review 工作流 | ✅ | ❌ | ❌ | ⬜ TODO | 部分 | FAIL |
| 信誉分展示 | ✅ | ❌ | ❌ | N/A | 组件单测 only | FAIL |
| 群任务 pending_authorization | ✅ | N/A | ❌ | 轮询 | ❌ | FAIL |

---

## 5. Gate B-3：状态枚举映射

新增或修改任何状态枚举时，必须同步更新 UI 映射与测试。

### 必填表

| 状态字段 | 状态值 | Badge 文案 | Badge 颜色 | Board/List 归类 | Detail 展示 | 测试用例 |
|----------|--------|------------|------------|-----------------|-------------|----------|
| task.status | pending | Pending | yellow | Pending | ✅ | TC-... |
| task.status | pending_authorization | Pending Authorization | yellow/purple | Pending 或 Authorization | ✅ | TC-... |

### 检查问题

- [ ] 是否更新 Card 组件的 statusConfig？
- [ ] 是否更新 Board/List 分组逻辑？
- [ ] 是否更新详情页状态展示？
- [ ] 是否更新筛选器 / 计数器？
- [ ] 是否有状态枚举完整性测试？

---

## 6. Gate B-4：跨故事依赖

每个 story 必须列出依赖，特别是：
- UI story 依赖 API story
- 状态映射 story 依赖状态机 story
- Federation Runner story 依赖 Hub API story
- Review UI story 依赖 Review API story

### 检查问题

- [ ] 该故事依赖的数据表是否已存在？
- [ ] 该故事依赖的 API 是否已实现？
- [ ] 该故事引入的状态是否已在 UI 中映射？
- [ ] 如果前置条件未完成，是否标记 blocked？

---

## 7. Gate B-5：PRD / Architecture UI 完整性章节

PRD 和 Architecture 文档中必须包含 UI 完整性章节，至少覆盖：

| 页面 | 用户操作 | API/事件 | 状态 | 空态 | 错误态 | Story |
|------|----------|----------|------|------|--------|-------|
| GroupsPage | Create Group | POST /api/groups | loading/success/error | No groups | API error | STORY-... |
| AuthorizationsPage | Approve | POST /api/authorizations/:id/approve | pending/approved | No pending | expired/error | STORY-... |

---

## 8. Gate B-6：TODO 与 follow-up story

实现中允许 TODO，但 TODO 不能无主存在。

### 规则

- [ ] 每个 TODO 必须引用 story/issue 编号
- [ ] 与当前 AC 直接相关的 TODO 不能进入 done 状态
- [ ] 如果 TODO 是明确延期，story 状态只能是 CONDITIONAL PASS

### 允许格式

```typescript
// TODO(STORY-F012): Route federation claim to the source team and wake the remote agent.
```

### 禁止格式

```typescript
// TODO: implement later
```

---

## 9. Story Review Checklist

在故事进入 Dev 前，Reviewer 必须逐项检查：

- [ ] User Story 清楚表达角色、目标、收益
- [ ] AC 使用可验证语言，不含模糊词（如「更好」「尽量」）
- [ ] 若涉及 UI，已包含 UI Entry Points
- [ ] 若涉及状态，已包含 State Mapping 表
- [ ] 若涉及后端 API，已说明 UI 是否本故事范围
- [ ] 若涉及展示组件，已要求页面集成测试
- [ ] Dependencies 完整
- [ ] Out of Scope 明确
- [ ] Testability 映射到 AC Coverage Matrix
- [ ] 无未登记 TODO

---

## 10. 与 v0.2.0 GAP 的对应关系

| GAP | 被本 Gate 拦截的规则 |
|-----|----------------------|
| GAP-01 Add Agent 无 labels 输入 | B-1 UI Entry Point |
| GAP-02 群任务无视觉区分 | B-2 能力闭环 / B-3 状态映射 |
| GAP-03/04 pending_authorization 无映射/无分栏 | B-3 状态枚举映射 |
| GAP-05 Leave/Delete 按钮缺失 | B-1 UI Entry Point |
| GAP-06 ReputationBadge 未接入页面 | B-2 能力闭环 / Testability |
| GAP-07 Review UI 缺失 | B-2 能力闭环 |
| GAP-08 team_id 截断显示 | B-1 UI Entry Point / Usability |
| GAP-09 shared_capabilities 无 UI 编辑 | B-1 UI Entry Point |
| GAP-10 无 Federation Peers 状态面板 | B-2 能力闭环 |
| GAP-11 version 硬编码 | Release Gate / TODO Gate |
| GAP-12 Federation claim routing TODO | B-6 TODO follow-up |
| GAP-13 Leave 后任务回池 TODO | B-6 TODO follow-up |
| GAP-14 WebSocket 通知 TODO | B-6 TODO follow-up |

---

## 11. 决策记录

后续每次 Sprint Planning 完成后，在对应 sprint plan 中附上：

```markdown
## BMAD Story Quality Gate Result

- Gate reviewer: <name>
- Date: <date>
- Result: PASS / CONDITIONAL PASS / FAIL
- Conditional items:
  - STORY-...
- Follow-up stories:
  - STORY-...
```
