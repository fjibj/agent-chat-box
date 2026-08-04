---
{
  "checks": [
    { "name": "创建团队 A", "method": "POST", "url": "/api/teams", "body": { "name": "S3S-TeamA", "user_id": "user-a" }, "expect": { "status": 201 }, "capture": { "s3TeamA": "id" } },
    { "name": "创建群 A", "method": "POST", "url": "/api/groups", "body": { "name": "S3S-GA", "owner_team_id": "{{s3TeamA}}" }, "expect": { "status": 201 }, "capture": { "s3GroupA": "id" } },
    { "name": "群 A 创建域", "method": "POST", "url": "/api/domains", "body": { "name": "S3S-Dom", "owner_group_id": "{{s3GroupA}}" }, "expect": { "status": 201 }, "capture": { "s3Domain": "id" } },
    { "name": "群 A 自己声明能力", "method": "POST", "url": "/api/domains/{{s3Domain}}/capabilities", "body": { "group_id": "{{s3GroupA}}", "capabilities": ["data-analysis"] }, "expect": { "status": 200 } },
    { "name": "发起协作，唯一匹配者是自己 → 400", "method": "POST", "url": "/api/domains/{{s3Domain}}/tasks", "body": { "requester_group_id": "{{s3GroupA}}", "title": "自问自答", "required_capabilities": ["data-analysis"] }, "expect": { "status": 400 } }
  ]
}
---
# 边界场景：路由排除发起群自身

## 操作
1. 域内只有群 A 一个成员，且 A 自己声明了 data-analysis。
2. 群 A 发起要求 data-analysis 的协作。

## 期望
- 唯一能力匹配者是发起群自身 → 路由排除自身 → 无匹配 → 400（防止自刷协作）。
