---
{
  "checks": [
    { "name": "创建团队 A", "method": "POST", "url": "/api/teams", "body": { "name": "S3E-TeamA", "user_id": "user-a" }, "expect": { "status": 201 }, "capture": { "s3TeamA": "id" } },
    { "name": "创建团队 B", "method": "POST", "url": "/api/teams", "body": { "name": "S3E-TeamB", "user_id": "user-b" }, "expect": { "status": 201 }, "capture": { "s3TeamB": "id" } },
    { "name": "创建群 A", "method": "POST", "url": "/api/groups", "body": { "name": "S3E-GA", "owner_team_id": "{{s3TeamA}}" }, "expect": { "status": 201 }, "capture": { "s3GroupA": "id" } },
    { "name": "创建群 B", "method": "POST", "url": "/api/groups", "body": { "name": "S3E-GB", "owner_team_id": "{{s3TeamB}}" }, "expect": { "status": 201 }, "capture": { "s3GroupB": "id" } },
    { "name": "群 A 创建域", "method": "POST", "url": "/api/domains", "body": { "name": "S3E-Dom", "owner_group_id": "{{s3GroupA}}" }, "expect": { "status": 201 }, "capture": { "s3Domain": "id" } },
    { "name": "生成邀请码", "method": "POST", "url": "/api/domains/{{s3Domain}}/invite", "body": {}, "expect": { "status": 200 }, "capture": { "s3Invite": "invite_code" } },
    { "name": "群 B 加入域", "method": "POST", "url": "/api/domains/join", "body": { "invite_code": "{{s3Invite}}", "group_id": "{{s3GroupB}}" }, "expect": { "status": 200 } },
    { "name": "群 B 声明能力", "method": "POST", "url": "/api/domains/{{s3Domain}}/capabilities", "body": { "group_id": "{{s3GroupB}}", "capabilities": ["data-analysis"] }, "expect": { "status": 200 } },
    { "name": "创建机器 MB", "method": "POST", "url": "/api/machines", "body": { "name": "S3E-MB" }, "expect": { "status": 201 }, "capture": { "s3Machine": "id" } },
    { "name": "创建执行 agent（能力匹配）", "method": "POST", "url": "/api/agents", "body": { "machineId": "{{s3Machine}}", "name": "S3E-AgentB", "runtime": "claude", "capabilities": ["data-analysis"] }, "expect": { "status": 201 }, "capture": { "s3Agent": "id" } },
    { "name": "agent 归属团队 B", "method": "PATCH", "url": "/api/agents/{{s3Agent}}", "body": { "team_id": "{{s3TeamB}}" }, "expect": { "status": 200 } },
    { "name": "发起协作", "method": "POST", "url": "/api/domains/{{s3Domain}}/tasks", "body": { "requester_group_id": "{{s3GroupA}}", "title": "S3E 协作", "required_capabilities": ["data-analysis"] }, "expect": { "status": 201 }, "capture": { "s3Task": "task_id" } },
    { "name": "执行团队认领", "method": "POST", "url": "/api/tasks/{{s3Task}}/group-claim", "body": { "agent_id": "{{s3Agent}}", "team_id": "{{s3TeamB}}" }, "expect": { "status": 200 }, "capture": { "s3Auth": "authorization_request_id" } },
    { "name": "授权批准", "method": "POST", "url": "/api/authorizations/{{s3Auth}}/approve", "body": {}, "expect": { "status": 200 } },
    { "name": "任务完成", "method": "POST", "url": "/api/tasks/{{s3Task}}/force-complete", "body": {}, "expect": { "status": 200 } },
    { "name": "域级信誉反映协作完成（+1）", "method": "GET", "url": "/api/domains/{{s3Domain}}/reputation?group_id={{s3GroupA}}", "expect": { "status": 200, "json": { "$any": { "group_id": "{{s3GroupB}}", "reputation": 1 } } } }
  ]
}
---
# 成功场景：协作执行回流信誉

## 操作
1. 群 A 发起协作 → 域路由到群 B → 群 B 的 agent 认领 → 授权批准 → 任务完成。

## 期望
- 群层 recordTaskReputation 自动记录执行团队信誉（task_completed +1）。
- 域级信誉查询立即反映：群 B 的域级信誉 = 1（无需域层任何额外评分逻辑）。
