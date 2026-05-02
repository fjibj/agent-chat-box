# STORY-020: 任务协作（Collaborate 模式）

**Epic:** EPIC-004 任务系统
**Sprint:** 3
**Points:** 8
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a user, I want to decompose big tasks into subtasks for multiple agents, so that complex work can be done in parallel.

---

## Acceptance Criteria

- [ ] task.subtasks 创建子任务
- [ ] 子任务可指定 assignee 或留空
- [ ] 子任务独立跟踪状态
- [ ] 所有子任务完成后主任务自动 completed
- [ ] 主任务显示子任务进度（x/y 完成）

---

## Technical Notes

```typescript
export class TaskQueue {
  createSubtasks(parentTaskId: string, subtasks: SubtaskInput[]): Task[] {
    return subtasks.map(st => {
      const id = generateId();
      db.prepare(`
        INSERT INTO tasks (id, channel_id, title, description, mode, status, creator_id, assignee_id, parent_task_id)
        VALUES (?, ?, ?, ?, 'collaborate', ?, ?, ?, ?)
      `).run(id, st.channelId, st.title, st.description, st.assigneeId ? 'claimed' : 'pending',
        st.creatorId, st.assigneeId, parentTaskId);
      return this.get(id);
    });
  }

  checkParentCompletion(parentTaskId: string) {
    const incomplete = db.prepare(`
      SELECT COUNT(*) as count FROM tasks WHERE parent_task_id = ? AND status != 'completed'
    `).get(parentTaskId);

    if (incomplete.count === 0) {
      this.update(parentTaskId, { status: 'completed', output: 'All subtasks completed' });
    }
  }
}
```

---

## Dependencies

- STORY-018, STORY-019

---

## Implementation Order

1. 实现 task.subtasks 创建
2. 实现子任务状态跟踪
3. 实现父任务自动完成检查
4. 测试协作流程
