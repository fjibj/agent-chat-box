---
{
  "checks": [
    {
      "name": "准备：创建群 A",
      "method": "POST",
      "url": "/api/groups",
      "body": { "name": "DupJoin-Owner", "owner_team_id": "team-default" },
      "expect": { "status": 201 },
      "capture": { "groupA": "id" }
    },
    {
      "name": "群 A 创建域",
      "method": "POST",
      "url": "/api/domains",
      "body": { "name": "DupJoin-Domain", "owner_group_id": "{{groupA}}" },
      "expect": { "status": 201 },
      "capture": { "domainId": "id" }
    },
    {
      "name": "生成邀请码 max_uses=5",
      "method": "POST",
      "url": "/api/domains/{{domainId}}/invite",
      "body": { "max_uses": 5 },
      "expect": { "status": 200 },
      "capture": { "inviteCode": "invite_code" }
    },
    {
      "name": "准备：创建群 B",
      "method": "POST",
      "url": "/api/groups",
      "body": { "name": "DupJoin-B", "owner_team_id": "team-default" },
      "expect": { "status": 201 },
      "capture": { "groupB": "id" }
    },
    {
      "name": "群 B 首次加入成功",
      "method": "POST",
      "url": "/api/domains/join",
      "body": { "invite_code": "{{inviteCode}}", "group_id": "{{groupB}}" },
      "expect": { "status": 200 }
    },
    {
      "name": "群 B 重复加入被拒",
      "method": "POST",
      "url": "/api/domains/join",
      "body": { "invite_code": "{{inviteCode}}", "group_id": "{{groupB}}" },
      "expect": { "status": 400 }
    }
  ]
}
---
# 失败场景：重复加入同一域

## 操作
1. 群 B 加入域后再次用同一邀请码加入。

## 期望
- 重复加入被拒绝（400）。
