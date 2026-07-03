# STORY-F011: Federation Peers 状态面板

**Epic:** EPIC-F03 联邦可观测性 Follow-up
**Sprint:** v0.2.0 Follow-up
**Points:** 3
**Priority:** Should Have
**Status:** ready

---

## User Story

As a 群主团队管理员, I want to 在 Web UI 中查看联邦 Runner 连接状态, So that 我可以判断跨团队协作网络是否健康。

---

## Acceptance Criteria

### Functional AC

- [ ] **AC-01:** 新增 Federation Peers 面板，可位于 Groups 详情或 Settings 页面。
- [ ] **AC-02:** 面板显示每个 peer 的 team name、team id、group id、status、labels、last_heartbeat、connected_at。
- [ ] **AC-03:** status 支持 connected / disconnected / error 三种视觉映射。
- [ ] **AC-04:** last_heartbeat 显示相对时间（如 30s ago）。
- [ ] **AC-05:** 断连 peer 显示原因（如 heartbeat_timeout / ws_close，如后端可提供）。
- [ ] **AC-06:** 面板支持手动 Refresh。
- [ ] **AC-07:** 无 peer 时显示空状态提示。

### UI Entry Points

- [ ] **UI-01 Page:** GroupsPage 群详情中的 Federation Peers 区域，或 SettingsPage。
- [ ] **UI-02 Trigger:** Refresh 按钮。
- [ ] **UI-03 Empty state:** No federation peers connected。
- [ ] **UI-04 Error state:** 加载失败时显示错误提示。

### State Mapping

| State field | State value | Badge text | Badge color | Board/List grouping | Detail view | Test case |
|-------------|-------------|------------|-------------|---------------------|-------------|-----------|
| federation_peers.status | connected | Connected | green | Peers list | ✅ | TC-F011-001 |
| federation_peers.status | disconnected | Disconnected | gray | Peers list | ✅ | TC-F011-002 |
| federation_peers.status | error | Error | red | Peers list | ✅ | TC-F011-003 |

### Testability

- [ ] **TEST-01:** API 测试覆盖 federation_peers 列表查询。
- [ ] **TEST-02:** UI 测试覆盖 connected/disconnected/error badge。
- [ ] **TEST-03:** manual-verification M8.1~M8.4 通过。

---

## Technical Notes

**可能新增 API:**
- `GET /api/federation/peers?group_id=...`

**修改文件:**
- `packages/server/src/federation/hub.ts` 或新增 API 文件
- `packages/web/src/pages/GroupsPage.tsx`
- `packages/web/src/pages/SettingsPage.tsx`（可选）

---

## Dependencies

- STORY-F001~F005（联邦基础注册、心跳、Runner）
- STORY-F007（poll 模式）

---

## Traceability

- Related GAP: GAP-10
- Manual verification: M8.1~M8.4
- AC Coverage Matrix: Federation UI observability
