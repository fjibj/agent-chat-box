---
{
  "checks": [
    {
      "name": "准备：创建群 A",
      "method": "POST",
      "url": "/api/groups",
      "body": { "name": "DomainOwner-Group", "owner_team_id": "team-default" },
      "expect": { "status": 201 },
      "capture": { "groupA": "id" }
    },
    {
      "name": "群 A 创建域",
      "method": "POST",
      "url": "/api/domains",
      "body": { "name": "TestDomain", "owner_group_id": "{{groupA}}" },
      "expect": { "status": 201, "json": { "owner_group_id": "{{groupA}}" } },
      "capture": { "domainId": "id" }
    },
    {
      "name": "域详情包含 owner 成员",
      "method": "GET",
      "url": "/api/domains/{{domainId}}",
      "expect": {
        "status": 200,
        "json": { "id": "{{domainId}}", "members": { "$any": { "group_id": "{{groupA}}", "role": "owner" } } }
      }
    }
  ]
}
---
# 成功场景：群创建域

## 操作
1. 群 A 创建域（owner_group_id=群A）。

## 期望
- 域创建成功（201），owner_group_id 为群 A。
- 域详情中群 A 是成员且角色为 owner。
