---
{
  "checks": [
    {
      "name": "准备：创建群 A",
      "method": "POST",
      "url": "/api/groups",
      "body": { "name": "InviteOwner-Group", "owner_team_id": "team-default" },
      "expect": { "status": 201 },
      "capture": { "groupA": "id" }
    },
    {
      "name": "群 A 创建域",
      "method": "POST",
      "url": "/api/domains",
      "body": { "name": "InviteDomain", "owner_group_id": "{{groupA}}" },
      "expect": { "status": 201 },
      "capture": { "domainId": "id" }
    },
    {
      "name": "生成邀请码",
      "method": "POST",
      "url": "/api/domains/{{domainId}}/invite",
      "body": { "max_uses": 2 },
      "expect": { "status": 200, "json": { "invite_code": { "$matches": "^[A-Z0-9]{8}$" } } },
      "capture": { "inviteCode": "invite_code" }
    },
    {
      "name": "准备：创建群 B",
      "method": "POST",
      "url": "/api/groups",
      "body": { "name": "InviteJoin-Group", "owner_team_id": "team-default" },
      "expect": { "status": 201 },
      "capture": { "groupB": "id" }
    },
    {
      "name": "群 B 凭邀请码加入域",
      "method": "POST",
      "url": "/api/domains/join",
      "body": { "invite_code": "{{inviteCode}}", "group_id": "{{groupB}}" },
      "expect": { "status": 200, "json": { "success": true, "domain_id": "{{domainId}}" } }
    },
    {
      "name": "域成员列表包含群 B（member）",
      "method": "GET",
      "url": "/api/domains/{{domainId}}",
      "expect": {
        "status": 200,
        "json": { "members": { "$any": { "group_id": "{{groupB}}", "role": "member" } } }
      }
    }
  ]
}
---
# 成功场景：群凭邀请码加入域

## 操作
1. 群 A 创建域并生成邀请码（max_uses=2）。
2. 群 B 凭邀请码加入。

## 期望
- 邀请码为 8 位大写字母数字。
- 加入成功，域成员列表中群 B 角色为 member。
