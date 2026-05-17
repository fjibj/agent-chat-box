# Test Case Inventory

**Project:** Agent Chat Box — 群级扩展
**Stories:** STORY-G001 ~ STORY-G026
**Date:** 2026-05-15

---

## Legend

| Type | Symbol | Execution |
|------|--------|-----------|
| Unit | UT | `vitest run` |
| Integration | IT | `vitest run` with DB |
| E2E | E2E | `playwright test` |

---

## P0 — Critical

### TC-G001-001 [UT] Migration v4→v5 creates teams and team_members tables
**Pre:** DB at v4 with existing machines/agents  
**Action:** Run `migrate(db)`  
**Expected:** `teams` and `team_members` tables exist; default team created; all machines/agents linked

### TC-G001-002 [IT] Migration is idempotent
**Pre:** DB already at v5  
**Action:** Run `migrate(db)` again  
**Expected:** No errors; no duplicate default team

### TC-G005-001 [UT] Migration v5→v6 creates groups and group_members
**Pre:** DB at v5  
**Action:** Run migrate  
**Expected:** `groups` and `group_members` tables exist with indexes

### TC-G010-001 [UT] Migration v6→v7 adds group_tasks and authorization_requests
**Pre:** DB at v6  
**Action:** Run migrate  
**Expected:** Tables exist; `tasks` has `is_group_task` and `source_team_id` columns

### TC-G011-001 [IT] Publish group task with invalid capability fails
**Pre:** Group contract shared_capabilities = ["code", "review"]  
**Action:** POST `/api/groups/{gid}/tasks` with required_capabilities = ["deploy"]  
**Expected:** 400 Bad Request, error mentions invalid capability

### TC-G011-002 [IT] Publish group task by non-member fails
**Pre:** Team A not in group  
**Action:** POST `/api/groups/{gid}/tasks` with source_team_id = Team A  
**Expected:** 403 Forbidden

### TC-G012-001 [UT] Group broadcast maps update on join/leave
**Pre:** groupTeams empty  
**Action:** Team joins group, then leaves  
**Expected:** groupTeams[groupId] contains teamId after join, empty after leave

### TC-G012-002 [IT] Broadcast latency under 5s for 50 teams
**Pre:** 50 teams in group, each with 1 connected agent  
**Action:** Publish group task  
**Expected:** All 50 agents receive `group.task.created` within 5000ms

### TC-G013-001 [IT] Concurrent claim race — only one wins
**Pre:** 1 pending group task  
**Action:** Two agents claim simultaneously (parallel requests)  
**Expected:** One returns success + auth_request_id; other returns ALREADY_CLAIMED or 400

### TC-G013-002 [IT] Claim without capability match fails
**Pre:** Task requires "review"; agent only has "code"  
**Action:** POST `/api/tasks/{tid}/group-claim`  
**Expected:** 400 Bad Request, error_code = CAPABILITY_MISMATCH

### TC-G014-001 [IT] Approve authorization sets task to claimed
**Pre:** Pending auth request exists  
**Action:** POST `/api/authorizations/{id}/approve`  
**Expected:** task.status = claimed; assignee_id set; group_tasks.authorization_status = approved

### TC-G014-002 [IT] Reject authorization resets task to pending
**Pre:** Pending auth request exists  
**Action:** POST `/api/authorizations/{id}/reject`  
**Expected:** task.status = pending; group_tasks.authorization_status = rejected

### TC-G014-003 [IT] Expired authorization auto-resets task
**Pre:** Auth request with expires_at in past  
**Action:** Run `checkExpiredAuthorizations()`  
**Expected:** Request status = expired; task.status = pending

### TC-G016-001 [IT] Failed group task returns to pool after max retries
**Pre:** Group task with max_retries=0, claimed and failed  
**Action:** Update task status to failed  
**Expected:** task.status = pending; group_tasks.authorization_status = none

### TC-G016-002 [IT] Agent disconnect releases claimed group tasks
**Pre:** Agent has claimed group task  
**Action:** Close WebSocket connection  
**Expected:** Task status reset to pending within disconnect handler

---

## P1 — High

### TC-G002-001 [IT] Create team sets current user as owner
**Action:** POST `/api/teams` with user_id  
**Expected:** Response includes owner_user_id; team_members has owner role

### TC-G002-002 [IT] Delete team with agents fails
**Pre:** Team has agents  
**Action:** DELETE `/api/teams/{id}`  
**Expected:** 400 Bad Request

### TC-G003-001 [IT] Agent auto-assigned to machine's team on register
**Pre:** Machine has team_id = T1  
**Action:** Daemon registers agent  
**Expected:** Agent.team_id = T1

