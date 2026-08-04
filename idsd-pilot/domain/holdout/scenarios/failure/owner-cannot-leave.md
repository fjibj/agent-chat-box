---
{
  "checks": [
    {
      "name": "准备：创建群 A",
      "method": "POST",
      "url": "/api/groups",
      "body": { "name": "OwnerLeave-Group", "owner_team_id": "team-default" },
      "expect": { "status": 201 },
      "capture": { "groupA": "id" }
    },
    {
      "name": "群 A 创建域",
      "method": "POST",
      "url": "/api/domains",
      "body": { "name": "OwnerLeave-Domain", "owner_group_id": "{{groupA}}" },
      "expect": { "status": 201 },
      "capture": { "domainId": "id" }
    },
    {
      "name": "owner 群退出被拒",
      "method": "POST",
      "url": "/api/domains/{{domainId}}/leave",
      "body": { "group_id": "{{groupA}}" },
      "expect": { "status": 400 }
    },
    {
      "name": "owner 仍在成员列表",
      "method": "GET",
      "url": "/api/domains/{{domainId}}",
      "expect": { "status": 200, "json": { "members": { "$any": { "group_id": "{{groupA}}", "role": "owner" } } } }
    }
  ]
}
---
# 失败场景：owner 群不能退出

## 操作
1. owner 群 A 调用退出接口。

## 期望
- 被拒绝（400，只能解散域）。
- 群 A 仍在成员列表中且角色为 owner。
