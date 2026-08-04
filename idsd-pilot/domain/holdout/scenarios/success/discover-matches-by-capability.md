---
{
  "checks": [
    {
      "name": "准备：域 + 群 B、C",
      "method": "POST",
      "url": "/api/groups",
      "body": { "name": "Disc-Owner", "owner_team_id": "team-default" },
      "expect": { "status": 201 },
      "capture": { "groupA": "id" }
    },
    {
      "name": "创建域",
      "method": "POST",
      "url": "/api/domains",
      "body": { "name": "Disc-Domain", "owner_group_id": "{{groupA}}" },
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
      "body": { "name": "Disc-B", "owner_team_id": "team-default" },
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
      "name": "创建群 C 并加入",
      "method": "POST",
      "url": "/api/groups",
      "body": { "name": "Disc-C", "owner_team_id": "team-default" },
      "expect": { "status": 201 },
      "capture": { "groupC": "id" }
    },
    {
      "name": "群 C 加入",
      "method": "POST",
      "url": "/api/domains/join",
      "body": { "invite_code": "{{inviteCode}}", "group_id": "{{groupC}}" },
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
      "name": "群 C 声明能力",
      "method": "POST",
      "url": "/api/domains/{{domainId}}/capabilities",
      "body": { "group_id": "{{groupC}}", "capabilities": ["review", "test"] },
      "expect": { "status": 200 }
    },
    {
      "name": "发现 data-analysis：只命中 B",
      "method": "GET",
      "url": "/api/domains/{{domainId}}/discover?capabilities=data-analysis&group_id={{groupA}}",
      "expect": {
        "status": 200,
        "json": { "$any": { "group_id": "{{groupB}}" } }
      }
    },
    {
      "name": "发现 data-analysis：不含 C",
      "method": "GET",
      "url": "/api/domains/{{domainId}}/discover?capabilities=data-analysis&group_id={{groupA}}",
      "expect": {
        "status": 200,
        "json": { "$none": { "group_id": "{{groupC}}" } }
      }
    },
    {
      "name": "发现 review：命中 C",
      "method": "GET",
      "url": "/api/domains/{{domainId}}/discover?capabilities=review&group_id={{groupA}}",
      "expect": {
        "status": 200,
        "json": { "$any": { "group_id": "{{groupC}}" } }
      }
    },
    {
      "name": "发现 data-analysis+python：命中 B",
      "method": "GET",
      "url": "/api/domains/{{domainId}}/discover?capabilities=data-analysis,python&group_id={{groupA}}",
      "expect": {
        "status": 200,
        "json": { "$any": { "group_id": "{{groupB}}" } }
      }
    }
  ]
}
---
# 成功场景：能力发现精确匹配

## 操作
1. 域内群 B 声明 [data-analysis, python]，群 C 声明 [review, test]。
2. 分别以不同 required 能力调用发现接口。

## 期望
- required ⊆ 声明能力的群被命中，不匹配的群不出现。
- 多 required 时只有全部具备的群被命中（子集匹配）。
