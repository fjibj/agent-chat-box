# STORY-024: Agent 驱动基类

**Epic:** EPIC-005 Agent 驱动
**Sprint:** 2
**Points:** 3
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a developer, I want a base agent driver class, so that all drivers follow the same interface.

---

## Acceptance Criteria

- [ ] BaseAgentDriver 抽象类
- [ ] 接口：detect(), start(), stop()
- [ ] AgentProcess 接口：onOutput, onComplete, onError
- [ ] 自动注册机制
- [ ] 错误处理基类

---

## Technical Notes

**daemon/agent-driver/base.ts:**
```typescript
export interface AgentProcess {
  id: string;
  status: 'running' | 'completed' | 'failed';
  onOutput(callback: (chunk: string) => void): void;
  onComplete(callback: (result: TaskResult) => void): void;
  onError(callback: (error: Error) => void): void;
  kill(): void;
}

export interface TaskResult {
  output: string;
  exitCode: number;
}

export abstract class BaseAgentDriver {
  abstract name: string;
  abstract binary: string;
  abstract capabilities: string[];

  abstract detect(): Promise<boolean>;
  abstract start(task: Task, context: string): Promise<AgentProcess>;

  protected spawnProcess(cmd: string, args: string[], env?: Record<string, string>): AgentProcess {
    const proc = spawn(cmd, args, { env: { ...process.env, ...env } });
    // ... 实现 onOutput, onComplete, onError
  }
}

// 驱动注册表
export const drivers: BaseAgentDriver[] = [];
export function registerDriver(driver: BaseAgentDriver) { drivers.push(driver); }
```

---

## Dependencies

- STORY-001

---

## Implementation Order

1. 定义 BaseAgentDriver 接口
2. 实现 AgentProcess 接口
3. 实现驱动注册机制
4. 实现 spawnProcess 基础方法
