# Traceability Matrix: 需求 → 测试用例

**Project:** Agent Chat Box — 群级扩展
**Date:** 2026-05-15

---

## Epic Traceability

### EPIC-001: 团队抽象

| Story | 需求 | 测试用例 | 类型 | 状态 |
|-------|------|----------|------|------|
| G001 | teams/team_members 表存在 | TC-G001-001, TC-G001-002 | UT/IT | 📝 Planned |
| G002 | Team CRUD API | TC-G002-001, TC-G002-002 | IT | 📝 Planned |
| G003 | Agent 归属管理 | TC-G003-001, TC-G003-002 | IT | 📝 Planned |
| G004 | 协作者管理 | TC-G004-001 | IT | 📝 Planned |

### EPIC-002: 群契约与成员管理

| Story | 需求 | 测试用例 | 类型 | 状态 |
|-------|------|----------|------|------|
| G005 | groups/group_members 表存在 | TC-G005-001 | UT | 📝 Planned |
| G006 | Group CRUD API | TC-G006-001 | IT | 📝 Planned |
| G007 | 群契约配置 | TC-G007-001, TC-G007-002 | UT/IT | 📝 Planned |
| G008 | 邀请码与加入群 | TC-G008-001, TC-G008-002 | IT | 📝 Planned |
| G009 | 退出群 | TC-G009-001 | IT | 📝 Planned |

### EPIC-003: 两级任务池与授权

| Story | 需求 | 测试用例 | 类型 | 状态 |
|-------|------|----------|------|------|
| G010 | group_tasks/auth_requests 表 | TC-G010-001 | UT | 📝 Planned |
| G011 | 群任务发布 API | TC-G011-001, TC-G011-002 | IT | 📝 Planned |
| G012 | WebSocket 群广播 | TC-G012-001, TC-G012-002 | UT/IT | 📝 Planned |
| G013 | 跨团队 Claim API | TC-G013-001, TC-G013-002 | IT | 📝 Planned |
| G014 | Manual 授权模式 | TC-G014-001~003 | IT | 📝 Planned |
| G015 | Auto 授权模式 | TC-G015-001, TC-G015-002 | IT | 📝 Planned |
| G016 | 跨团队任务重试 | TC-G016-001, TC-G016-002 | IT | 📝 Planned |

### EPIC-004: 跨团队 Review

| Story | 需求 | 测试用例 | 类型 | 状态 |
|-------|------|----------|------|------|
| G017 | 任务产出回流 | TC-G017-001, TC-G017-002 | IT | 📝 Planned |
| G018 | Review 状态管理 | TC-G018-001, TC-G018-002 | IT | 📝 Planned |
| G019 | 过程隐私保护 | TC-G019-001 | IT | 📝 Planned |

### EPIC-005: 信誉分系统

| Story | 需求 | 测试用例 | 类型 | 状态 |
|-------|------|----------|------|------|
| G020 | 信誉分记录 | TC-G020-001 | UT | 📝 Planned |
| G021 | 信誉分查询 API | TC-G021-001 | IT | 📝 Planned |
| G022 | 信誉分阈值判定 | TC-G022-001, TC-G022-002 | UT | 📝 Planned |

### EPIC-006: 群管理 UI

| Story | 需求 | 测试用例 | 类型 | 状态 |
|-------|------|----------|------|------|
| G023 | 群管理页面 | TC-G023-001 | E2E | 📝 Planned |
| G024 | 跨团队任务看板 | TC-G024-001 | E2E | 📝 Planned |
| G025 | 授权审批 UI | TC-G025-001 | E2E | 📝 Planned |
| G026 | 信誉分展示 | TC-G026-001 | E2E | 📝 Planned |

---

## FR Traceability

| FR ID | FR 描述 | 覆盖的 Story | 测试用例数量 |
|-------|---------|-------------|-------------|
| FR-001 | 团队模型 | G001 | 2 |
| FR-002 | 团队成员管理 | G002, G003, G004 | 5 |
| FR-003 | 群创建与配置 | G005, G006 | 2 |
| FR-004 | 群加入与退出 | G008, G009 | 3 |
| FR-005 | 群契约配置项 | G007 | 2 |
| FR-006 | 外部任务池 | G010, G011, G012 | 5 |
| FR-007 | 跨团队 Claim | G013 | 2 |
| FR-008 | Manual 授权 | G014 | 3 |
| FR-009 | Auto 授权 | G015 | 2 |
| FR-010 | 任务产出回流 | G017 | 2 |
| FR-011 | 过程隐私保护 | G019 | 1 |
| FR-012 | 信誉分记录 | G020 | 1 |
| FR-013 | 信誉分应用 | G022 | 2 |
| FR-014 | 跨团队重试 | G016 | 2 |
| FR-015 | 群管理 UI | G023 | 1 |
| FR-016 | 跨团队任务看板 | G024 | 1 |
| FR-017 | 授权审批 UI | G025 | 1 |
| FR-018 | 信誉分展示 | G026 | 1 |

**总计: 35 个测试用例覆盖 18 个 FR**

---

## Coverage Summary

| 层级 | 用例数 | 占比 | 目标 |
|------|--------|------|------|
| Unit | 8 | 23% | Core modules + migrations |
| Integration | 23 | 66% | API endpoints + DB flows |
| E2E | 4 | 11% | Critical user flows + UI |
| **总计** | **35** | **100%** | — |

---

## Legend

- 📝 Planned — 测试用例已设计，待实现
- 🔄 In Progress — 正在编写测试代码
- ✅ Passed — 测试通过
- ❌ Failed — 测试失败，待修复
- ⏭️ Skipped — 因依赖阻塞暂时跳过
