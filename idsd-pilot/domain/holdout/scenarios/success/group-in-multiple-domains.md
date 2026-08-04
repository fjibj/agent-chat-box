---
{
  "checks": [
    {
      "name": "准备：创建群 A",
      "method": "POST",
      "url": "/api/groups",
      "body": { "name": "MultiDomain-Owner", "owner_team_id": "team-default" },
      "expect": { "status": 201 },
      "capture": { "groupA": "id" }
    },
    {
      "name": "创建域 D1",
      "method": "POST",
      "url": "/api/domains",
      "body": { "name": "Multi-D1", "owner_group_id": "{{groupA}}" },
      "expect": { "status": 201 },
      "capture": { "d1": "id" }
    },
    {
      "name": "创建域 D2",
      "method": "POST",
      "url": "/api/domains",
      "body": { "name": "Multi-D2", "owner_group_id": "{{groupA}}" },
      "expect": { "status": 201 },
      "capture": { "d2": "id" }
    },
    {
      "name": "D1 生成邀请码",
      "method": "POST",
      "url": "/api/domains/{{d1}}/invite",
      "body": {},
      "expect": { "status": 200 },
      "capture": { "code1": "invite_code" }
    },
    {
      "name": "D2 生成邀请码",
      "method": "POST",
      "url": "/api/domains/{{d2}}/invite",
      "body": {},
      "expect": { "status": 200 },
      "capture": { "code2": "invite_code" }
    },
    {
      "name": "准备：创建群 B",
      "method": "POST",
      "url": "/api/groups",
      "body": { "name": "MultiDomain-Joiner", "owner_team_id": "team-default" },
      "expect": { "status": 201 },
      "capture": { "groupB": "id" }
    },
    {
      "name": "群 B 加入 D1",
      "method": "POST",
      "url": "/api/domains/join",
      "body": { "invite_code": "{{code1}}", "group_id": "{{groupB}}" },
      "expect": { "status": 200 }
    },
    {
      "name": "群 B 加入 D2",
      "method": "POST",
      "url": "/api/domains/join",
      "body": { "invite_code": "{{code2}}", "group_id": "{{groupB}}" },
      "expect": { "status": 200 }
    },
    {
      "name": "D1 成员包含群 B",
      "method": "GET",
      "url": "/api/domains/{{d1}}",
      "expect": { "status": 200, "json": { "members": { "$any": { "group_id": "{{groupB}}" } } } }
    },
    {
      "name": "D2 成员包含群 B",
      "method": "GET",
      "url": "/api/domains/{{d2}}",
      "expect": { "status": 200, "json": { "members": { "$any": { "group_id": "{{groupB}}" } } } }
    }
  ]
}
---
# 成功场景：群同时属于多个域

## 操作
1. 群 A 创建两个域 D1、D2。
2. 群 B 分别凭邀请码加入 D1 和 D2。

## 期望
- D1、D2 的成员列表都包含群 B，互不影响。
