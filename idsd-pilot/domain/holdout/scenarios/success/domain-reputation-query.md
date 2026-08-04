---
{
  "checks": [
    {
      "name": "准备：域 + 群 B",
      "method": "POST",
      "url": "/api/groups",
      "body": { "name": "DomRep-Owner", "owner_team_id": "team-default" },
      "expect": { "status": 201 },
      "capture": { "groupA": "id" }
    },
    {
      "name": "创建域",
      "method": "POST",
      "url": "/api/domains",
      "body": { "name": "DomRep-Domain", "owner_group_id": "{{groupA}}" },
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
      "name": "创建群 B 并加入",
      "method": "POST",
      "url": "/api/groups",
      "body": { "name": "DomRep-B", "owner_team_id": "team-default" },
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
      "name": "信誉查询返回两个成员",
      "method": "GET",
      "url": "/api/domains/{{domainId}}/reputation?group_id={{groupA}}",
      "expect": { "status": 200, "json": { "$length": 2 } }
    },
    {
      "name": "每个成员都带数值信誉",
      "method": "GET",
      "url": "/api/domains/{{domainId}}/reputation?group_id={{groupA}}",
      "expect": { "status": 200, "json": { "$all": { "reputation": { "$gte": 0 } } } }
    }
  ]
}
---
# 成功场景：域信誉查询

## 操作
1. 域内有两个成员群（A owner、B member）。

## 期望
- `GET /api/domains/:id/reputation` 返回全部成员群（数量 = 2）。
- 每个成员都带 reputation 数值字段（无记录时为 0）。
