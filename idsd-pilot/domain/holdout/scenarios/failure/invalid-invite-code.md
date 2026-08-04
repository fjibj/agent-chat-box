---
{
  "checks": [
    {
      "name": "准备：创建群 A",
      "method": "POST",
      "url": "/api/groups",
      "body": { "name": "BadInvite-Owner", "owner_team_id": "team-default" },
      "expect": { "status": 201 },
      "capture": { "groupA": "id" }
    },
    {
      "name": "群 A 创建域",
      "method": "POST",
      "url": "/api/domains",
      "body": { "name": "BadInvite-Domain", "owner_group_id": "{{groupA}}" },
      "expect": { "status": 201 },
      "capture": { "domainId": "id" }
    },
    {
      "name": "准备：创建群 B",
      "method": "POST",
      "url": "/api/groups",
      "body": { "name": "BadInvite-Joiner", "owner_team_id": "team-default" },
      "expect": { "status": 201 },
      "capture": { "groupB": "id" }
    },
    {
      "name": "不存在的邀请码加入被拒",
      "method": "POST",
      "url": "/api/domains/join",
      "body": { "invite_code": "NOPE1234", "group_id": "{{groupB}}" },
      "expect": { "status": 404 }
    },
    {
      "name": "域成员列表不含群 B",
      "method": "GET",
      "url": "/api/domains/{{domainId}}",
      "expect": { "status": 200, "json": { "members": { "$none": { "group_id": "{{groupB}}" } } } }
    }
  ]
}
---
# 失败场景：无效邀请码

## 操作
1. 群 B 用不存在的邀请码加入域。

## 期望
- 被拒绝（404）。
- 域成员列表不包含群 B。
