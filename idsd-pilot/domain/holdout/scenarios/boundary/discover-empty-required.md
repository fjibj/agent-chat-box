---
{
  "checks": [
    {
      "name": "准备：域 + 群 B、C",
      "method": "POST",
      "url": "/api/groups",
      "body": { "name": "EmptyReq-Owner", "owner_team_id": "team-default" },
      "expect": { "status": 201 },
      "capture": { "groupA": "id" }
    },
    {
      "name": "创建域",
      "method": "POST",
      "url": "/api/domains",
      "body": { "name": "EmptyReq-Domain", "owner_group_id": "{{groupA}}" },
      "expect": { "status": 201 },
      "capture": { "domainId": "id" }
    },
    {
      "name": "生成邀请码",
      "method": "POST",
      "url": "/api/domains/{{domainId}}/invite",
      "body": { "max_uses": 5 },
      "expect": { "status": 200 },
      "capture": { "inviteCode": "invite_code" }
    },
    {
      "name": "创建群 B 并加入",
      "method": "POST",
      "url": "/api/groups",
      "body": { "name": "EmptyReq-B", "owner_team_id": "team-default" },
      "expect": { "status": 201 },
      "capture": { "groupB": "id" }
    },
    {
      "name": "群 B 加入",
      "method": "POST",
      "url": "/api/domains/join",
      "body": { "invite_code": "{{inviteCode}}", "group_id": "{{groupB}}" },
      "expect": { "status": 200 }
    },
    {
      "name": "创建群 C 并加入",
      "method": "POST",
      "url": "/api/groups",
      "body": { "name": "EmptyReq-C", "owner_team_id": "team-default" },
      "expect": { "status": 201 },
      "capture": { "groupC": "id" }
    },
    {
      "name": "群 C 加入",
      "method": "POST",
      "url": "/api/domains/join",
      "body": { "invite_code": "{{inviteCode}}", "group_id": "{{groupC}}" },
      "expect": { "status": 200 }
    },
    {
      "name": "空 required 返回全部成员",
      "method": "GET",
      "url": "/api/domains/{{domainId}}/discover?capabilities=&group_id={{groupA}}",
      "expect": { "status": 200, "json": { "$length": 3 } }
    },
    {
      "name": "空 required 包含 B 和 C",
      "method": "GET",
      "url": "/api/domains/{{domainId}}/discover?capabilities=&group_id={{groupA}}",
      "expect": { "status": 200, "json": { "$all": { "group_id": { "$exists": true } } } }
    }
  ]
}
---
# 边界场景：空 required 发现查询

## 操作
1. 域内有 3 个成员群（A、B、C），用空 capabilities 调用发现接口。

## 期望
- 空 required 匹配所有成员（返回全部 3 个）。
