---
{
  "checks": [
    {
      "name": "准备：创建群 A 与域",
      "method": "POST",
      "url": "/api/groups",
      "body": { "name": "Caps-Owner", "owner_team_id": "team-default" },
      "expect": { "status": 201 },
      "capture": { "groupA": "id" }
    },
    {
      "name": "创建域",
      "method": "POST",
      "url": "/api/domains",
      "body": { "name": "Caps-Domain", "owner_group_id": "{{groupA}}" },
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
      "name": "准备：创建群 B 并加入",
      "method": "POST",
      "url": "/api/groups",
      "body": { "name": "Caps-Joiner", "owner_team_id": "team-default" },
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
      "name": "群 B 声明能力",
      "method": "POST",
      "url": "/api/domains/{{domainId}}/capabilities",
      "body": { "group_id": "{{groupB}}", "capabilities": ["data-analysis", "python"] },
      "expect": { "status": 200 }
    },
    {
      "name": "能力列表反映更新",
      "method": "GET",
      "url": "/api/domains/{{domainId}}/capabilities",
      "expect": {
        "status": 200,
        "json": { "$any": { "group_id": "{{groupB}}", "capabilities": ["data-analysis", "python"] } }
      }
    }
  ]
}
---
# 成功场景：群声明能力

## 操作
1. 群 B 加入域后通过 `POST /api/domains/:id/capabilities` 声明能力。

## 期望
- 声明成功（200）。
- 域能力列表中群 B 的能力为更新后的值。
