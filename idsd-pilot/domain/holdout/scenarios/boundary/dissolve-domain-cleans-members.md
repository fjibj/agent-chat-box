---
{
  "checks": [
    {
      "name": "准备：创建群 A",
      "method": "POST",
      "url": "/api/groups",
      "body": { "name": "Dissolve-Owner", "owner_team_id": "team-default" },
      "expect": { "status": 201 },
      "capture": { "groupA": "id" }
    },
    {
      "name": "群 A 创建域",
      "method": "POST",
      "url": "/api/domains",
      "body": { "name": "Dissolve-Domain", "owner_group_id": "{{groupA}}" },
      "expect": { "status": 201 },
      "capture": { "domainId": "id" }
    },
    {
      "name": "生成邀请码",
      "method": "POST",
      "url": "/api/domains/{{domainId}}/invite",
      "body": {},
      "expect": { "status": 200 },
      "capture": { "inviteCode": "invite_code" }
    },
    {
      "name": "准备：创建群 B",
      "method": "POST",
      "url": "/api/groups",
      "body": { "name": "Dissolve-Joiner", "owner_team_id": "team-default" },
      "expect": { "status": 201 },
      "capture": { "groupB": "id" }
    },
    {
      "name": "群 B 加入域",
      "method": "POST",
      "url": "/api/domains/join",
      "body": { "invite_code": "{{inviteCode}}", "group_id": "{{groupB}}" },
      "expect": { "status": 200 }
    },
    {
      "name": "解散域",
      "method": "DELETE",
      "url": "/api/domains/{{domainId}}",
      "expect": { "status": 200, "json": { "success": true } }
    },
    {
      "name": "域详情 404",
      "method": "GET",
      "url": "/api/domains/{{domainId}}",
      "expect": { "status": 404 }
    },
    {
      "name": "群 A 的域列表不再包含该域",
      "method": "GET",
      "url": "/api/domains?group_id={{groupA}}",
      "expect": { "status": 200, "json": { "$none": { "id": "{{domainId}}" } } }
    },
    {
      "name": "群 B 的域列表不再包含该域",
      "method": "GET",
      "url": "/api/domains?group_id={{groupB}}",
      "expect": { "status": 200, "json": { "$none": { "id": "{{domainId}}" } } }
    }
  ]
}
---
# 边界场景：解散域清理成员关系

## 操作
1. 群 A 创建域，群 B 加入。
2. owner 群 A 解散域。

## 期望
- 解散成功。
- 域详情 404。
- 群 A、群 B 的域列表中都不再出现该域（成员关系已清理）。
