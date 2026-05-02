# STORY-005: 机器注册与认证

**Epic:** EPIC-002 Agent 生命周期
**Sprint:** 1
**Points:** 5
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a user, I want to register machines with API keys, so that daemons can authenticate when connecting.

---

## Acceptance Criteria

- [ ] POST /api/machines 创建机器，返回 API Key
- [ ] API Key 格式：`sk_` + 32 字节 base64url
- [ ] API Key 存储为 scrypt 哈希
- [ ] GET /api/machines 列表（不含 key）
- [ ] DELETE /api/machines/:id 删除
- [ ] Daemon 通过 machine.auth 消息认证
- [ ] 认证成功返回 machine.welcome

---

## Technical Notes

**api/machines.ts:**
```typescript
import crypto from 'crypto';

function generateApiKey(): string {
  return 'sk_' + crypto.randomBytes(32).toString('base64url');
}

function hashApiKey(key: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(key, salt, 64);
  return salt.toString('hex') + ':' + hash.toString('hex');
}

// POST /api/machines
app.post('/api/machines', async (req, res) => {
  const { name } = req.body;
  const id = generateId();
  const apiKey = generateApiKey();
  const apiKeyHash = hashApiKey(apiKey);
  db.prepare('INSERT INTO machines (id, name, api_key_hash) VALUES (?, ?, ?)').run(id, name, apiKeyHash);
  return { id, name, apiKey }; // 只返回一次
});
```

**ws/daemon-handler.ts:**
```typescript
function handleMachineAuth(client: Client, msg: WSMessage) {
  const { machine_token } = msg.data;
  const machine = verifyApiKey(machine_token);
  if (!machine) {
    sendError(client, msg.id, 'AUTH_INVALID', 'Invalid API key');
    client.ws.close();
    return;
  }
  client.authenticated = true;
  client.machineId = machine.id;
  send(client, msg.id, 'machine.welcome', { machine_id: machine.id });
}
```

---

## Dependencies

- STORY-002, STORY-004

---

## Implementation Order

1. 实现 API Key 生成和哈希
2. 实现 POST /api/machines
3. 实现 GET /api/machines
4. 实现 DELETE /api/machines/:id
5. 实现 machine.auth 处理
6. 测试完整流程
