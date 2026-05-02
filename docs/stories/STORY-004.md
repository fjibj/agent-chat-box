# STORY-004: WebSocket 服务器基础

**Epic:** EPIC-001 基础设施
**Sprint:** 1
**Points:** 5
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a developer, I want WebSocket endpoints for humans and daemons, so that real-time communication works.

---

## Acceptance Criteria

- [ ] /ws 端点（人类客户端）
- [ ] /daemon/connect 端点（Daemon）
- [ ] 消息信封解析（v, id, type, ts, data）
- [ ] ping/pong 心跳（30s/10s）
- [ ] 连接管理和清理
- [ ] 错误消息格式统一

---

## Technical Notes

**ws/handler.ts:**
```typescript
import { WebSocket } from 'ws';
import type { WSMessage } from '@agent-chat-box/shared';

interface Client {
  ws: WebSocket;
  type: 'human' | 'daemon';
  id: string;
  authenticated: boolean;
}

const clients = new Map<string, Client>();

export function handleConnection(ws: WebSocket, type: 'human' | 'daemon') {
  const clientId = generateId();
  const client: Client = { ws, type, id: clientId, authenticated: false };
  clients.set(clientId, client);

  ws.on('message', (data) => {
    const msg: WSMessage = JSON.parse(data.toString());
    handleMessage(client, msg);
  });

  ws.on('close', () => {
    clients.delete(clientId);
    handleDisconnect(client);
  });

  // 心跳
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    } else {
      clearInterval(pingInterval);
    }
  }, 30000);
}

function handleMessage(client: Client, msg: WSMessage) {
  if (!client.authenticated && msg.type !== 'auth.login' && msg.type !== 'machine.auth') {
    sendError(client, msg.id, 'AUTH_REQUIRED', 'Send auth first');
    return;
  }
  // 路由到具体处理函数
  router(msg.type, client, msg);
}

function sendError(client: Client, id: string | undefined, code: string, message: string) {
  client.ws.send(JSON.stringify({
    v: 1, id, type: 'error', ts: Date.now(),
    data: { code, message }
  }));
}
```

---

## Dependencies

- STORY-001, STORY-003

---

## Implementation Order

1. 安装 ws
2. 创建 ws/handler.ts
3. 实现消息信封解析
4. 实现心跳机制
5. 实现连接管理
6. 测试 WebSocket 连接
