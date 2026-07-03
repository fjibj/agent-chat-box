# v0.2.0 流程回顾：BMAD 故事拆分与 TEA 测试覆盖的改进点

**记录日期：** 2026-06-20
**触发事件：** v0.2.0 进入人工验证阶段，识别出 14 个 UI 缺口（详见 [manual-verification.md §O](./manual-verification.md)）
**目的：** 把缺口的根因结构化沉淀，作为后续 BMAD 故事编写与 TEA 测试设计的对照清单
**适用范围：** 本项目所有后续 Sprint，特别是 v0.3.0+ 的 PRD / 故事拆分 / TEA 测试设计阶段

---

## 1. 背景

v0.2.0 经过 BMAD（Brainstorm → PRD → Architecture → Stories → Dev）+ TEA（ATDD → Automate → Traceability → Go/No-Go）流程，**233 个自动化测试全部通过、决策 GO**。但进入人工验证阶段后，仅在 Web UI 层面就识别出 **14 个 UI 缺口（GAP-01~GAP-14）**，覆盖：群任务视觉区分缺失、`pending_authorization` 状态在看板无归类、ReputationBadge 写了组件但没接入页面、Review 工作流完全无 UI、Add Agent 表单缺 labels 字段、多处 TODO 直接合入等。

**关键观察：自动化测试全绿不等于功能可用。**

---

## 2. 14 个缺口的根因分布

| 根因层 | 缺口编号 | 缺口数 | 占比 |
|--------|----------|--------|------|
| **BMAD 故事 AC 写得粗 / UI 故事缺失** | GAP-01 / 05 / 07 / 09 / 02（部分）/ 06（部分） | 8 | ~57% |
| **TEA 自动化测试只测路径不测完整性** | GAP-02 / 03 / 04 / 06 | 4 | ~29% |
| **实现阶段允许 TODO 直接合入** | GAP-08 / 11 / 13 | 2 | ~14% |
| **架构故意切分但实施一半就过 TEA** | GAP-12 / 14 | 2 | （归入第三类） |

> 注：缺口编号见 [manual-verification.md §O](./manual-verification.md)。同一缺口可同时属于多类根因，归类按主要责任。

---

## 3. 三类根因深入分析

### 3.1 BMAD 故事 AC 写得粗 / UI 故事缺失（主因，~57%）

**典型证据 1：UI 故事根本不存在**

GAP-07（Review 工作流无 UI）：翻遍 `STORY-024~029`（基础 review）和 `STORY-G020~G022`（信誉系统），**所有故事都只规划了 API，没有任何 UI 故事**。

GAP-01（Add Agent 无 labels 输入）：`STORY-F003`（Agent labels）只写后端字段，**没有任何故事规划"在 Web UI 的 Add Agent 表单暴露 labels 输入"**。

**典型证据 2：故事写了 API 没写 UI 触发器**

GAP-05（Leave/Delete 按钮缺失）：
- `STORY-G009`（退出群）AC 第一行：`POST /api/groups/:id/leave` ✅
- 但**所有 6 条 AC 都是后端规则**，没有"GroupsPage 提供 Leave 按钮"
- `STORY-G006`（群 CRUD API）同理，只规划了 `DELETE /api/groups/:id`，没规划 UI 解散入口

**典型证据 3：故事 AC 写了实现却漏做**

GAP-09（shared_capabilities 编辑）：`STORY-G023` AC 明确写了 ✅ "shared_capabilities: 多选输入"，但 `GroupsPage.tsx` 契约编辑器只渲染了 authorization / trust_threshold / max_tasks_per_hour / visibility 四组控件，**shared_capabilities 输入框未实现**。

GAP-06（ReputationBadge 不渲染）：`STORY-G026` AC 写了 ✅ "群成员列表显示各团队信誉分"+"审批界面显示 claim 团队信誉分"，但实现只做了 `ReputationBadge.tsx` 组件，**没有任何页面 import 它**。

**根因小结：**
- UI 故事的 AC 容易写成"后端 API + 数据契约"，**忘了写"用户在哪里点哪个按钮触发"**
- "整个能力就缺独立 UI 故事"是更隐蔽的问题（Review 工作流从头到尾被遗漏）

### 3.2 TEA 自动化测试只测路径不测完整性（次因，~29%）

**典型证据 1：测试断言太浅**

`packages/web/src/pages/GroupsPage.test.tsx:179-188` 中 **TC-G024-001**（跨团队任务看板）：

