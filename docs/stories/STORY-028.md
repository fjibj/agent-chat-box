# STORY-028: Hermes 驱动

**Epic:** EPIC-005 Agent 驱动
**Sprint:** 4
**Points:** 5
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a user, I want Hermes to execute tasks, so that I can use this coding agent.

---

## Acceptance Criteria

- [ ] 检测 hermes CLI
- [ ] 适配其通信协议
- [ ] 解析输出
- [ ] 错误处理

---

## Technical Notes

- 需调研 Hermes CLI 接口
- 可能需要适配不同版本

---

## Dependencies

- STORY-024

---

## Implementation Order

1. 调研 Hermes CLI 接口
2. 实现 HermesDriver 类
3. 测试任务执行
