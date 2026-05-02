# STORY-006: Daemon 自动重连

**Epic:** EPIC-002 Agent 生命周期
**Sprint:** 2
**Points:** 3
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a user, I want daemons to automatically reconnect when disconnected, so that machines stay connected despite network issues.

---

## Acceptance Criteria

- [ ] WebSocket 断线后自动重连
- [ ] 指数退避：1s → 2s → 4s → 8s → 16s → 30s
- [ ] 重连后重新认证
- [ ] 重连后重新注册所有 Agent
- [ ] 连接状态日志
- [ ] 重连成功后重置退避计数

---

## Technical Notes

**daemon/connection.ts:**
```typescript
import WebSocket from 'ws';

const BACKOFF = [1000, 2000, 4000, 8000, 16000, 30000];
let attempt = 0;
let ws: WebSocket | null = null;

export function connect(serverUrl: string, apiKey: string) {
  ws = new WebSocket(`${serverUrl}/daemon/connect`);

  ws.on('open', () => {
    console.log('[daemon] Connected to server');
    attempt = 0;
    authenticate(apiKey);
  });

  ws.on('close', () => {
    console.log('[daemon] Disconnected, reconnecting...');
    scheduleReconnect(serverUrl, apiKey);
  });

  ws.on('error', (err) => {
    console.error('[daemon] WebSocket error:', err.message);
  });
}

function scheduleReconnect(serverUrl: string, apiKey: string) {
  const delay = BACKOFF[Math.min(attempt, BACKOFF.length - 1)];
  console.log(`[daemon] Reconnecting in ${delay}ms (attempt ${attempt + 1})`);
  attempt++;
  setTimeout(() => connect(serverUrl, apiKey), delay);
}
```

---

## Dependencies

- STORY-005

---

## Implementation Order

1. 实现连接函数
2. 实现指数退避
3. 实现重连后重新认证
4. 测试断线重连
