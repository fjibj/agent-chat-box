# STORY-035: 浏览器通知

**Epic:** EPIC-006 Web 管理界面
**Sprint:** 5
**Points:** 3
**Priority:** Should Have
**Status:** not_started

---

## User Story

As a user, I want browser notifications, so that I know when tasks complete or I'm mentioned.

---

## Acceptance Criteria

- [ ] 请求通知权限
- [ ] 任务完成通知
- [ ] @mention 通知
- [ ] 通知点击跳转

---

## Technical Notes

```typescript
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function showNotification(title: string, body: string, onClick?: () => void) {
  if (Notification.permission === 'granted') {
    const notification = new Notification(title, { body });
    notification.onclick = () => {
      window.focus();
      onClick?.();
      notification.close();
    };
  }
}
```

---

## Dependencies

- STORY-031

---

## Implementation Order

1. 实现权限请求
2. 实现通知推送
3. 实现点击跳转
