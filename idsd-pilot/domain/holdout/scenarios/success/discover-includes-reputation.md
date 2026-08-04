---
{
  "checks": [
    {
      "name": "准备：域 + 群 B",
      "method": "POST",
      "url": "/api/groups",
      "body": { "name": "DiscRep-Owner", "owner_team_id": "team-default" },
      "expect": { "status": 201 },
      "capture": { "groupA": "id" }
    },
    {
      "name": "创建域",
      "method": "POST",
      "url": "/api/domains",
      "body": { "name": "DiscRep-Domain", "owner_group_id": "{{groupA}}" },
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
      "body": { "name": "DiscRep-B", "owner_team_id": "team-default" },
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
      "name": "发现结果含信誉数值",
      "method": "GET",
      "url": "/api/domains/{{domainId}}/discover?capabilities=data-analysis&group_id={{groupA}}",
      "expect": {
        "status": 200,
        "json": { "$any": { "group_id": "{{groupB}}", "reputation": { "$gte": 0 } } }
      }
    }
  ]
}
---
# 成功场景：发现结果含信誉

## 操作
1. 域内群 B 声明 [data-analysis] 并执行发现查询。

## 期望
- 命中结果带 reputation 数值字段（无信誉记录时为 0，数值类型）。
