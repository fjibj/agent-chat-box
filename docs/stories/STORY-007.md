# STORY-007: 运行时检测

**Epic:** EPIC-002 Agent 生命周期
**Sprint:** 2
**Points:** 3
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a user, I want the daemon to detect which agent CLIs are installed, so that the server knows available runtimes.

---

## Acceptance Criteria

- [ ] 检测 claude, codex, openclaw, hermes 二进制
- [ ] 获取版本号
- [ ] 检测结果报告给服务器
- [ ] 检测失败不阻断启动
- [ ] 超时 5 秒

---

## Technical Notes

**daemon/runtime-detector.ts:**
```typescript
import { execSync } from 'child_process';

interface RuntimeInfo {
  name: string;
  binary: string;
  version: string;
  available: boolean;
}

const RUNTIMES = [
  { name: 'claude', binary: 'claude', versionCmd: 'claude --version' },
  { name: 'codex', binary: 'codex', versionCmd: 'codex --version' },
  { name: 'openclaw', binary: 'openclaw', versionCmd: 'openclaw --version' },
  { name: 'hermes', binary: 'hermes', versionCmd: 'hermes --version' },
];

export async function detectRuntimes(): Promise<RuntimeInfo[]> {
  return Promise.all(RUNTIMES.map(async (rt) => {
    try {
      const version = execSync(rt.versionCmd, { timeout: 5000 }).toString().trim();
      return { ...rt, version, available: true };
    } catch {
      return { ...rt, version: '', available: false };
    }
  }));
}
```

---

## Dependencies

- STORY-006

---

## Implementation Order

1. 实现运行时检测函数
2. 实现版本号解析
3. 集成到 Daemon 启动流程
4. 测试检测结果
