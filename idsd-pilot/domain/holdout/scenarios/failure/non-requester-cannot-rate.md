---
{
  "checks": [
    { "name": "创建团队 A", "method": "POST", "url": "/api/teams", "body": { "name": "S3F-TeamA", "user_id": "user-a" }, "expect": { "status": 201 }, "capture": { "s3TeamA": "id" } },
    { "name": "创建团队 B", "method": "POST", "url": "/api/teams", "body": { "name": "S3F-TeamB", "user_id": "user-b" }, "expect": { "status": 201 }, "capture": { "s3TeamB": "id" } },
    { "name": "创建群 A", "method": "POST", "url": "/api/groups", "body": { "name": "S3F-GA", "owner_team_id": "{{s3TeamA}}" }, "expect": { "status": 201 }, "capture": { "s3GroupA": "id" } },
    { "name": "创建群 B", "method": "POST", "url": "/api/groups", "body": { "name": "S3F-GB", "owner_team_id": "{{s3TeamB}}" }, "expect": { "status": 201 }, "capture": { "s3GroupB": "id" } },
    { "name": "创建群 C（同样属于 TeamA）", "method": "POST", "url": "/api/groups", "body": { "name": "S3F-GC", "owner_team_id": "{{s3TeamA}}" }, "expect": { "status": 201 }, "capture": { "s3GroupC": "id" } },
    { "name": "群 A 创建域", "method": "POST", "url": "/api/domains", "body": { "name": "S3F-Dom", "owner_group_id": "{{s3GroupA}}" }, "expect": { "status": 201 }, "capture": { "s3Domain": "id" } },
    { "name": "生成邀请码", "method": "POST", "url": "/api/domains/{{s3Domain}}/invite", "body": { "max_uses": 5 }, "expect": { "status": 200 }, "capture": { "s3Invite": "invite_code" } },
    { "name": "群 B 加入域", "method": "POST", "url": "/api/domains/join", "body": { "invite_code": "{{s3Invite}}", "group_id": "{{s3GroupB}}" }, "expect": { "status": 200 } },
    { "name": "群 C 加入域", "method": "POST", "url": "/api/domains/join", "body": { "invite_code": "{{s3Invite}}", "group_id": "{{s3GroupC}}" }, "expect": { "status": 200 } },
    { "name": "群 B 声明能力", "method": "POST", "url": "/api/domains/{{s3Domain}}/capabilities", "body": { "group_id": "{{s3GroupB}}", "capabilities": ["data-analysis"] }, "expect": { "status": 200 } },
    { "name": "创建机器与 agent", "method": "POST", "url": "/api/machines", "body": { "name": "S3F-MB" }, "expect": { "status": 201 }, "capture": { "s3Machine": "id" } },
    { "name": "创建执行 agent", "method": "POST", "url": "/api/agents", "body": { "machineId": "{{s3Machine}}", "name": "S3F-AgentB", "runtime": "claude", "capabilities": ["data-analysis"] }, "expect": { "status": 201 }, "capture": { "s3Agent": "id" } },
    { "name": "agent 归属团队 B", "method": "PATCH", "url": "/api/agents/{{s3Agent}}", "body": { "team_id": "{{s3TeamB}}" }, "expect": { "status": 200 } },
    { "name": "群 A 发起协作", "method": "POST", "url": "/api/domains/{{s3Domain}}/tasks", "body": { "requester_group_id": "{{s3GroupA}}", "title": "S3F 协作", "required_capabilities": ["data-analysis"] }, "expect": { "status": 201 }, "capture": { "s3Task": "task_id" } },
    { "name": "执行团队认领", "method": "POST", "url": "/api/tasks/{{s3Task}}/group-claim", "body": { "agent_id": "{{s3Agent}}", "team_id": "{{s3TeamB}}" }, "expect": { "status": 200 }, "capture": { "s3Auth": "authorization_request_id" } },
    { "name": "授权批准", "method": "POST", "url": "/api/authorizations/{{s3Auth}}/approve", "body": {}, "expect": { "status": 200 } },
    { "name": "任务完成", "method": "POST", "url": "/api/tasks/{{s3Task}}/force-complete", "body": {}, "expect": { "status": 200 } },
    { "name": "非发起群 C 评分 → 403", "method": "POST", "url": "/api/domains/{{s3Domain}}/tasks/{{s3Task}}/rating", "body": { "rater_group_id": "{{s3GroupC}}", "decision": "rejected" }, "expect": { "status": 403 } }
  ]
}
---
# 失败场景：评分权限校验

## 操作
1. 完整协作闭环后，非发起群 C（同为域成员）尝试评分。

## 期望
- 非发起群（域成员但非 requester）评分 → 403。
