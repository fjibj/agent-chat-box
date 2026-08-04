---
{
  "checks": [
    { "name": "创建团队 A", "method": "POST", "url": "/api/teams", "body": { "name": "S3N-TeamA", "user_id": "user-a" }, "expect": { "status": 201 }, "capture": { "s3TeamA": "id" } },
    { "name": "创建团队 B", "method": "POST", "url": "/api/teams", "body": { "name": "S3N-TeamB", "user_id": "user-b" }, "expect": { "status": 201 }, "capture": { "s3TeamB": "id" } },
    { "name": "创建群 A", "method": "POST", "url": "/api/groups", "body": { "name": "S3N-GA", "owner_team_id": "{{s3TeamA}}" }, "expect": { "status": 201 }, "capture": { "s3GroupA": "id" } },
    { "name": "创建群 B", "method": "POST", "url": "/api/groups", "body": { "name": "S3N-GB", "owner_team_id": "{{s3TeamB}}" }, "expect": { "status": 201 }, "capture": { "s3GroupB": "id" } },
    { "name": "群 A 创建域", "method": "POST", "url": "/api/domains", "body": { "name": "S3N-Dom", "owner_group_id": "{{s3GroupA}}" }, "expect": { "status": 201 }, "capture": { "s3Domain": "id" } },
    { "name": "生成邀请码", "method": "POST", "url": "/api/domains/{{s3Domain}}/invite", "body": {}, "expect": { "status": 200 }, "capture": { "s3Invite": "invite_code" } },
    { "name": "群 B 加入域", "method": "POST", "url": "/api/domains/join", "body": { "invite_code": "{{s3Invite}}", "group_id": "{{s3GroupB}}" }, "expect": { "status": 200 } },
    { "name": "群 B 声明能力", "method": "POST", "url": "/api/domains/{{s3Domain}}/capabilities", "body": { "group_id": "{{s3GroupB}}", "capabilities": ["data-analysis"] }, "expect": { "status": 200 } },
    { "name": "发起无人声明的能力 → 400", "method": "POST", "url": "/api/domains/{{s3Domain}}/tasks", "body": { "requester_group_id": "{{s3GroupA}}", "title": "无人能做", "required_capabilities": ["quantum-computing"] }, "expect": { "status": 400 } }
  ]
}
---
# 失败场景：无匹配群

## 操作
1. 域内只有群 B 声明了 data-analysis。
2. 群 A 发起要求 quantum-computing 能力的协作。

## 期望
- 无匹配群 → 400，不创建任务。
