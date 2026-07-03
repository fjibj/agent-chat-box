# Test Cases — v0.2.0 Follow-up Quality Gates

**Project:** Agent Chat Box  
**Scope:** v0.2.0 Manual Verification Addendum / Follow-up Stories  
**Stories:** STORY-G027~G031, STORY-F011~F012, STORY-Q001  
**Date:** 2026-06-21  
**Source:** [ac-coverage-matrix-v0.2.0.md](../ac-coverage-matrix-v0.2.0.md)

---

## Legend

| Type | Symbol | Execution |
|------|--------|-----------|
| Unit | UT | `vitest run` |
| Integration | IT | `vitest run` with mocked fetch / test DB / API injection |
| E2E | E2E | `playwright test` |
| Quality Gate | QG | `npm run quality:gates` |
| Manual | MAN | `docs/manual-verification.md` |

---

## P0 — Must Fix Before v0.2.0 Release GO

### TC-G027-001 [IT] GroupsPage renders shared_capabilities editor
**Story:** STORY-G027  
**AC:** AC-01  
**Pre:** `GET /api/groups/:id/contract` returns `shared_capabilities: ['code', 'review']`  
**Action:** Render GroupsPage, select group  
**Expected:** Contract editor displays both `code` and `review`, plus an add capability control

### TC-G027-002 [IT] GroupsPage saves shared_capabilities changes
**Story:** STORY-G027  
**AC:** AC-01  
**Pre:** Group contract loaded  
**Action:** Add `python`, remove `review`, click Save Contract  
**Expected:** `PATCH /api/groups/:id/contract` body contains `shared_capabilities: ['code', 'python']`

### TC-G027-003 [IT] GroupsPage renders Leave Group for non-owner member
**Story:** STORY-G027  
**AC:** AC-04, AC-05  
**Pre:** Current team role is `member` in selected group  
**Action:** Select group  
**Expected:** `Leave Group` button visible; `Delete Group` hidden

### TC-G027-004 [IT] Leave Group calls API and refreshes group list
**Story:** STORY-G027  
**AC:** AC-05, AC-08  
**Pre:** Current team is member  
**Action:** Click Leave Group → confirm  
**Expected:** `POST /api/groups/:id/leave` called with current team id; group list refetched

### TC-G027-005 [IT] GroupsPage renders Delete Group for owner
**Story:** STORY-G027  
**AC:** AC-06, AC-07  
**Pre:** Current team role is `owner`  
**Action:** Select group  
**Expected:** `Delete Group` button visible; dangerous confirmation required before API call

### TC-G028-001 [IT] Add Agent modal includes labels input
**Story:** STORY-G028  
**AC:** AC-01  
**Pre:** At least one machine exists  
**Action:** Open AgentsPage, click `+ Add Agent`  
**Expected:** Modal contains Labels field

### TC-G028-002 [IT] Labels input is parsed, trimmed, deduplicated
**Story:** STORY-G028  
**AC:** AC-02, AC-06  
**Action:** Enter `python, review, python,  review ` and submit  
**Expected:** `POST /api/agents` body contains `labels: ['python', 'review']`

### TC-G028-003 [IT] Agent card renders labels badge list
**Story:** STORY-G028  
**AC:** AC-03, AC-05  
**Pre:** `/api/agents` returns agent labels `['python','review']`  
**Action:** Render AgentsPage  
**Expected:** Agent card displays `python` and `review` badges

### TC-G029-001 [UT] TaskCard status enum renders all task states
**Story:** STORY-G029  
**AC:** AC-04, AC-08  
**Input states:** `pending`, `pending_authorization`, `claimed`, `running`, `decomposing`, `verifying`, `completed`, `failed`  
**Expected:** Each status renders explicit label/color and does not use fallback gray unless intentionally mapped

### TC-G029-002 [IT] TaskBoard keeps pending_authorization task visible
**Story:** STORY-G029  
**AC:** AC-05  
**Pre:** `/api/tasks` returns root task with `status='pending_authorization'`  
**Action:** Render TaskBoard  
**Expected:** Task is visible in Pending or Authorization column; column count includes it

### TC-G029-003 [IT] Group task card shows group marker and source team
**Story:** STORY-G029  
**AC:** AC-01, AC-02  
**Pre:** `/api/tasks` returns task with `is_group_task=1`, `source_team_id='team-b'`; resolve-names maps team-b → Team B  
**Action:** Render TaskBoard  
**Expected:** Card displays group marker and `Team B`

### TC-G029-004 [IT] Task detail displays group authorization fields
**Story:** STORY-G029  
**AC:** AC-03, AC-06  
**Pre:** Task detail/timeline endpoint returns group metadata  
**Action:** Open TaskDetailModal  
**Expected:** Modal shows group_id/source_team/authorization_status

### TC-G030-001 [UT] ReputationBadge color boundaries match story
**Story:** STORY-G030  
**AC:** AC-03  
**Input:** scores `5`, `4`, `1`, `0`, `-1`  
**Expected:** `>=5` green, `1-4` yellow, `<=0` red

### TC-G030-002 [IT] GroupsPage member list renders ReputationBadge
**Story:** STORY-G030  
**AC:** AC-01  
**Pre:** Group members include team; `/api/groups/:gid/reputation` returns score 5  
**Action:** Render GroupsPage, select group  
**Expected:** Member row includes ReputationBadge with score 5

### TC-G030-003 [IT] AuthorizationsPage renders requesting team reputation
**Story:** STORY-G030  
**AC:** AC-02  
**Pre:** Pending auth request from Team B; reputation API returns Team B score 3  
**Action:** Render AuthorizationsPage  
**Expected:** Auth card shows Team B reputation badge

