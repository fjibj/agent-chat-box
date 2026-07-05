# 成功场景：群主用户自动加入频道

## 操作
1. 启动 dev server。
2. 创建团队：`POST /api/teams` body `{ "name": "OwnerTeam", "user_id": "owner-user-1" }`。
3. 使用该团队的 id 调用 `POST /api/groups` 创建群。
4. 查询 `channel_members` 表。

## 期望
- `channel_members` 中存在一行：`channel_id` 为返回的 `channel_id`，`member_id` 为 `"owner-user-1"`，`member_kind='human'`。
