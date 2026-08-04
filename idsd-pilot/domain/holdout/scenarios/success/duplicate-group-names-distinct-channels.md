---
{
  "checks": [
    {
      "name": "同名群 A",
      "method": "POST",
      "url": "/api/groups",
      "body": { "name": "SameName", "owner_team_id": "team-default" },
      "expect": { "status": 201 },
      "capture": { "channelId1": "channel_id" }
    },
    {
      "name": "同名群 B 产生不同频道",
      "method": "POST",
      "url": "/api/groups",
      "body": { "name": "SameName", "owner_team_id": "team-default" },
      "expect": { "status": 201, "json": { "channel_id": { "$ne": "{{channelId1}}" } } }
    }
  ]
}
---
# 成功场景：同名群产生不同的频道 ID

## 操作
1. 连续创建两个同名群 `SameName`。

## 期望
- 两个群的 channel_id 不同（频道身份绑定群 ID，而非群名）。

> 回归覆盖 GAP-19：频道名称唯一性不因群名重复而冲突。
