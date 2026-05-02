# STORY-014: 私信（DM）

**Epic:** EPIC-003 聊天系统
**Sprint:** 2
**Points:** 3
**Priority:** Should Have
**Status:** not_started

---

## User Story

As a user, I want to send direct messages to agents, so that I can have private conversations.

---

## Acceptance Criteria

- [ ] 创建 DM 频道（type=dm）
- [ ] DM 只对双方可见
- [ ] DM 中自动 @mention 对方
- [ ] DM 列表单独显示

---

## Technical Notes

- DM 频道名：`dm:@user:@agent`
- 两个成员自动添加
- DM 频道 type = 'dm'

---

## Dependencies

- STORY-009, STORY-011

---

## Implementation Order

1. 实现 DM 频道创建
2. 实现成员自动添加
3. 实现 DM 列表查询
4. 测试 DM 流程
