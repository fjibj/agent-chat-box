---
{
  "checks": [
    { "name": "创建团队 A（发起方）", "method": "POST", "url": "/api/teams", "body": { "name": "S3-TeamA", "user_id": "user-a" }, "expect": { "status": 201 }, "capture": { "s3TeamA": "id" } },
    { "name": "创建团队 B（执行方）", "method": "POST", "url": "/api/teams", "body": { "name": "S3-TeamB", "user_id": "user-b" }, "expect": { "status": 201 }, "capture": { "s3TeamB": "id" } },
    { "name": "创建群 A", "method": "POST", "url": "/api/groups", "body": { "name": "S3-GA", "owner_team_id": "{{s3TeamA}}" }, "expect": { "status": 201 }, "capture": { "s3GroupA": "id" } },
    { "name": "创建群 B（owner=TeamB）", "method": "POST", "url": "/api/groups", "body": { "name": "S3-GB", "owner_team_id": "{{s3TeamB}}" }, "expect": { "status": 201 }, "capture": { "s3GroupB": "id" } },
    { "name": "群 A 创建域", "method": "POST", "url": "/api/domains", "body": { "name": "S3-Dom", "owner_group_id": "{{s3GroupA}}" }, "expect": { "status": 201 }, "capture": { "s3Domain": "id" } },
    { "name": "生成邀请码", "method": "POST", "url": "/api/domains/{{s3Domain}}/invite", "body": {}, "expect": { "status": 200 }, "capture": { "s3Invite": "invite_code" } },
    { "name": "群 B 加入域", "method": "POST", "url": "/api/domains/join", "body": { "invite_code": "{{s3Invite}}", "group_id": "{{s3GroupB}}" }, "expect": { "status": 200 } },
    { "name": "群 B 声明 data-analysis 能力", "method": "POST", "url": "/api/domains/{{s3Domain}}/capabilities", "body": { "group_id": "{{s3GroupB}}", "capabilities": ["data-analysis"] }, "expect": { "status": 200 } },
    { "name": "群 A 发起协作", "method": "POST", "url": "/api/domains/{{s3Domain}}/tasks", "body": { "requester_group_id": "{{s3GroupA}}", "title": "分析报表", "required_capabilities": ["data-analysis"] }, "expect": { "status": 201 }, "capture": { "s3Task": "task_id", "s3Target": "target_group_id" } },
    { "name": "路由目标为群 B", "method": "GET", "url": "/api/domains/{{s3Domain}}/tasks?group_id={{s3GroupA}}", "expect": { "status": 200, "json": { "$any": { "task_id": "{{s3Task}}", "target_group_id": "{{s3GroupB}}" } } } },
    { "name": "任务出现在群 B 的群任务列表", "method": "GET", "url": "/api/groups/{{s3GroupB}}/tasks", "expect": { "status": 200, "json": { "$any": { "id": "{{s3Task}}" } } } },
    { "name": "任务初始状态 pending", "method": "GET", "url": "/api/tasks/{{s3Task}}", "expect": { "status": 200, "json": { "status": "pending" } } },
    { "name": "未完成的任务评分 → 400", "method": "POST", "url": "/api/domains/{{s3Domain}}/tasks/{{s3Task}}/rating", "body": { "rater_group_id": "{{s3GroupA}}", "decision": "approved" }, "expect": { "status": 400 } }
  ]
}
---
# 成功场景：域协作发起与自动路由

## 操作
1. 域内群 A（发起方）与群 B（声明 data-analysis）入域。
2. 群 A 发起协作任务，要求 data-analysis 能力。

## 期望
- 域自动路由到唯一匹配的群 B（返回 task_id 与 target_group_id）。
- 任务出现在群 B 的群任务列表，初始状态 pending。
- 域协作任务列表可见该任务。
- 任务未完成时评分 → 400。