```typescript
it('TC-G024-001: task board shows columns', async () => {
  mockFetch({ tasks: [] });
  render(<TaskBoard />);
  await waitFor(() => {
    expect(screen.getByText('Pending')).toBeDefined();
    expect(screen.getByText('In Progress')).toBeDefined();
    expect(screen.getByText('Completed')).toBeDefined();
  });
});
```

测试**只断言了三列标题存在**，没断言：
- `STORY-G024` AC ✅ "外部任务和内部任务视觉区分"——TaskCard 是否渲染了 GROUP 标识？（GAP-02）
- `STORY-G024` AC ✅ "群任务状态标签：pending_authorization（黄）"——TaskCard.statusConfig 是否包含该状态？（GAP-03/04）

结果：测试绿了，故事 AC 没全部覆盖到。

**典型证据 2：组件单测覆盖了，但"是否被使用"无人测**

`TC-G026-001` 测了 `ReputationBadge` 单组件的颜色映射（4 个 score 分支），全绿。但**没人测过任何页面 import 了它**。GAP-06 因此漏检。

**典型证据 3：mock 太彻底，看不见集成问题**

GroupsPage.test.tsx 全部用 `global.fetch = vi.fn()` mock，从未真正渲染 Members 列表（M2-43~46 类）、从未触发"创建群后契约编辑器是否含 shared_capabilities 编辑控件"等组合断言。

**根因小结：**
- TEA 的 TC（Test Case）只覆盖了**故事 AC 的第一条主路径**，没强制 1 条 AC ↔ 1 条断言
- **组件单测**和**组件被使用的集成测试**是两件事，TEA 默认只做了前者

### 3.3 实现阶段允许 TODO 直接合入（第三因，~14%）

**典型证据：**

| 缺口 | 代码位置 | 原文 |
|------|----------|------|
| GAP-13 | `groups.ts:418` | `// TODO: Reset claimed tasks back to pending pool (requires group_tasks table from STORY-G010)` |
| GAP-12 | `hub.ts:271-274` | `// TODO: Route claim to source team server (F006/F007)` |
| GAP-14 | `authorizations.ts:99,152` 等多处 | `// TODO: Send WebSocket authorization.requested to task source team owner` |
| GAP-11 | `index.ts:66,77` | `version: '0.1.0'`（v0.2.0 版本仍然硬编码） |

这些 TODO 在 PR 阶段就显式标记了，**但 TEA 的 Go/No-Go 没有 grep 检查阈值**，CI 流水线也没有对未完成项目的拦截规则。

`STORY-G009` AC 第二条 ✅ "退出时，该团队已 claim 但未完成的群任务自动回群任务池"——**实现里直接 TODO 了**，但 TEA 测试没断言这一点（因为 G010 group_tasks 表已存在，TODO 注释里写的依赖已不成立）。

**根因小结：**
- TODO 注释是开发者的"善意标记"，但缺少机制把它转化为"未完成的 AC 必须重开故事"
- 硬编码（如 version='0.1.0'）属于"已知的临时值忘了改"，需要 release 检查清单

---

## 4. BMAD 流程改进建议

### 4.1 故事编写阶段（Sprint Planning / Create-Story 时）

**B-1：UI 故事必须有"用户操作入口" AC**
- 凡是涉及 Web UI 的故事，AC 至少包含一条 **"在 [页面名] 提供 [按钮/输入框/下拉] 触发 [动作]"**
- 反例：`STORY-G009` AC 全是后端，没"GroupsPage 提供 Leave 按钮"
- 正例（应改为）：`AC: GroupsPage 群详情头部对非 owner 团队渲染 "Leave Group" 按钮`

**B-2：能力闭环检查清单**
每个 Epic 完成时，对照下表自检，**任意一行打 ❌ 必须开新故事**：

| 维度 | 后端 API | UI 入口 | 状态可视化 | 实时通知 |
|------|----------|---------|-----------|----------|
| 群创建/解散 | ✅ | ⬜ | ⬜ | ⬜ |
| 入群/退群 | ✅ | ⬜（半） | ⬜ | ⬜ |
| 契约编辑 | ✅ | ⬜（半） | ⬜ | ⬜ |
| 群任务发布 | ✅ | ⬜ | ⬜ | ⬜ |
| 跨团队 claim | ✅ | ⬜ | ⬜（半） | ⬜ |
| 授权审批 | ✅ | ✅ | ✅ | ⬜ |
| Review 工作流 | ✅ | ⬜ | ⬜ | ⬜ |
| 信誉分 | ✅ | ⬜ | ⬜ | ⬜ |
| Federation Hub | ✅ | ⬜ | ⬜ | ⬜ |

