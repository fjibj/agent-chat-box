# 成功场景：API 创建群返回 channel_id

## 操作
1. 启动 dev server。
2. 调用 `POST /api/groups`：
   ```json
   { "name": "API-Test-Channel", "owner_team_id": "team-default" }
   ```

## 期望
- 响应状态码 201。
- 响应体包含 `channel_id` 字段，且以 `group-channel-` 开头。
- `channels` 表中存在对应记录，`type='group'`。
