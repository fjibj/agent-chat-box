# STORY-026: Codex 驱动

**Epic:** EPIC-005 Agent 驱动
**Sprint:** 4
**Points:** 5
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a user, I want Codex to execute tasks, so that I can use OpenAI's coding agent.

---

## Acceptance Criteria

- [ ] 检测 codex CLI
- [ ] 启动：codex --quiet
- [ ] 解析 stdout 输出
- [ ] 任务上下文传入
- [ ] 错误处理

---

## Technical Notes

```typescript
export class CodexDriver extends BaseAgentDriver {
  name = 'codex';
  binary = 'codex';
  capabilities = ['code', 'general'];

  async detect(): Promise<boolean> {
    try { execSync('codex --version', { timeout: 5000 }); return true; }
    catch { return false; }
  }

  async start(task: Task, context: string): Promise<AgentProcess> {
    const prompt = `Task: ${task.title}\n\n${task.description}\n\n${context}`;
    return this.spawnProcess('codex', ['--quiet', prompt]);
  }
}
```

---

## Dependencies

- STORY-024

---

## Implementation Order

1. 实现 CodexDriver 类
2. 测试任务执行
