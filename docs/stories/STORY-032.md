# STORY-032: 任务看板

**Epic:** EPIC-006 Web 管理界面
**Sprint:** 5
**Points:** 8
**Priority:** Must Have
**Status:** not_started

---

## User Story

As a user, I want a task board, so that I can see all tasks and their status.

---

## Acceptance Criteria

- [ ] 三列看板：待领取 / 进行中 / 已完成
- [ ] 任务卡片：标题、优先级、Agent、进度
- [ ] 筛选：优先级、标签、Agent
- [ ] 搜索
- [ ] 点击查看详情
- [ ] 创建任务按钮

---

## Technical Notes

**布局:**
```
┌─────────────────────────────────────────────────────────┐
│ [+ 新建任务]  [筛选▼]  [搜索...]                        │
├─────────────────┬─────────────────┬─────────────────────┤
│ 待领取 (3)      │ 进行中 (2)      │ 已完成 (5)          │
│ ┌─────────────┐ │ ┌─────────────┐ │ ┌─────────────┐     │
│ │ 🔥 优化登录 │ │ │ 🤖 Claude-1 │ │ │ ✅ API重构  │     │
│ │ 竞争模式    │ │ │ 进度: 60%   │ │ │ 2h前完成    │     │
│ │ [领取]      │ │ │ [详情]      │ │ │ [详情]      │     │
│ └─────────────┘ │ └─────────────┘ │ └─────────────┘     │
└─────────────────┴─────────────────┴─────────────────────┘
```

**组件:**
- TaskBoard.tsx
- TaskCard.tsx
- TaskDetail.tsx
- CreateTask.tsx

---

## Dependencies

- STORY-030, STORY-017

---

## Implementation Order

1. 实现看板布局
2. 实现任务卡片
3. 实现筛选搜索
4. 实现任务详情
5. 实现创建任务
