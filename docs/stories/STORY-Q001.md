# STORY-Q001: BMAD/TEA 质量门禁与 CI 规则

**Epic:** EPIC-Q01 流程质量改进
**Sprint:** v0.2.0 Follow-up
**Points:** 5
**Priority:** Must Have
**Status:** ready

---

## User Story

As a 项目维护者, I want to 将 BMAD/TEA 的质量门禁固化到模板、测试设计和 CI 中, So that 后续 Sprint 不会重复出现故事 AC 漏写、测试覆盖太浅、TODO 未拦截的问题。

---

## Acceptance Criteria

### Functional AC

- [ ] **AC-01:** BMAD requirements/story 模板包含 UI Entry Points、State Mapping、Testability、Dependencies 小节。
- [ ] **AC-02:** 新增 `docs/bmad-story-quality-gate.md` 并在 workflow status 中登记。
- [ ] **AC-03:** 新增 `docs/test-artifacts/tea-quality-gate.md` 并在 workflow status 中登记。
- [ ] **AC-04:** 新增 AC Coverage Matrix 模板或 v0.2.0 实例。
- [ ] **AC-05:** 新增 TODO baseline 检查，禁止无 story/issue 的新增 TODO。
- [ ] **AC-06:** 新增 orphan component 检查，避免组件只被测试引用。
- [ ] **AC-07:** 新增 hardcoded version 检查，避免 release 版本不一致。
- [ ] **AC-08:** package scripts 增加 `quality:gates`（使用 npm run quality:gates）。
- [ ] **AC-09:** CI 执行 `quality:gates`。
- [ ] **AC-10:** 新增 PR template，包含 BMAD/TEA 自检清单。

### UI Entry Points

- [ ] **UI-01:** N/A，流程/CI story，无用户界面。

### State Mapping

| State field | State value | Badge text | Badge color | Board/List grouping | Detail view | Test case |
|-------------|-------------|------------|-------------|---------------------|-------------|-----------|
| release_decision | GO | GO | green | workflow status | ✅ | TC-Q001-001 |
| release_decision | CONDITIONAL_GO | Conditional GO | yellow | workflow status | ✅ | TC-Q001-002 |
| release_decision | NO_GO | No-Go | red | workflow status | ✅ | TC-Q001-003 |

### Testability

- [ ] **TEST-01:** `npm run quality:gates` 可本地运行。
- [ ] **TEST-02:** TODO 检查对无 owner TODO 返回失败。
- [ ] **TEST-03:** orphan component 检查能识别仅 test import 的组件。
- [ ] **TEST-04:** hardcoded version 检查能识别旧版本硬编码。
- [ ] **TEST-05:** GitHub Actions 调用 `quality:gates`。

---

## Technical Notes

**新增文件建议:**
- `scripts/check-todo-baseline.js`
- `scripts/check-orphan-components.js`
- `scripts/check-hardcoded-version.js`
- `.github/PULL_REQUEST_TEMPLATE.md`

**修改文件建议:**
- `package.json`
- `.github/workflows/test.yml`
- `.spec-workflow/templates/requirements-template.md`
- `docs/bmm-workflow-status.yaml`

---

## Dependencies

- `docs/process-retrospective-v0.2.0.md`
- `docs/bmad-story-quality-gate.md`
- `docs/test-artifacts/tea-quality-gate.md`
- `docs/test-artifacts/ac-coverage-matrix-v0.2.0.md`

---

## Traceability

- Related GAP: GAP-01~GAP-14（流程性根因）
- Manual verification: N/A
- Process rules: B-1~B-6, T-1~T-7