> v0.2.0 此表如果存在，会立即暴露 Review UI、退群 UI、Hub 状态面板等缺口。

**B-3：状态枚举必须有 UI 映射故事**
新增任务/Agent/授权状态时（如 `pending_authorization`），**必须配套写一条 UI 映射故事**：
- 在 `TaskCard.statusConfig` 等枚举中添加颜色 + 文案
- 在 TaskBoard 等过滤逻辑中归类到合适的列
- 列出反例：v0.2.0 引入 `pending_authorization` 状态但 TaskCard 和 TaskBoard 都未更新

**B-4：跨故事依赖必须显式声明**
- `STORY-G024` 应该显式声明依赖 `STORY-G013`（pending_authorization 状态）、`STORY-G009`（退群任务回池）等
- 当前模板的 `## Dependencies` 区写得不一致，G024 完全没列依赖

### 4.2 PRD / 架构阶段

**B-5：UI 完整性章节**
PRD 应包含 "UI 完整性检查表"，列出所有页面、所有用户操作入口、所有状态枚举的视觉映射。每个表格项必须能回溯到具体故事。

**B-6：架构 TODO 必须开 follow-up 故事**
当架构故意切分（如 v0.2.0 的 F006/F007 计划在 Sprint 2/3 分两步实现）：
- 第一步实现里的 `TODO: implemented in F00X` 必须在 F00X 故事中显式列为入口
- 否则会出现 v0.2.0 的 GAP-12：F006/F007 故事在文档中存在但实现一半就过测

---

## 5. TEA 流程改进建议

### 5.1 ATDD 阶段（编写测试用例时）

**T-1：1 条 AC ↔ ≥1 条断言**
TEA 的 TC 必须能逐条映射回 BMAD 故事的 AC 列表：
- `STORY-G024` 有 6 条 AC，TC-G024-* 应至少 6 个测试用例
- 当前实际只有 1 个 TC-G024-001，覆盖了 1 条 AC（kanban 三列存在），其余 5 条 AC 未测

**T-2：组件被使用必须断言**
对所有"展示型组件"（如 `ReputationBadge`、`StatusBadge`），单测之外**必须有一条集成测试**：
```typescript
// 强制断言：组件出现在它应该出现的页面
expect(container.querySelector('[data-testid="reputation-badge"]')).toBeInTheDocument();
```
- 反例：`TC-G026-001` 只测组件本身的颜色映射，全绿，但 GroupsPage 实际没有渲染它
- 正例：`TC-G026-002` 应渲染 `<GroupsPage groupId="..."/>` 并断言 `ReputationBadge` 出现在成员列表中

**T-3：状态枚举完整性测试**
对所有状态机字段（task.status, agent.status, authorization.status），TEA 必须有一条**枚举完整性测试**：
```typescript
const ALL_TASK_STATUSES = ['pending', 'pending_authorization', 'claimed', 'running',
                          'decomposing', 'verifying', 'completed', 'failed'];
ALL_TASK_STATUSES.forEach(status => {
  it(`TaskCard renders ${status} with valid color`, () => {
    const { container } = render(<TaskCard status={status} {...defaultProps} />);
    const badge = container.querySelector('[data-testid="status-badge"]');
    expect(badge).toBeInTheDocument();
    expect(badge?.className).not.toContain('bg-gray-500'); // 不是 fallback unknown
  });
});
```
- 这条测试在 v0.2.0 会立即失败，暴露 GAP-03

**T-4：mock 边界要谨慎**
- 顶层组件（页面级）测试**至少有一条不 mock fetch**，使用 MSW 或测试 server
- 反例：GroupsPage.test.tsx 全部 mock，无法暴露真实 API 集成问题

### 5.2 Automate / Traceability 阶段

**T-5：覆盖率指标 ≥ 数量指标**
- 233 用例全绿听起来很好，但 `STORY-G024` 实际只覆盖了 17%（1/6 AC）
- TEA 报告必须列出每个故事的 **AC 覆盖率**，而不是测试用例总数