### TC-G031-001 [IT] TaskDetailModal shows Review section for completed group task
**Story:** STORY-G031  
**AC:** AC-01~AC-04  
**Pre:** Completed group task with output  
**Action:** Open TaskDetailModal  
**Expected:** Review section shows output, source agent/team, Approve and Reject buttons

### TC-G031-002 [IT] Review approve calls API and records success
**Story:** STORY-G031  
**AC:** AC-05, AC-07  
**Action:** Click Approve  
**Expected:** `POST /api/tasks/:tid/review` body `{decision:'approved', reviewer_id}`; UI shows approved result

### TC-G031-003 [IT] Review reject returns task to pending in UI
**Story:** STORY-G031  
**AC:** AC-06, AC-07  
**Action:** Click Reject  
**Expected:** API called with `decision:'rejected'`; TaskBoard refresh shows task in Pending

---

## P1 — Should Fix Before External Release

### TC-F011-001 [IT] Federation Peers panel renders peer statuses
**Story:** STORY-F011  
**AC:** AC-01~AC-03  
**Pre:** API returns peers with connected/disconnected/error  
**Action:** Render Federation Peers panel  
**Expected:** Each status has correct badge text/color

### TC-F011-002 [IT] Federation Peers panel renders empty state
**Story:** STORY-F011  
**AC:** AC-07  
**Pre:** API returns empty array  
**Expected:** Shows `No federation peers connected`

### TC-F011-003 [IT] Federation Peers refresh reloads data
**Story:** STORY-F011  
**AC:** AC-06  
**Action:** Click Refresh  
**Expected:** API called again; list updates

### TC-F012-001 [IT] Federation poll returns task matching labels
**Story:** STORY-F012 / STORY-F006  
**AC:** F006-AC03, F006-AC04  
**Pre:** Task required_labels=`['python']`; runner labels=`python,review`  
**Action:** `GET /api/federation/poll?team_id=...&labels=python,review`  
**Expected:** Response includes the task

### TC-F012-002 [IT] Federation poll filters out non-matching labels
**Story:** STORY-F012 / STORY-F006  
**Pre:** Task required_labels=`['python']`; runner labels=`java`  
**Action:** poll  
**Expected:** Response does not include the task

### TC-F012-003 [IT] Federation claim marks index as claimed
**Story:** STORY-F012  
**AC:** AC-01, AC-03  
**Action:** `POST /api/federation/claim`  
**Expected:** `federation_task_index.status='claimed'`; subsequent poll does not return task

### TC-F012-004 [IT] Concurrent federation claim has single winner
**Story:** STORY-F012  
**AC:** AC-02  
**Action:** Two parallel `POST /api/federation/claim` calls  
**Expected:** Exactly one succeeds; the other returns already claimed

### TC-F012-005 [E2E] Federation approve wakes remote agent
**Story:** STORY-F012  
**AC:** AC-04~AC-07  
**Pre:** Hub + Runner + daemon running  
**Action:** publish group task → poll → claim → approve  
**Expected:** Runner receives `federation.agent.wake`, daemon wakes agent, task completes and output returns

---

## P2 — Process Quality Gates

### TC-Q001-001 [QG] TODO gate fails on ownerless TODO
**Story:** STORY-Q001  
**AC:** AC-05  
**Fixture:** Temporary file contains `// TODO: implement later`  
**Action:** Run TODO check  
**Expected:** Fails with message requiring `TODO(STORY-XXX)`

### TC-Q001-002 [QG] TODO gate passes with story-owned TODO
**Story:** STORY-Q001  
**AC:** AC-05  
**Fixture:** `// TODO(STORY-F012): implement claim routing`  
**Expected:** Passes or records as known follow-up

### TC-Q001-003 [QG] Orphan component gate detects component only used in tests
**Story:** STORY-Q001  
**AC:** AC-06  
**Fixture:** Component imported only by `.test.tsx`  
**Expected:** Fails or warns with component path

### TC-Q001-004 [QG] Hardcoded version gate detects stale API version
**Story:** STORY-Q001  
**AC:** AC-07  
**Fixture:** Server code contains `version: '0.1.0'` while package.json is `0.2.0`  
**Expected:** Fails with mismatch

### TC-Q001-005 [QG] quality:gates script runs all checks
**Story:** STORY-Q001  
**AC:** AC-08, AC-09  
**Action:** `npm run quality:gates`  
**Expected:** Executes TODO, orphan component, hardcoded version checks

### TC-Q001-006 [QG] PR template includes BMAD/TEA self-checks
**Story:** STORY-Q001  
**AC:** AC-10  
**Action:** Read `.github/PULL_REQUEST_TEMPLATE.md`  
**Expected:** Contains sections for UI Entry Points, State Mapping, AC Coverage, TODO, Manual Verification

---

## Manual Verification Mapping

| Manual Section | Related TC |
|----------------|------------|
| M2 Groups lifecycle | TC-G027-001~005 |
| M3 Agent labels | TC-G028-001~003 |
| M5 Authorizations | TC-G030-003, TC-G031-* |
| M6 Reputation | TC-G030-001~003 |
| M7 Review | TC-G031-001~003 |
| M8 Federation | TC-F011-*, TC-F012-* |
| M9 TaskBoard | TC-G029-001~004 |

---

## Exit Criteria

v0.2.0 从 CONDITIONAL GO 升级为 GO 前，至少需要：

- [ ] P0 测试全部实现并通过
- [ ] P0 manual verification 项全部打勾
- [ ] P1 中与 Federation claim routing 相关测试通过，或明确降级为 v0.3.0 scope
- [ ] `docs/test-artifacts/ac-coverage-matrix-v0.2.0.md` 中 P0/P1 Missing 项归零
- [ ] `docs/manual-verification.md §P` 给出 GO 或 CONDITIONAL GO 决策
