# 成功场景：同名群产生不同频道

## 操作
1. 启动 dev server。
2. 使用同一 `owner_team_id` 连续两次调用 `POST /api/groups`，name 均为 "SameName"。

## 期望
- 两次均返回 201。
- 两个群的 `channel_id` 不同。
- `channels` 表中存在两条同名记录，id 不同。
