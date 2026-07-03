# STORY-F012: Federation Claim Routing 完整链路

**Epic:** EPIC-F02 跨团队任务路由与 E2E Follow-up
**Sprint:** v0.2.0 Follow-up
**Points:** 8
**Priority:** Must Have
**Status:** ready

---

## User Story

As a 成员团队 Runner, I want to claim Hub 中匹配的群任务并被授权唤醒执行, So that 联邦任务可以从发现、claim、授权到 Agent 执行形成完整闭环。

---

## Acceptance Criteria

### Functional AC

- [ ] **AC-01:** `POST /api/federation/claim` 不再返回 mock，而是更新 `federation_task_index.status='claimed'`。
- [ ] **AC-02:** 同一任务被多个 Runner 并发 claim 时，只有一个成功。
- [ ] **AC-03:** claim 成功后，后续 poll 不再返回该任务。
- [ ] **AC-04:** Hub 将 claim 事件路由到 source team server 或本地授权流程。
- [ ] **AC-05:** source team 审批通过后，Hub 调用 `wakeFederationAgent(teamId, agentId, taskId, context)`。
- [ ] **AC-06:** Runner 收到 `federation.agent.wake` 后唤醒本地 Agent，并传入 task context。
- [ ] **AC-07:** 远程 Agent 完成后，任务状态与 output 回传 source team。
- [ ] **AC-08:** Runner 断连时，未完成的 claimed federation_task_index 回到 open。
- [ ] **AC-09:** claim / approve / wake / complete 的关键步骤都有日志与测试覆盖。

### API / Protocol Entry Points

- [ ] **API-01:** `GET /api/federation/poll`
- [ ] **API-02:** `POST /api/federation/claim`
- [ ] **WS-01:** `federation.task.claim`
- [ ] **WS-02:** `federation.agent.wake`

### State Mapping

| State field | State value | Badge text | Badge color | Board/List grouping | Detail view | Test case |
|-------------|-------------|------------|-------------|---------------------|-------------|-----------|
| federation_task_index.status | open | Open | yellow | poll result | ✅ | TC-F012-001 |
| federation_task_index.status | claimed | Claimed | blue | hidden from poll | ✅ | TC-F012-002 |
| federation_task_index.status | completed | Completed | green | history | ✅ | TC-F012-003 |
| federation_task_index.status | expired | Expired | gray/red | history | ✅ | TC-F012-004 |

### Testability

- [ ] **TEST-01:** Integration test 覆盖 poll → claim → no longer returned。
- [ ] **TEST-02:** Race test 覆盖并发 claim。
- [ ] **TEST-03:** E2E test 覆盖 Hub + Runner + Agent wake。
- [ ] **TEST-04:** manual-verification M8.5~M8.15 通过。

---

## Technical Notes

**当前 TODO:**
- `packages/server/src/federation/hub.ts` `handleClaim` 当前只 `console.log`。
- `POST /api/federation/claim` 当前只返回 `{ status: 'pending_authorization' }`。

**修改文件:**
- `packages/server/src/federation/hub.ts`
- `packages/server/src/federation/runner.ts`
- `packages/server/src/api/authorizations.ts`
- `packages/server/src/modules/wake-engine.ts`
- `e2e/federation.spec.ts`

---

## Dependencies

- STORY-F006（标签匹配任务路由）
- STORY-F007（群任务队列拉取模式）
- STORY-G014（Manual 授权模式）
- STORY-G025（授权审批 UI）

---

## Traceability

- Related GAP: GAP-12, GAP-14
- Manual verification: M8.5~M8.15
- AC Coverage Matrix: F006/F007 Missing items
