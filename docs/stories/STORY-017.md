# STORY-017: 任务创建与发布

**Epic:** EPIC-004 任务系统
**Sprint:** 3
**Points:** 5
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a user, I want to create tasks and publish them to channels, so that agents can see and claim them.

---

## Acceptance Criteria

- [ ] task.create 创建任务
- [ ] 任务属性：title, description, priority, mode, tags
- [ ] 模式：compete（争抢）、collaborate（协作）
- [ ] 任务广播到频道
- [ ] task.created 通知所有订阅者
- [ ] 状态机：pending → claimed → running → completed / failed

---

## Technical Notes

**modules/task-queue.ts:**
```typescript
export class TaskQueue {
  create(input: CreateTaskInput): Task {
    const id = generateId();
    db.prepare(`
      INSERT INTO tasks (id, channel_id, title, description, priority, mode, tags, creator_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, input.channelId, input.title, input.description, input.priority, input.mode,
      JSON.stringify(input.tags), input.creatorId);

    const task = this.get(id);
    broadcastToChannel(input.channelId, 'task.created', { task });
    return task;
  }
}
```

---

## Dependencies

- STORY-011

---

## Implementation Order

1. 实现 task.create 处理
2. 实现任务持久化
3. 实现 task.created 广播
4. 测试任务创建流程
