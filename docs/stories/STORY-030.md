# STORY-030: Web UI 基础框架

**Epic:** EPIC-006 Web 管理界面
**Sprint:** 5
**Points:** 3
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a user, I want a web interface, so that I can manage the platform from a browser.

---

## Acceptance Criteria

- [ ] React + Vite + Tailwind 项目搭建
- [ ] WebSocket 连接 hook
- [ ] 路由配置
- [ ] 全局状态管理
- [ ] 深色主题
- [ ] 响应式布局

---

## Technical Notes

**web/src/hooks/useWebSocket.ts:**
```typescript
export function useWebSocket(url: string) {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = new WebSocket(url);
    socket.onopen = () => setConnected(true);
    socket.onclose = () => setConnected(false);
    socket.onmessage = (e) => handleMessage(JSON.parse(e.data));
    setWs(socket);
    return () => socket.close();
  }, [url]);

  return { ws, connected };
}
```

**路由:**
- / → 聊天
- /tasks → 任务看板
- /agents → Agent 管理
- /settings → 设置

---

## Dependencies

- STORY-003

---

## Implementation Order

1. 初始化 React + Vite + Tailwind
2. 实现 WebSocket hook
3. 配置路由
4. 实现深色主题
5. 测试基础框架
