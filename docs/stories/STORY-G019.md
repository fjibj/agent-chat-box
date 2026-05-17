# STORY-G019: 过程隐私保护

**Epic:** EPIC-004 跨团队 Review
**Sprint:** 3
**Points:** 3
**Priority:** Should Have
**Status:** not_started

---

## User Story

As a 外部 Agent Owner, I want to 我的执行过程不被暴露, So that 我的工具链和策略保持私密。

---

## Acceptance Criteria

- [ ] visibility.internal_log=false 时，外部 Agent 的内部日志不暴露给任务发布者
- [ ] 任务详情 API 检查 is_group_task + visibility 配置
- [ ] 外部 Agent 的 execution_log 不返回给任务发布者
- [ ] 只返回最终 output
- [ ] 外部 Agent 的内部日志对其自己的 Owner 可见

---

## Technical Notes

**修改文件:**
- `packages/server/src/api/tasks.ts` — 任务详情端点添加 visibility 检查

**检查逻辑:**
```typescript
if (task.is_group_task) {
  const contract = getGroupContract(task.group_id);
  if (!contract.visibility.internal_log) {
    // 不返回 execution_log 字段
    delete task.executionLog;
  }
}
```

**注意:** 当前 tasks 表没有 execution_log 字段，此功能为未来扩展预留。现阶段确保 output 只包含最终结果。

---

## Dependencies

- STORY-G007（群契约 visibility 配置）

---

## Implementation Order

1. 修改任务详情 API 添加 visibility 检查
2. 确保群任务 output 只包含最终结果
3. 测试：internal_log=false 时不暴露内部日志
