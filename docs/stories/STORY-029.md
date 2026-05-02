# STORY-029: 进程管理器

**Epic:** EPIC-005 Agent 驱动
**Sprint:** 4
**Points:** 5
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a daemon, I want to manage agent processes, so that tasks are executed reliably.

---

## Acceptance Criteria

- [ ] spawn 子进程
- [ ] 流式输出捕获
- [ ] 进程状态跟踪
- [ ] 超时强制终止
- [ ] crash recovery
- [ ] 同时运行多个 Agent 进程

---

## Technical Notes

**daemon/process-manager.ts:**
```typescript
export class ProcessManager {
  private processes = new Map<string, AgentProcess>();

  async start(agentId: string, driver: BaseAgentDriver, task: Task, context: string): Promise<string> {
    const process = await driver.start(task, context);
    this.processes.set(process.id, process);

    process.onOutput((chunk) => {
      // 发送到服务器
      ws.send({ type: 'task.progress', data: { task_id: task.id, chunk } });
    });

    process.onComplete((result) => {
      this.processes.delete(process.id);
      ws.send({ type: 'task.completed', data: { task_id: task.id, output: result.output } });
    });

    process.onError((error) => {
      this.processes.delete(process.id);
      ws.send({ type: 'task.failed', data: { task_id: task.id, error: error.message } });
    });

    return process.id;
  }

  kill(processId: string) {
    const proc = this.processes.get(processId);
    proc?.kill();
    this.processes.delete(processId);
  }

  killAll() {
    for (const [id] of this.processes) this.kill(id);
  }
}
```

---

## Dependencies

- STORY-024

---

## Implementation Order

1. 实现 ProcessManager 类
2. 实现进程跟踪
3. 实现超时终止
4. 实现 crash recovery
5. 测试多进程并发
