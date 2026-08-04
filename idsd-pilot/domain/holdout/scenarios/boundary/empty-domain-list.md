---
{
  "checks": [
    {
      "name": "准备：创建群 C（无任何域）",
      "method": "POST",
      "url": "/api/groups",
      "body": { "name": "NoDomain-Group", "owner_team_id": "team-default" },
      "expect": { "status": 201 },
      "capture": { "groupC": "id" }
    },
    {
      "name": "域列表返回空数组",
      "method": "GET",
      "url": "/api/domains?group_id={{groupC}}",
      "expect": { "status": 200, "json": { "$length": 0 } }
    }
  ]
}
---
# 边界场景：群不属于任何域

## 操作
1. 查询未加入任何域的群的域列表。

## 期望
- 返回空数组（不是错误）。
