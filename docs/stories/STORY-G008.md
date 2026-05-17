# STORY-G008: 邀请码与加入群

**Epic:** EPIC-002 群契约与成员管理
**Sprint:** 1
**Points:** 3
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a 团队 Owner, I want to 通过邀请码加入群, So that 我可以参与跨团队协作。

---

## Acceptance Criteria

- [ ] `POST /api/groups/:id/invite` — 生成邀请码（默认 24h 过期，max_uses=10）
- [ ] `POST /api/groups/join` — 通过邀请码加入群（body: { invite_code }）
- [ ] 邀请码过期检查（expires_at < now → 拒绝）
- [ ] 邀请码使用次数检查（uses >= max_uses → 拒绝）
- [ ] 重复加入检查（已在群中 → 拒绝）
- [ ] 加入成功后自动成为 group_members（role=member）
- [ ] 加入成功后 WebSocket 通知群成员 `group.joined`
- [ ] 群 Owner 可吊销邀请码（PATCH /api/groups/:id 设置 invite_code=NULL）

---

## Technical Notes

**邀请码生成:** UUID 截取前 8 位，大写字母+数字

**加入流程:**
1. 查找 groups WHERE invite_code = code
2. 检查过期、使用次数
3. 检查是否已在群中
4. 插入 group_members
5. 更新 invite_code_uses += 1
6. WebSocket 广播

---

## Dependencies

- STORY-G006（groups API）

---

## Implementation Order

1. 实现 POST /api/groups/:id/invite
2. 实现 POST /api/groups/join
3. 实现吊销逻辑
4. 测试：正常加入、过期码、满员、重复加入
