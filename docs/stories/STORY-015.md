# STORY-015: 文件附件

**Epic:** EPIC-003 聊天系统
**Sprint:** 4
**Points:** 3
**Priority:** Should Have
**Status:** not_started

---

## User Story

As a user, I want to attach files to messages, so that I can share code and documents.

---

## Acceptance Criteria

- [ ] POST /api/uploads 上传文件
- [ ] 文件存储到 data/uploads/
- [ ] GET /api/uploads/:id 下载
- [ ] 消息中包含 attachments 数组
- [ ] 图片内联渲染
- [ ] 文件大小限制 10MB

---

## Technical Notes

```typescript
// POST /api/uploads
app.post('/api/uploads', async (req, res) => {
  const data = await req.file();
  const id = 'up_' + generateId();
  const filePath = path.join(UPLOAD_DIR, id);
  await fs.promises.writeFile(filePath, data.file);
  return { id, url: `/api/uploads/${id}`, name: data.filename, mime: data.mimetype, size: data.file.bytesRead };
});
```

---

## Dependencies

- STORY-011

---

## Implementation Order

1. 实现文件上传
2. 实现文件下载
3. 集成到消息附件
4. 测试上传下载
