---
{
  "checks": [
    {
      "name": "准备：创建群 A",
      "method": "POST",
      "url": "/api/groups",
      "body": { "name": "ListOwner-Group", "owner_team_id": "team-default" },
      "expect": { "status": 201 },
      "capture": { "groupA": "id" }
    },
    {
      "name": "群 A 创建域",
      "method": "POST",
      "url": "/api/domains",
      "body": { "name": "ListDomain", "owner_group_id": "{{groupA}}" },
      "expect": { "status": 201 },
      "capture": { "domainId": "id" }
    },
    {
      "name": "准备：创建群 B（非成员）",
      "method": "POST",
      "url": "/api/groups",
      "body": { "name": "ListOutsider-Group", "owner_team_id": "team-default" },
      "expect": { "status": 201 },
      "capture": { "groupB": "id" }
    },
    {
      "name": "群 A 的域列表包含该域",
      "method": "GET",
      "url": "/api/domains?group_id={{groupA}}",
      "expect": { "status": 200, "json": { "$any": { "id": "{{domainId}}" } } }
    },
    {
      "name": "非成员群 B 的域列表不含该域",
      "method": "GET",
      "url": "/api/domains?group_id={{groupB}}",
      "expect": { "status": 200, "json": { "$none": { "id": "{{domainId}}" } } }
    }
  ]
}
---
# 成功场景：查询所属域列表

## 操作
1. 群 A 创建域；群 B 不加入。

## 期望
- 群 A 的域列表包含该域。
- 非成员群 B 的域列表中看不到该域。
