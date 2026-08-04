---
{
  "checks": [
    { "name": "创建团队 A", "method": "POST", "url": "/api/teams", "body": { "name": "S3R1-TeamA", "user_id": "user-a" }, "expect": { "status": 201 }, "capture": { "s3TeamA": "id" } },
    { "name": "创建团队 B", "method": "POST", "url": "/api/teams", "body": { "name": "S3R1-TeamB", "user_id": "user-b" }, "expect": { "status": 201 }, "capture": { "s3TeamB": "id" } },
    { "name": "创建群 A", "method": "POST", "url": "/api/groups", "body": { "name": "S3R1-GA", "owner_team_id": "{{s3TeamA}}" }, "expect": { "status": 201 }, "capture": { "s3GroupA": "id" } },
    { "name": "创建群 B", "method": "POST", "url": "/api/groups", "body": { "name": "S3R1-GB", "owner_team_id": "{{s3TeamB}}" }, "expect": { "status": 201 }, "capture": { "s3GroupB": "id" } },
    { "name": "群 A 创建域", "method": "POST", "url": "/api/domains", "body": { "name": "S3R1-Dom", "owner_group_id": "{{s3GroupA}}" }, "expect": { "status": 201 }, "capture": { "s3Domain": "id" } },
    { "name": "生成邀请码", "method": "POST", "url": "/api/domains/{{s3Domain}}/invite", "body": {}, "expect": { "status": 200 }, "capture": { "s3Invite": "invite_code" } },
    { "name": "群 B 加入域", "method": "POST", "url": "/api/domains/join", "body": { "invite_code": "{{s3Invite}}", "group_id": "{{s3GroupB}}" }, "expect": { "status": 200 } },
    { "name": "群 B 声明能力", "method": "POST", "url": "/api/domains/{{s3Domain}}/capabilities", "body": { "group_id": "{{s3GroupB}}", "capabilities": ["data-analysis"] }, "expect": { "status": 200 } },
    { "name": "创建机器与 agent", "method": "POST", "url": "/api/machines", "body": { "name": "S3R1-MB" }, "expect": { "status": 201 }, "capture": { "s3Machine": "id" } },
    { "name": "创建执行 agent", "method": "POST", "url": "/api/agents", "body": { "machineId": "{{s3Machine}}", "name": "S3R1-AgentB", "runtime": "claude", "capabilities": ["data-analysis"] }, "expect": { "status": 201 }, "capture": { "s3Agent": "id" } },
    { "name": "agent 归属团队 B", "method": "PATCH", "url": "/api/agents/{{s3Agent}}", "body": { "team_id": "{{s3TeamB}}" }, "expect": { "status": 200 } },
    { "name": "发起协作", "method": "POST", "url": "/api/domains/{{s3Domain}}/tasks", "body": { "requester_group_id": "{{s3GroupA}}", "title": "唯一协作", "required_capabilities": ["data-analysis"] }, "expect": { "status": 201 }, "capture": { "s3T1": "task_id" } },
    { "name": "认领", "method": "POST", "url": "/api/tasks/{{s3T1}}/group-claim", "body": { "agent_id": "{{s3Agent}}", "team_id": "{{s3TeamB}}" }, "expect": { "status": 200 }, "capture": { "s3A1": "authorization_request_id" } },
    { "name": "批准", "method": "POST", "url": "/api/authorizations/{{s3A1}}/approve", "body": {}, "expect": { "status": 200 } },
    { "name": "完成", "method": "POST", "url": "/api/tasks/{{s3T1}}/force-complete", "body": {}, "expect": { "status": 200 } },
    { "name": "评分 rejected", "method": "POST", "url": "/api/domains/{{s3Domain}}/tasks/{{s3T1}}/rating", "body": { "rater_group_id": "{{s3GroupA}}", "decision": "rejected" }, "expect": { "status": 200 } },
    { "name": "单次拒绝不触发标记", "method": "GET", "url": "/api/domains/{{s3Domain}}/discover?capabilities=data-analysis&group_id={{s3GroupA}}", "expect": { "status": 200, "json": { "$any": { "group_id": "{{s3GroupB}}", "flagged": false } } } }
  ]
}
---
# 边界场景：单次评审拒绝不标记

## 操作
1. 一次完整协作闭环后评分 rejected。

## 期望
- 仅 1 次 rejected（< 5）→ flagged = false。
