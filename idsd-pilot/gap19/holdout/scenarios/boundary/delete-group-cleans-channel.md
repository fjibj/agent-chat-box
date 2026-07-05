# 边界场景：解散群清理自动创建的频道

## 操作
1. 启动 dev server。
2. 创建群并记录返回的 `channel_id`。
3. 调用 `DELETE /api/groups/:id` 解散该群。
4. 查询 `channels` 和 `channel_members` 表。

## 期望
- 解散成功，返回 `{ success: true }`。
- `channels` 表中对应 `channel_id` 的记录已删除。
- `channel_members` 表中对应 `channel_id` 的记录已删除。
