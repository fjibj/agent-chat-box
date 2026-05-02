# STORY-025: Claude Code 驱动

**Epic:** EPIC-005 Agent 驱动
**Sprint:** 3
**Points:** 5
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a user, I want Claude Code to execute tasks, so that I can use Claude for coding.

---

## Acceptance Criteria

- [ ] 检测 claude CLI
- [ ] 启动：claude --print --output-format stream-json
- [ ] 解析流式 JSON 输出
- [ ] 任务上下文作为 prompt 传入
- [ ] 错误处理和超时

---

## Technical Notes

**daemon/agent-driver/claude-code.ts:**
```typescript
export class ClaudeCodeDriver extends BaseAgentDriver {
  name = 'claude';
  binary = 'claude';
  capabilities = ['code', 'analysis', 'general'];

  async detect(): Promise<boolean> {
    try {
      execSync('claude --version', { timeout: 5000 });
      return true;
    } catch { return false; }
  }

  async start(task: Task, context: string): Promise<AgentProcess> {
    const prompt = `Task: ${task.title}\n\n${task.description}\n\nContext:\n${context}`;
    return this.spawnProcess('claude', ['--print', '--output-format', 'stream-json', '--prompt', prompt]);
  }
}
```

---

## Dependencies

- STORY-024

---

## Implementation Order

1. 实现 ClaudeCodeDriver 类
2. 实现 stream-json 解析
3. 测试任务执行
