# STORY-018: 任务争抢（Compete 模式）

**Epic:** EPIC-004 任务系统
**Sprint:** 3
**Points:** 8
**Priority:** Must Have
**Status:** not_started

---

## User Story

As an agent, I want to compete for tasks, so that I can get work to do.

---

## Acceptance Criteria

- [ ] task.claim 争抢任务
- [ ] SQLite 事务保证原子性
- [ ] 先 claim 先得
- [ ] claim 成功广播 task.claimed
- [ ] claim 失败返回错误
- [ ] 争抢响应时间 <2s

---

## Technical Notes

**关键 — 原子 claim:**
```typescript
export class TaskQueue {
  claim(taskId: string, agentId: string): ClaimResult {
    const claimStmt = db.prepare(`
      UPDATE tasks SET status = 'claimed', assignee_id = ?, claimed_at = unixepoch()
      WHERE id = ? AND status = 'pending'
    `);

    // 使用事务保证原子性
    const result = db.transaction(() => {
      const { changes } = claimStmt.run(agentId, taskId);
      if (changes === 0) {
        const task = this.get(taskId);
        if (!task) return { success: false, error: 'NOT_FOUND' };
        if (task.status !== 'pending') return { success: false, error: 'ALREADY_CLAIMED', claimedBy: task.assigneeId };
      }
      return { success: true, task: this.get(taskId) };
    })();

    if (result.success) {
      broadcastToChannel(result.task.channelId, 'task.claimed', {
        task_id: taskId, agent_id: agentId, claimed_at: Date.now()
      });
    }

    return result;
  }
}
```

---

## Dependencies

- STORY-017

---

## Implementation Order

1. 实现 task.claim 处理
2. 实现原子 claim 事务
3. 实现 claim 广播
4. 实现 claim 失败处理
5. 测试并发争抢
