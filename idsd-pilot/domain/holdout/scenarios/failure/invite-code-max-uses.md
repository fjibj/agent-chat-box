---
{
  "checks": [
    {
      "name": "准备：创建群 A",
      "method": "POST",
      "url": "/api/groups",
      "body": { "name": "MaxUse-Owner", "owner_team_id": "team-default" },
      "expect": { "status": 201 },
      "capture": { "groupA": "id" }
    },
    {
      "name": "群 A 创建域",
      "method": "POST",
      "url": "/api/domains",
      "body": { "name": "MaxUse-Domain", "owner_group_id": "{{groupA}}" },
      "expect": { "status": 201 },
      "capture": { "domainId": "id" }
    },
    {
      "name": "生成邀请码 max_uses=1",
      "method": "POST",
      "url": "/api/domains/{{domainId}}/invite",
      "body": { "max_uses": 1 },
      "expect": { "status": 200, "json": { "max_uses": 1 } },
      "capture": { "inviteCode": "invite_code" }
    },
    {
      "name": "准备：创建群 B 和 C",
      "method": "POST",
      "url": "/api/groups",
      "body": { "name": "MaxUse-B", "owner_team_id": "team-default" },
      "expect": { "status": 201 },
      "capture": { "groupB": "id" }
    },
    {
      "name": "创建群 C",
      "method": "POST",
      "url": "/api/groups",
      "body": { "name": "MaxUse-C", "owner_team_id": "team-default" },
      "expect": { "status": 201 },
      "capture": { "groupC": "id" }
    },
    {
      "name": "群 B 首次加入成功",
      "method": "POST",
      "url": "/api/domains/join",
      "body": { "invite_code": "{{inviteCode}}", "group_id": "{{groupB}}" },
      "expect": { "status": 200 }
    },
    {
      "name": "群 C 再使用同一邀请码被拒（达上限）",
      "method": "POST",
      "url": "/api/domains/join",
      "body": { "invite_code": "{{inviteCode}}", "group_id": "{{groupC}}" },
      "expect": { "status": 400 }
    }
  ]
}
---
# 失败场景：邀请码达最大使用次数

## 操作
1. 生成 max_uses=1 的邀请码。
2. 群 B 加入成功；群 C 再用同一邀请码加入。

## 期望
- 群 C 被拒绝（400）。
