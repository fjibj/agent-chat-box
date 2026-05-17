# Risk Matrix: Agent Chat Box — 群级扩展

**Date:** 2026-05-15
**Scope:** 26 User Stories (STORY-G001 ~ STORY-G026)
**Method:** BMAD TEA Risk-Based Testing

---

## Risk Grading Criteria

| Dimension | Weight | P0 | P1 | P2 | P3 |
|-----------|--------|----|----|----|----|
| **Business Impact** | 40% | System down / Data loss | Core feature broken | Degraded UX | Cosmetic |
| **Technical Complexity** | 30% | Distributed / Atomic / Migration | Multi-module integration | Single module | Pure UI |
| **Failure Probability** | 20% | High (new code + concurrency) | Medium (new feature) | Low (standard pattern) | Very low |
| **Regression Risk** | 10% | Breaks existing data | Breaks existing API | Breaks existing UI | No regression |

---

## Risk Matrix by Story

### P0 — Critical (Migration + Core Flow)

| Story | Title | Risk Rationale | Test Focus |
|-------|-------|---------------|------------|
| G001 | DB Migration v4→v5 | Migration failure = data corruption, existing machines/agents orphaned | Schema validation, rollback test, data integrity |
| G005 | DB Migration v5→v6 | groups/group_members table missing = entire epic blocked | Migration idempotency, index validation |
| G010 | DB Migration v6→v7 | group_tasks/auth_requests missing = task pool broken | CHECK constraint validation, foreign key integrity |
| G011 | 群任务发布 API | Core business flow; failure = no cross-team collaboration | Capability whitelist, group membership auth |
| G012 | WebSocket 群广播 | Real-time; failure = tasks invisible to claimers | Broadcast latency (<5s), memory leak, disconnect cleanup |
| G013 | 跨团队 Claim API | Race condition on claim; atomicity failure = double-claim | Concurrent claim test, capability matching, team membership |
| G014 | Manual 授权模式 | Security gate; unauthorized execution = data breach | Timeout expiry (5min), approve/reject state machine |
| G016 | 跨团队任务重试 | Failure without retry = task lost forever | Retry counter, max_retry limit, disconnect auto-release |

### P1 — High (API + Business Logic)

| Story | Title | Risk Rationale | Test Focus |
|-------|-------|---------------|------------|
| G002 | Team CRUD API | Foundation for all team-scoped features | Owner auto-assignment, delete with agents guard |
| G003 | Agent 归属管理 | Incorrect team = wrong task visibility | Auto-assign on daemon register, team switch atomicity |
| G006 | Group CRUD API | Core group lifecycle | Owner auto-join, dissolve cascade |
| G007 | 群契约配置 | Invalid YAML = group unconfigurable | YAML parse/validation, field range checks |
| G008 | 邀请码与加入群 | Invite bypass = unauthorized access | Expiry check, max_uses, duplicate join prevention |
| G015 | Auto 授权模式 | Threshold bug = unauthorized auto-approval | Reputation threshold edge cases, quota overflow |
| G017 | 任务产出回流 | Output not returned = decomposer blind | Visibility.task_output=false suppression, parent task lookup |
| G018 | Review 状态管理 | Wrong reputation delta = trust system broken | Approved (+1) vs Rejected (-2), task re-pool on reject |

### P2 — Medium (Supporting Logic)

| Story | Title | Risk Rationale | Test Focus |
|-------|-------|---------------|------------|
| G004 | 协作者管理 | Role escalation = privilege abuse | Owner removal guard, role enum validation |
| G009 | 退出群 | Task not returned = zombie tasks | Pending task reset, completed result retention |
| G019 | 过程隐私保护 | Internal log leak = strategy exposure | visibility.internal_log filtering, execution_log stripping |
| G020 | 信誉分记录 | Wrong delta = trust system unfair | Event type enum, score aggregation accuracy |
| G021 | 信誉分查询 API | Wrong SUM = wrong authorization decision | SQL aggregation, NULL handling |
| G022 | 信誉分阈值判定 | New team incorrectly auto-approved | No-record = false, boundary values |

### P3 — Low (UI / Display)

| Story | Title | Risk Rationale | Test Focus |
|-------|-------|---------------|------------|
| G023 | 群管理页面 | Display only; no data mutation | Form validation, route navigation |
| G024 | 跨团队任务看板 | Display only; no data mutation | Tab switching, filter by group_id |
| G025 | 授权审批 UI | Display only; actions call API | Countdown accuracy, empty state |
| G026 | 信誉分展示 | Display only; color thresholds | Color mapping (>=5 green, 1-4 yellow, <=0 red) |

---

## Risk Distribution

```
P0: 8 stories  (31%)  → Full automation: unit + integration + e2e
P1: 8 stories  (31%)  → Full automation: unit + integration
P2: 6 stories  (23%)  → Integration tests + spot unit
P3: 4 stories  (15%)  → E2E smoke tests only
```

---

## Key Risk Scenarios

1. **Concurrent Claim Race** (G013): Two agents claim same group task simultaneously → must be atomic, only one succeeds
2. **Migration Rollback** (G001/G005/G010): Migration partially applied → must be idempotent or transactional
3. **WebSocket Memory Leak** (G012): 50 teams connect/disconnect repeatedly → groupTeams/teamClients maps must not grow unbounded
4. **Authorization Timeout** (G014): Pending auth request expires while owner is reviewing → race between approve and expiry scanner
5. **Reputation Boundary** (G022): Team with score=4.9 vs threshold=5.0 → must not auto-approve
