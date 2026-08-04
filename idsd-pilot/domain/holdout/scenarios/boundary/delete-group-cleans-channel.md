---
{
  "checks": [
    {
      "name": "创建群",
      "method": "POST",
      "url": "/api/groups",
      "body": { "name": "ToBeDeleted", "owner_team_id": "team-default" },
      "expect": { "status": 201 },
      "capture": { "groupId": "id", "channelId": "channel_id" }
    },
    {
      "name": "解散群",
      "method": "DELETE",
      "url": "/api/groups/{{groupId}}",
      "expect": { "status": 200, "json": { "success": true } }
    },
    {
      "name": "频道从列表消失",
      "method": "GET",
      "url": "/api/channels",
      "expect": { "status": 200, "json": { "channels": { "$none": { "id": "{{channelId}}" } } } }
    },
    {
      "name": "频道详情 404",
      "method": "GET",
      "url": "/api/channels/{{channelId}}",
      "expect": { "status": 404 }
    }
  ]
}
---
# 边界场景：解散群自动清理频道

## 操作
1. 创建群，记录 channel_id。
2. 调用 `DELETE /api/groups/:id` 解散群。

## 期望
- 解散成功（success=true）。
- 对应频道从频道列表中消失。
- 直接查询该频道返回 404。

> 回归覆盖 GAP-19：解散群时自动清理对应频道及其成员。
