# STORY-G023: 群管理页面

**Epic:** EPIC-006 群管理 UI
**Sprint:** 3
**Points:** 5
**Priority:** Should Have
**Status:** not_started

---

## User Story

As a 团队 Owner, I want to 通过 UI 管理群, So that 我不需要编辑 YAML 文件。

---

## Acceptance Criteria

- [ ] 群列表页 `/groups`：显示已加入的群（名称、成员数、我的角色、契约模式）
- [ ] 群详情页 `/groups/:id`：契约配置、成员列表、邀请码
- [ ] 创建群表单：名称、描述
- [ ] 加入群入口：输入邀请码
- [ ] 契约编辑表单：
  - shared_capabilities: 多选输入
  - resource_quota.max_tasks_per_hour: 数字输入
  - resource_quota.max_retry_per_task: 数字输入
  - authorization: 单选（auto/manual）
  - trust_threshold: 滑块（0-1）
  - visibility.task_input: 开关
  - visibility.task_output: 开关
  - visibility.internal_log: 开关
- [ ] 邀请码显示 + 复制按钮 + 生成/吊销按钮

---

## Technical Notes

**技术栈:** React + TypeScript + Tailwind CSS + shadcn/ui

**路由:** `/groups`, `/groups/:id`

**组件:**
- GroupListPage
- GroupDetailPage
- GroupCreateForm
- ContractEditor
- InviteCodeManager
- GroupMemberList

---

## Dependencies

- STORY-G006（groups API）
- STORY-G007（契约 API）
- STORY-G008（邀请码 API）

---

## Implementation Order

1. 创建路由配置
2. 实现 GroupListPage
3. 实现 GroupCreateForm
4. 实现 GroupDetailPage
5. 实现 ContractEditor
6. 实现 InviteCodeManager
7. 实现 GroupMemberList
8. 测试
