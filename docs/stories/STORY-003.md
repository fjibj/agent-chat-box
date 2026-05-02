# STORY-003: Fastify HTTP 服务器基础

**Epic:** EPIC-001 基础设施
**Sprint:** 1
**Points:** 3
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a developer, I want a running HTTP server, so that the API and WebSocket can be accessed.

---

## Acceptance Criteria

- [ ] Fastify 服务器启动，监听可配置端口（默认 3000）
- [ ] CORS 配置
- [ ] 静态文件服务（Web UI build 产物）
- [ ] GET /api/version 返回版本号
- [ ] 错误处理中间件
- [ ] 请求日志

---

## Technical Notes

**src/index.ts:**
```typescript
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import path from 'path';

const PORT = parseInt(process.env.PORT || '3000');
const HOST = process.env.HOST || '0.0.0.0';

export async function createServer() {
  const app = Fastify({ logger: true });

  await app.register(fastifyCors);
  await app.register(fastifyStatic, {
    root: path.join(__dirname, '../../web/dist'),
    prefix: '/',
  });

  app.get('/api/version', () => ({ version: '1.0.0' }));

  await app.listen({ port: PORT, host: HOST });
  return app;
}
```

---

## Dependencies

- STORY-001

---

## Implementation Order

1. 安装 fastify, @fastify/cors, @fastify/static
2. 创建 src/index.ts
3. 配置路由
4. 测试启动和 /api/version
