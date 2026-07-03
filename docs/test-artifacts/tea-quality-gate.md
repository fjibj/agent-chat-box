# TEA Quality Gate

**项目:** Agent Chat Box  
**适用阶段:** TEA Phase 5（Test Design / ATDD / Automate / Traceability / Go-No-Go）  
**来源:** [process-retrospective-v0.2.0.md](../process-retrospective-v0.2.0.md)  
**目的:** 防止「自动化测试全绿，但 AC 未逐条覆盖、UI 未完整集成、TODO 未拦截」的问题再次发生。

---

## 1. Gate 结论定义

| 结论 | 含义 | 发布建议 |
|------|------|----------|
| **GO** | 自动化测试、AC 覆盖、质量门禁、人工验证均通过 | 可发布 |
| **CONDITIONAL GO** | 核心路径通过，但存在登记在册且不阻塞的缺口 | 可灰度/内部发布，需明确 follow-up |
| **NO-GO** | 存在阻塞缺陷、AC 无覆盖、关键 TODO 或人工验证失败 | 不可发布 |

**规则：自动化测试全部通过只能作为 GO 的必要条件，不能作为充分条件。**

---

## 2. Go/No-Go 必检项

| Gate | 检查项 | GO 条件 | v0.2.0 反例 |
|------|--------|---------|-------------|
| T-1 | 自动化测试 | `npm test` / server / web 全绿 | ✅ 达成 |
| T-2 | AC 覆盖率 | Must/Should AC ≥ 80%，P0/P1 AC = 100% | ❌ G024 6 条 AC 仅 1 条浅测 |
| T-3 | 状态枚举完整性 | 新增状态均有 UI 文案、颜色、分栏、详情映射 | ❌ pending_authorization 缺映射 |
| T-4 | 展示组件集成 | 组件不仅单测通过，还在目标页面渲染 | ❌ ReputationBadge 未被页面使用 |
| T-5 | TODO 增量 | 0 个无 story/issue 的新增 TODO | ❌ hub/authorization/groups 多处 TODO |
| T-6 | 版本一致性 | package/API/UI 版本一致 | ❌ `/api/version` 仍 0.1.0 |
| T-7 | 人工验证 | manual-verification 完成且无阻塞 | 🔄 v0.2.0 未完成 |

---

## 3. T-1：AC ↔ Test 一对一映射

每条 Acceptance Criterion 至少映射到一个验证项：Unit、Integration、E2E 或 Manual。

### 矩阵模板

| Story | AC ID | AC 描述 | Unit | Integration | E2E | Manual | 状态 |
|-------|-------|---------|------|-------------|-----|--------|------|
| G024 | AC-01 | 任务看板有内部/群标签页 | | | | | Missing |

### 状态定义

| 状态 | 含义 |
|------|------|
| **Covered** | 至少一个自动化测试覆盖，且断言验证 AC 关键结果 |
| **Manual** | 目前只能人工验证，已列入 manual-verification |
| **Partial** | 只测了组件或主路径，未覆盖 AC 全部语义 |
| **Missing** | 无自动化/人工验证项 |

### 不合格例子

```typescript
// 只断言三列存在，不能覆盖「群任务视觉区分」
expect(screen.getByText('Pending')).toBeDefined();
```

### 合格例子

```typescript
render(<TaskBoard />);
expect(screen.getByText('Group Task')).toBeInTheDocument();
expect(screen.getByText('Pending Authorization')).toHaveClass('bg-yellow-500');
```

---

## 4. T-2：展示型组件必须有页面集成测试

对所有 UI 展示组件，TEA 必须同时要求：

1. **组件单测**：颜色、文案、分支逻辑正确
2. **页面集成测试**：组件出现在实际页面中
3. **数据链路测试**：页面通过 API/props 获得数据并传给组件

### 检查表

| 组件 | 单测 | 页面集成 | 数据链路 | 状态 |
|------|------|----------|----------|------|
| ReputationBadge | ✅ | ❌ | ❌ | Partial |
| TaskCard StatusBadge | ✅/❌ | ✅ | ✅ | TBD |

### 推荐测试形式

```typescript
it('renders team reputation in group members list', async () => {
  mockFetchSequence([
    [{ id: 'g1', name: 'Alpha', members: [{ team_id: 't1', team_name: 'Team A', role: 'member' }] }],
    { contract: {} },
    [{ team_id: 't1', total_score: 5 }],
  ]);

  render(<GroupsPage />);
  await user.click(await screen.findByText('Alpha'));

  expect(screen.getByText('Team A')).toBeInTheDocument();
  expect(screen.getByTestId('reputation-badge-t1')).toHaveTextContent('5');
});
```

---

## 5. T-3：状态枚举完整性测试

