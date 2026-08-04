---
{
  "checks": [
    {
      "name": "准备：域 + 群 B",
      "method": "POST",
      "url": "/api/groups",
      "body": { "name": "LeaveDisc-Owner", "owner_team_id": "team-default" },
      "expect": { "status": 201 },
      "capture": { "groupA": "id" }
    },
    {
      "name": "创建域",
      "method": "POST",
      "url": "/api/domains",
      "body": { "name": "LeaveDisc-Domain", "owner_group_id": "{{groupA}}" },
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
      "body": { "name": "LeaveDisc-B", "owner_team_id": "team-default" },
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
      "name": "群 B 声明能力",
      "method": "POST",
      "url": "/api/domains/{{domainId}}/capabilities",
      "body": { "group_id": "{{groupB}}", "capabilities": ["data-analysis"] },
      "expect": { "status": 200 }
    },
    {
      "name": "退出前发现能命中 B",
      "method": "GET",
      "url": "/api/domains/{{domainId}}/discover?capabilities=data-analysis&group_id={{groupA}}",
      "expect": { "status": 200, "json": { "$any": { "group_id": "{{groupB}}" } } }
    },
    {
      "name": "群 B 退出域",
      "method": "POST",
      "url": "/api/domains/{{domainId}}/leave",
      "body": { "group_id": "{{groupB}}" },
      "expect": { "status": 200 }
    },
    {
      "name": "退出后发现不再命中 B",
      "method": "GET",
      "url": "/api/domains/{{domainId}}/discover?capabilities=data-analysis&group_id={{groupA}}",
      "expect": { "status": 200, "json": { "$none": { "group_id": "{{groupB}}" } } }
    },
    {
      "name": "能力列表不再含 B",
      "method": "GET",
      "url": "/api/domains/{{domainId}}/capabilities",
      "expect": { "status": 200, "json": { "$none": { "group_id": "{{groupB}}" } } }
    }
  ]
}
---
# 边界场景：群退出域后从发现结果消失

## 操作
1. 群 B 声明能力后退出域。

## 期望
- 退出前发现可命中 B；退出后发现与能力列表都不再出现 B。