**T-6：grep 拦截**
TEA 的 Go/No-Go 检查必须包含：
```bash
# TODO 数量阈值
TODO_COUNT=$(grep -rn "TODO" packages/*/src --include="*.ts" --include="*.tsx" | wc -l)
[ "$TODO_COUNT" -gt "$BASELINE" ] && echo "新增 TODO 超过基线，阻断" && exit 1

# 硬编码版本号检查
grep -rn "version: '0\." packages/server/src && echo "硬编码版本号" && exit 1

# UI 组件孤儿检查（组件存在但无任何 src 文件 import 它）
node scripts/check-orphan-components.js
```

### 5.3 Go/No-Go 决策

**T-7：自动化测试不能单独决策 GO**
TEA 决策清单必须包含：
- ✅ 233 测试全绿
- ⬜ AC 覆盖率 ≥ 80%
- ⬜ TODO 增量 = 0（或显式登记 follow-up 故事）
- ⬜ 关键页面 E2E 截图 review（人工 5 分钟扫一遍）
- ⬜ 状态枚举完整性测试通过
- **任何一项 ⬜ 即降级到 CONDITIONAL GO**

v0.2.0 实际只达到第 1 项就 GO，应该是 CONDITIONAL GO。

---

## 6. CI / Release Checklist 改进

### 6.1 CI 流水线增量

在 `.github/workflows/test.yml` 添加：
```yaml
- name: TODO baseline check
  run: bash scripts/check-todo-baseline.sh

- name: Orphan component check
  run: node scripts/check-orphan-components.js

- name: Hardcoded version check
  run: |
    if grep -rn "version: '0\." packages/server/src; then
      echo "::error::硬编码版本号"; exit 1
    fi
```

### 6.2 Release 前必查清单

发版前在 PR 描述强制列出：

- [ ] 所有 Sprint 故事的 AC 已逐条对应 TC 验证
- [ ] 新增状态枚举已在 UI 全链路（card / board / detail / filter）映射
- [ ] 所有 PR 引入的 TODO 已开 follow-up Issue
- [ ] `package.json` / `/api/server-info` / `/api/version` 版本号一致
- [ ] 人工验证清单（manual-verification.md）已分发并启动

---

## 7. 自检清单（贴在每位贡献者眼前的）

### 写故事时（BMAD Sprint Planning）
- [ ] AC 是否包含"UI 触发入口"？
- [ ] 新增状态枚举是否配套了 UI 映射故事？
- [ ] 跨故事依赖是否显式声明？
- [ ] 该 Epic 的"能力闭环表"是否还有 ⬜？

### 写测试时（TEA ATDD）
- [ ] 故事的每一条 AC 是否都有至少 1 个 TC？
- [ ] 展示型组件是否有"出现在页面"的集成断言？
- [ ] 状态枚举是否有完整性测试？
- [ ] 顶层页面测试是否至少 1 条不 mock？

### 提 PR 时（Dev）
- [ ] 是否引入新 TODO？已开 Issue 否？
- [ ] 是否硬编码了版本号 / 团队 ID / URL？
- [ ] 新增组件是否被某个页面 import？

### 决策 Go/No-Go 时（TEA Gate）
- [ ] AC 覆盖率有报告吗？
- [ ] TODO 增量为 0 吗？
- [ ] 关键页面 E2E 截图 review 了吗？
- [ ] 状态完整性测试通过吗？

---

## 8. 反思

**v0.2.0 流程没坏，是这一轮在严格度上偏松。**

BMAD + TEA 的设计本身是对的——它确保了：
- 业务理解 → PRD → 架构 → 故事 → 实现 → 测试 → 决策 的链路完整
- 233 个自动化测试是真正的资产，没有它们我们的人工验证压力会大 3 倍

但**人工验证作为流程外的兜底网，不应该是发现这种规模缺口的第一关**。这次 14 个 GAP 中至少 8 个应该在故事编写阶段就被 B-2 表格暴露，4 个应该在 TEA 阶段就被 T-1/T-2 拦截。

下次开 v0.3.0 时，把本文件作为 Sprint Planning 第一份 review 材料，把 §7 自检清单贴进 PR template。

---

## 9. 关联文档

- [manual-verification.md](./manual-verification.md) — v0.2.0 人工验证记录（含 §O 14 个缺口清单）
- [docs/stories/](./stories/) — 71 个用户故事（含 v0.2.0 的 G001-G026 和 F001-F010）
- [docs/sprint-plan-agent-chat-box-group-expansion-2026-05-11.md](./sprint-plan-agent-chat-box-group-expansion-2026-05-11.md) — v0.2.0 Sprint 计划
- [.github/workflows/test.yml](../.github/workflows/test.yml) — 当前 CI 流水线（未来扩展处）