新增/修改状态时必须做枚举完整性测试。

### Task 状态基线

```typescript
const ALL_TASK_STATUSES = [
  'pending',
  'pending_authorization',
  'claimed',
  'running',
  'decomposing',
  'verifying',
  'completed',
  'failed',
] as const;
```

### 必测维度

| 维度 | 示例 |
|------|------|
| Badge 文案 | pending_authorization → Pending Authorization |
| Badge 颜色 | pending_authorization → yellow / purple，不允许 fallback gray |
| 看板归类 | pending_authorization → Pending 或 Authorization 专栏 |
| 详情页展示 | TaskDetailModal 显示完整状态 |
| 筛选计数 | 列计数包含该状态 |

### 推荐测试

```typescript
for (const status of ALL_TASK_STATUSES) {
  it(`TaskCard renders ${status} without fallback style`, () => {
    render(<TaskCard {...defaultTask} status={status} />);
    const badge = screen.getByTestId(`task-status-${status}`);
    expect(badge).toBeInTheDocument();
    expect(badge.className).not.toContain('bg-gray-500');
  });
}
```

---

## 6. T-4：Mock 边界规则

页面级测试不能全部 mock 到只剩静态渲染。

### 规则

- [ ] 页面组件至少 1 条测试使用 MSW 或测试 server，而不是裸 `global.fetch = vi.fn()`
- [ ] mock 数据必须包含正常、空态、错误态
- [ ] 如果故事 AC 涉及状态流转，必须测试流转后的 UI 归类
- [ ] 如果故事 AC 涉及后端错误码，必须验证页面错误提示

---

## 7. T-5：TODO Gate

### 规则

| 类型 | 允许进入 GO？ | 条件 |
|------|---------------|------|
| TODO(STORY-XXX) | ✅ | 已登记 follow-up 且不阻塞 |
| TODO without owner | ❌ | 必须补 story/issue |
| TODO in Must Have AC path | ❌ | 当前故事不能 Done |
| TODO in optional improvement | ✅ | 标为 tech debt |

### 检查命令建议

```bash
grep -rn "TODO" packages/*/src --include="*.ts" --include="*.tsx"
```

CI 后续应升级为脚本：

```bash
npm run quality:gates
```

---

## 8. T-6：Hardcoded Version Gate

### 检查项

- [ ] `package.json` version
- [ ] `/api/version`
- [ ] `/api/server-info`
- [ ] README / CHANGELOG
- [ ] UI Settings 页面

### 规则

- 版本号应从单一来源读取，禁止在多个文件硬编码旧版本
- Release PR 必须包含版本一致性检查

---

## 9. T-7：Orphan Component Gate

展示型组件如果创建后无人引用，测试必须失败或标记为 dead code。

### 检查项

- [ ] `components/*.tsx` 是否至少被一个 page/component import
- [ ] 若仅被 test import，是否属于真正的 public component library
- [ ] 若是页面专用组件，是否已接入页面

### v0.2.0 反例

`ReputationBadge.tsx` 只被 `GroupsPage.test.tsx` import，实际页面未引用。

---

## 10. Go/No-Go Addendum 模板

当自动化测试已 GO，但人工验证发现缺口时，不删除历史结论，而是追加 Addendum：

```markdown
## Post-TEA Manual Verification Addendum

- Original TEA Decision: GO
- Manual Verification Status: IN PROGRESS / COMPLETED
- New Findings: GAP-XX, GAP-YY
- Adjusted Release Decision: CONDITIONAL GO / NO-GO
- Required follow-up stories:
  - STORY-...
```

---

## 11. 与 v0.2.0 GAP 的对应关系

| GAP | 被本 Gate 拦截的规则 |
|-----|----------------------|
| GAP-02 群任务无视觉区分 | T-1 AC 覆盖 |
| GAP-03/04 pending_authorization | T-3 状态枚举完整性 |
| GAP-06 ReputationBadge 未接入 | T-2 展示组件集成 / T-7 Orphan Component |
| GAP-11 version 硬编码 | T-6 Version Gate |
| GAP-12/13/14 TODO | T-5 TODO Gate |

---

## 12. TEA Sign-off Checklist

TEA 在给出 GO 前必须确认：

- [ ] 自动化测试通过
- [ ] AC Coverage Matrix 无 P0/P1 Missing
- [ ] 所有新增状态通过枚举完整性测试
- [ ] 所有展示组件有页面集成测试
- [ ] TODO Gate 通过
- [ ] Version Gate 通过
- [ ] Orphan Component Gate 通过
- [ ] manual-verification 已完成或明确为后置 gate
- [ ] 若结论为 CONDITIONAL GO，follow-up stories 已创建
