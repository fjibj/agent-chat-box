# STORY-021: 任务超时与重试

**Epic:** EPIC-004 任务系统
**Sprint:** 4
**Points:** 5
**Priority:** Should Have
**Status:** not_started

---

## User Story

As a user, I want tasks to timeout if not completed, so that stuck tasks don't block the queue.

---

## Acceptance Criteria

- [ ] 任务可设置 timeout_seconds（默认 3600）
- [ ] 定时检查超时任务（每 10s）
- [ ] 超时后状态变为 failed
- [ ] 可配置 max_retries
- [ ] 重试时重置为 pending

---

## Technical Notes

```typescript
// 定时器
setInterval(() => {
  const expired = db.prepare(`
    SELECT * FROM tasks
    WHERE status IN ('claimed', 'running')
    AND claimed_at + timeout_seconds < unixepoch()
  `).all();

  for (const task of expired) {
    if (task.retry_count < task.max_retries) {
      db.prepare(`
        UPDATE tasks SET status = 'pending', assignee_id = NULL, retry_count = retry_count + 1
        WHERE id = ?
      `).run(task.id);
      broadcastToChannel(task.channel_id, 'task.retried', { task_id: task.id });
    } else {
      taskQueue.update(task.id, { status: 'failed', output: 'Timeout' });
    }
  }
}, 10000);
```

---

## Dependencies

- STORY-019

---

## Implementation Order

1. 实现超时检查定时器
2. 实现重试逻辑
3. 测试超时和重试
