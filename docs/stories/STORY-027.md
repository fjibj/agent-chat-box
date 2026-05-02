# STORY-027: OpenClaw 驱动

**Epic:** EPIC-005 Agent 驱动
**Sprint:** 4
**Points:** 5
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a user, I want OpenClaw to execute tasks, so that I can use this coding agent.

---

## Acceptance Criteria

- [ ] 检测 openclaw CLI
- [ ] 适配其通信协议
- [ ] 解析输出
- [ ] 错误处理

---

## Technical Notes

- 需调研 OpenClaw CLI 接口
- 可能需要适配不同版本
- 如果 CLI 不可用，标记为检测失败

---

## Dependencies

- STORY-024

---

## Implementation Order

1. 调研 OpenClaw CLI 接口
2. 实现 OpenClawDriver 类
3. 测试任务执行
