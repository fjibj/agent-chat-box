---
{
  "checks": [
    {
      "name": "创建群",
      "method": "POST",
      "url": "/api/groups",
      "body": { "name": "API-Test-Channel", "owner_team_id": "team-default" },
      "expect": {
        "status": 201,
        "json": {
          "channel_id": { "$startsWith": "group-channel-" },
          "owner_team_id": "team-default"
        }
      },
      "capture": { "groupId": "id", "channelId": "channel_id" }
    },
    {
      "name": "频道出现在频道列表",
      "method": "GET",
      "url": "/api/channels",
      "expect": {
        "status": 200,
        "json": { "channels": { "$any": { "id": "{{channelId}}", "type": "group" } } }
      }
    },
    {
      "name": "频道详情可查且类型为 group",
      "method": "GET",
      "url": "/api/channels/{{channelId}}",
      "expect": { "status": 200, "json": { "id": "{{channelId}}", "type": "group" } }
    }
  ]
}
---
# 成功场景：API 创建群返回 channel_id

## 操作
1. 调用 `POST /api/groups`：
   ```json
   { "name": "API-Test-Channel", "owner_team_id": "team-default" }
   ```

## 期望
- 响应状态码 201。
- 响应体包含 `channel_id` 字段，且以 `group-channel-` 开头。
- `GET /api/channels` 中能看到该频道（type=group）。
- `GET /api/channels/:id` 可查询到该频道。

> 回归覆盖 GAP-19：创建群自动创建群聊频道。
