# STORY-G030: ReputationBadge 接入 Groups 与 Authorizations 页面

**Epic:** EPIC-006 群管理 UI Follow-up
**Sprint:** v0.2.0 Follow-up
**Points:** 3
**Priority:** Should Have
**Status:** ready

---

## User Story

As a 群成员, I want to 在群成员列表和授权审批界面看到团队信誉分, So that 我可以判断协作者可靠性并做出授权决策。

---

## Acceptance Criteria

### Functional AC

- [ ] **AC-01:** GroupsPage 成员列表为每个团队显示 ReputationBadge。
- [ ] **AC-02:** AuthorizationsPage 待审批卡片显示 claim 团队信誉分。
- [ ] **AC-03:** ReputationBadge 颜色规则与故事一致：`>=5` 绿色、`1-4` 黄色、`<=0` 红色。
- [ ] **AC-04:** 点击信誉徽章显示详情弹窗，列出事件时间、类型、分值、任务 ID。
- [ ] **AC-05:** 无信誉记录时显示 0 分，并使用红色或中性颜色（需与产品确认）。
- [ ] **AC-06:** 页面加载失败时不阻塞主页面，显示 `Reputation unavailable` 或降级为 0。

### UI Entry Points

- [ ] **UI-01 Page:** `/groups` Members 区域。
- [ ] **UI-02 Page:** `/authorizations` 请求卡片。
- [ ] **UI-03 Trigger:** 点击 ReputationBadge 打开详情弹窗。

### State Mapping

| State field | State value | Badge text | Badge color | Board/List grouping | Detail view | Test case |
|-------------|-------------|------------|-------------|---------------------|-------------|-----------|
| reputation.total_score | >=5 | score | green | Members/Auth card | ✅ | TC-G030-001 |
| reputation.total_score | 1-4 | score | yellow | Members/Auth card | ✅ | TC-G030-002 |
| reputation.total_score | <=0 | score | red | Members/Auth card | ✅ | TC-G030-003 |

### Testability

- [ ] **TEST-01:** `ReputationBadge.test.tsx` 覆盖颜色边界值。
- [ ] **TEST-02:** `GroupsPage.test.tsx` 覆盖成员列表中渲染 ReputationBadge。
- [ ] **TEST-03:** `AuthorizationsPage.test.tsx` 覆盖审批卡片中渲染 ReputationBadge。
- [ ] **TEST-04:** orphan component check 不能再把 ReputationBadge 识别为未使用组件。
- [ ] **TEST-05:** manual-verification M6.1~M6.10 通过。

---

## Technical Notes

**修改文件:**
- `packages/web/src/components/ReputationBadge.tsx`
- `packages/web/src/pages/GroupsPage.tsx`
- `packages/web/src/pages/AuthorizationsPage.tsx`
- `packages/server/src/api/reputation.ts`（如需事件详情接口）

**API:**
- `GET /api/groups/:gid/reputation`
- `GET /api/groups/:gid/reputation/:tid`

---

## Dependencies

- STORY-G020（信誉分记录）
- STORY-G021（信誉分查询 API）
- STORY-G025（授权审批 UI）
- STORY-G026（信誉分展示）

---

## Traceability

- Related GAP: GAP-06
- Manual verification: M6.1~M6.10
- AC Coverage Matrix: G026-AC01~AC04