### TC-G003-002 [IT] Switching agent team updates old team
**Pre:** Agent in T1  
**Action:** POST `/api/teams/{id}/agents/{aid}` for T2  
**Expected:** Agent.team_id = T2; no longer in T1 list

### TC-G006-001 [IT] Create group auto-adds owner team
**Action:** POST `/api/groups`  
**Expected:** group_members contains owner_team_id with role=owner

### TC-G007-001 [UT] Contract validation rejects invalid authorization value
**Action:** PATCH contract with authorization = "hybrid"  
**Expected:** 400 Bad Request

### TC-G007-002 [UT] Contract trust_threshold out of range rejected
**Action:** PATCH contract with trust_threshold = 1.5  
**Expected:** 400 Bad Request

### TC-G008-001 [IT] Expired invite code rejected
**Pre:** invite_code_expires_at in past  
**Action:** POST `/api/groups/join` with expired code  
**Expected:** 400 Bad Request, "expired"

### TC-G008-002 [IT] Max uses invite code rejected after limit
**Pre:** invite_code_max_uses = 1, already used once  
**Action:** POST `/api/groups/join` with same code  
**Expected:** 400 Bad Request, "maximum uses"

### TC-G015-001 [IT] Auto mode approves high-reputation team
**Pre:** Group auth=auto, trust_threshold=2, team reputation=3  
**Action:** Claim group task  
**Expected:** Auto-approved; task.status = claimed directly

### TC-G015-002 [IT] Auto mode falls back to manual for low reputation
**Pre:** Group auth=auto, trust_threshold=5, team reputation=1  
**Action:** Claim group task  
**Expected:** Returns pending_authorization; auth request created

### TC-G017-001 [IT] Completed group task sends review.requested
**Pre:** Group task completed, visibility.task_output = true, has parent task  
**Action:** Update task status to completed  
**Expected:** WebSocket `review.requested` broadcast to group

### TC-G017-002 [IT] Output suppressed when visibility.task_output = false
**Pre:** Contract has task_output = false  
**Action:** Complete group task  
**Expected:** No review.requested with output payload sent

### TC-G018-001 [IT] Review approved adds +1 reputation
**Pre:** Team has 0 reputation  
**Action:** POST `/api/tasks/{tid}/review` with approved  
**Expected:** reputation_records has +1 entry

### TC-G018-002 [IT] Review rejected returns task to pool
**Pre:** Task completed by external team  
**Action:** POST `/api/tasks/{tid}/review` with rejected  
**Expected:** task.status = pending; reputation_records has -2 entry

---

## P2 — Medium

### TC-G004-001 [IT] Cannot remove team owner
**Pre:** Member with role=owner  
**Action:** DELETE `/api/teams/{id}/members/{uid}`  
**Expected:** 400 Bad Request

### TC-G009-001 [IT] Leaving group resets pending tasks
**Pre:** Team has claimed pending group task  
**Action:** POST `/api/groups/{id}/leave`  
**Expected:** Task status reset to pending

### TC-G019-001 [IT] Task detail hides execution_log when internal_log=false
**Pre:** Contract visibility.internal_log = false  
**Action:** GET `/api/tasks/{id}`  
**Expected:** Response does not contain execution_log field

### TC-G020-001 [UT] Record reputation with invalid event_type fails
**Action:** recordReputation with event_type = "invalid"  
**Expected:** DB CHECK constraint error or handled rejection

### TC-G021-001 [IT] Reputation query returns correct aggregation
**Pre:** 3 records: +1, +1, -1 for same team/group  
**Action:** GET `/api/groups/{gid}/reputation/{tid}`  
**Expected:** total_score = 1, event_count = 3

### TC-G022-001 [UT] checkThreshold boundary at exact value
**Pre:** Score = 5, threshold = 5  
**Action:** checkThreshold(team, group, 5)  
**Expected:** true

### TC-G022-002 [UT] checkThreshold below threshold returns false
**Pre:** Score = 4, threshold = 5  
**Expected:** false

---

## P3 — Low

### TC-G023-001 [E2E] Groups page renders list and detail
**Action:** Navigate to /groups  
**Expected:** Group list visible; clicking group shows detail with members and contract editor

### TC-G024-001 [E2E] Task board shows group task tabs
**Action:** Navigate to /tasks  
**Expected:** "Internal" and "Group" tabs visible; group tasks show source team badge

### TC-G025-001 [E2E] Authorization page shows countdown
**Pre:** Pending auth request with <1min remaining  
**Action:** Navigate to /authorizations  
**Expected:** Timer displayed in red

### TC-G026-001 [E2E] Reputation badge color mapping
**Pre:** Team with scores 5, 2, -1  
**Action:** View group members list  
**Expected:** 5 = green, 2 = yellow, -1 = red
