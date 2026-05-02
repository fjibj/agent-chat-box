# STORY-034: 设置页面

**Epic:** EPIC-006 Web 管理界面
**Sprint:** 5
**Points:** 3
**Priority:** Should Have
**Status:** not_started

---

## User Story

As a user, I want a settings page, so that I can configure the server and see connection info.

---

## Acceptance Criteria

- [ ] 服务器信息（地址、端口）
- [ ] Daemon 连接命令（可复制）
- [ ] API Key 管理
- [ ] 数据库路径

---

## Technical Notes

- 只读设置为主
- 复制按钮使用 navigator.clipboard

---

## Dependencies

- STORY-030

---

## Implementation Order

1. 实现设置页面布局
2. 实现信息展示
3. 实现复制功能
