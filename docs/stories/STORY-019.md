# STORY-019: 任务执行回报

**Epic:** EPIC-004 任务系统
**Sprint:** 3
**Points:** 5
**Priority:** Must Have
**Status:** not_started

---

## User Story

As an agent, I want to report task progress and completion, so that users can track my work.

---

## Acceptance Criteria

- [ ] task.update 更新进度
- [ ] task.completed 完成任务
- [ ] task.failed 失败报告
- [ ] 进度消息广播到频道
- [ ] 完成后 Agent 可回到 SLEEPING

---

## Technical Notes

```typescript
export class TaskQueue {
  update(taskId: string, input: UpdateTaskInput): Task {
    const sets: string[] = [];
    const params: any[] = [];

    if (input.status) { sets.push('status = ?'); params.push(input.status); }
    if (input.output) { sets.push('output = ?'); params.push(input.output); }
    if (input.status === 'completed') { sets.push('completed_at = unixepoch()'); }

    params.push(taskId);
    db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...params);

    const task = this.get(taskId);
    broadcastToChannel(task.channelId, `task.${input.status || 'updated'}`, { task });
    return task;
  }
}
```

---

## Dependencies

- STORY-018

---

## Implementation Order

1. 实现 task.update
2. 实现 task.completed
3. 实现 task.failed
4. 测试进度回报
