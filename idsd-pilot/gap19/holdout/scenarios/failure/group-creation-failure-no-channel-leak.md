# 失败场景：群创建失败不残留频道

## 操作
1. 启动 dev server。
2. 调用 `POST /api/groups` body `{ "name": "WillFail", "owner_team_id": "nonexistent-team" }`。
3. 查询 `channels` 和 `channel_members` 表。

## 期望
- 响应状态码 404。
- `channels` 表中没有 name="WillFail" 的记录。
- `channel_members` 表中没有对应新增记录。
