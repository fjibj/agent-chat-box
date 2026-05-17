# STORY-G007: 群契约配置

**Epic:** EPIC-002 群契约与成员管理
**Sprint:** 1
**Points:** 3
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a 群 Owner, I want to 查看和编辑群契约配置, So that 我可以定义群内协作规则。

---

## Acceptance Criteria

- [ ] `GET /api/groups/:id/contract` — 获取契约（返回 YAML 解析后的 JSON）
- [ ] `PATCH /api/groups/:id/contract` — 更新契约（传 JSON，存储为 YAML）
- [ ] 默认契约包含：shared_capabilities, resource_quota, authorization, trust_threshold, visibility
- [ ] 更新契约后 WebSocket 通知所有群成员 `group.contract.updated`
- [ ] 契约验证：authorization 只能是 'auto' 或 'manual'，trust_threshold 0-1，visibility 布尔值
- [ ] 只有群 Owner 可编辑契约

---

## Technical Notes

**依赖:** `js-yaml` 库（YAML 解析/序列化）

**修改文件:** `packages/server/src/api/groups.ts`

**契约 JSON Schema:**
```typescript
interface GroupContract {
  shared_capabilities: string[];
  resource_quota: {
    max_tasks_per_hour: number;
    max_retry_per_task: number;
  };
  authorization: 'auto' | 'manual';
  trust_threshold: number; // 0-1
  visibility: {
    task_input: boolean;
    task_output: boolean;
    internal_log: boolean;
  };
}
```

---

## Dependencies

- STORY-G006（groups API）

---

## Implementation Order

1. 添加 js-yaml 依赖
2. 实现 GET /api/groups/:id/contract
3. 实现 PATCH /api/groups/:id/contract
4. 实现契约验证逻辑
5. 实现 WebSocket 通知
6. 测试
