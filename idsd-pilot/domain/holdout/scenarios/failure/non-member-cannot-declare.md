---
{
  "checks": [
    {
      "name": "准备：域 + 非成员群 B",
      "method": "POST",
      "url": "/api/groups",
      "body": { "name": "NonMem-Owner", "owner_team_id": "team-default" },
      "expect": { "status": 201 },
      "capture": { "groupA": "id" }
    },
    {
      "name": "创建域",
      "method": "POST",
      "url": "/api/domains",
      "body": { "name": "NonMem-Domain", "owner_group_id": "{{groupA}}" },
      "expect": { "status": 201 },
      "capture": { "domainId": "id" }
    },
    {
      "name": "准备：创建群 B（非成员）",
      "method": "POST",
      "url": "/api/groups",
      "body": { "name": "NonMem-B", "owner_team_id": "team-default" },
      "expect": { "status": 201 },
      "capture": { "groupB": "id" }
    },
    {
      "name": "非成员声明能力被拒",
      "method": "POST",
      "url": "/api/domains/{{domainId}}/capabilities",
      "body": { "group_id": "{{groupB}}", "capabilities": ["data-analysis"] },
      "expect": { "status": 403 }
    }
  ]
}
---
# 失败场景：非成员不能声明能力

## 操作
1. 非成员群 B 调用能力声明接口。

## 期望
- 被拒绝（4xx）。
