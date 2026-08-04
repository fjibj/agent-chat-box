---
{
  "checks": [
    {
      "name": "准备：域 + 非成员群 B",
      "method": "POST",
      "url": "/api/groups",
      "body": { "name": "NonMemDisc-Owner", "owner_team_id": "team-default" },
      "expect": { "status": 201 },
      "capture": { "groupA": "id" }
    },
    {
      "name": "创建域",
      "method": "POST",
      "url": "/api/domains",
      "body": { "name": "NonMemDisc-Domain", "owner_group_id": "{{groupA}}" },
      "expect": { "status": 201 },
      "capture": { "domainId": "id" }
    },
    {
      "name": "准备：创建群 B（非成员）",
      "method": "POST",
      "url": "/api/groups",
      "body": { "name": "NonMemDisc-B", "owner_team_id": "team-default" },
      "expect": { "status": 201 },
      "capture": { "groupB": "id" }
    },
    {
      "name": "非成员调用发现被拒",
      "method": "GET",
      "url": "/api/domains/{{domainId}}/discover?capabilities=data-analysis&group_id={{groupB}}",
      "expect": { "status": 403 }
    },
    {
      "name": "非成员查信誉被拒",
      "method": "GET",
      "url": "/api/domains/{{domainId}}/reputation?group_id={{groupB}}",
      "expect": { "status": 403 }
    }
  ]
}
---
# 失败场景：非成员不能发现/查信誉

## 操作
1. 非成员群 B 调用能力发现与信誉查询接口。

## 期望
- 均被拒绝（4xx）。
