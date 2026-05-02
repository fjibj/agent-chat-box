# STORY-022: Agent 能力匹配

**Epic:** EPIC-004 任务系统
**Sprint:** 4
**Points:** 3
**Priority:** Should Have
**Status:** not_started

---

## User Story

As a user, I want tasks to only be claimable by agents with matching capabilities, so that the right agent does the right work.

---

## Acceptance Criteria

- [ ] 任务可设置 required_capabilities
- [ ] Agent 声明自己的 capabilities
- [ ] claim 时校验能力匹配
- [ ] 不匹配返回错误

---

## Technical Notes

```typescript
claim(taskId: string, agentId: string): ClaimResult {
  const task = this.get(taskId);
  if (task.requiredCapabilities?.length > 0) {
    const agent = agentReg.get(agentId);
    const hasAll = task.requiredCapabilities.every(cap => agent.capabilities.includes(cap));
    if (!hasAll) {
      return { success: false, error: 'CAPABILITY_MISMATCH' };
    }
  }
  // ... 原子 claim
}
```

---

## Dependencies

- STORY-018

---

## Implementation Order

1. 实现能力校验逻辑
2. 测试能力匹配
