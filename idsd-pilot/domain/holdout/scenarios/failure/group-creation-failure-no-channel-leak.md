---
{
  "checks": [
    {
      "name": "缺 name 创建群被拒",
      "method": "POST",
      "url": "/api/groups",
      "body": { "owner_team_id": "team-default" },
      "expect": { "status": 400 }
    },
    {
      "name": "失败后无频道残留",
      "method": "GET",
      "url": "/api/channels",
      "expect": { "status": 200, "json": { "channels": { "$length": 1 } } }
    }
  ]
}
---
# 失败场景：群创建失败不残留频道

## 操作
1. 调用 `POST /api/groups`（缺 name 字段）。

## 期望
- 返回 400。
- 频道列表中只有种子频道 `general`（$length=1），没有残留的 group-channel。

> 回归覆盖 GAP-19：群创建失败时事务回滚，不残留频道记录。
