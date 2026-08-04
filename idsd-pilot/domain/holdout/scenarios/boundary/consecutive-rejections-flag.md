---
{
  "checks": [
    { "name": "创建团队 A", "method": "POST", "url": "/api/teams", "body": { "name": "S3F5-TeamA", "user_id": "user-a" }, "expect": { "status": 201 }, "capture": { "s3TeamA": "id" } },
    { "name": "创建团队 B", "method": "POST", "url": "/api/teams", "body": { "name": "S3F5-TeamB", "user_id": "user-b" }, "expect": { "status": 201 }, "capture": { "s3TeamB": "id" } },
    { "name": "创建群 A", "method": "POST", "url": "/api/groups", "body": { "name": "S3F5-GA", "owner_team_id": "{{s3TeamA}}" }, "expect": { "status": 201 }, "capture": { "s3GroupA": "id" } },
    { "name": "创建群 B", "method": "POST", "url": "/api/groups", "body": { "name": "S3F5-GB", "owner_team_id": "{{s3TeamB}}" }, "expect": { "status": 201 }, "capture": { "s3GroupB": "id" } },
    { "name": "群 A 创建域", "method": "POST", "url": "/api/domains", "body": { "name": "S3F5-Dom", "owner_group_id": "{{s3GroupA}}" }, "expect": { "status": 201 }, "capture": { "s3Domain": "id" } },
    { "name": "生成邀请码", "method": "POST", "url": "/api/domains/{{s3Domain}}/invite", "body": {}, "expect": { "status": 200 }, "capture": { "s3Invite": "invite_code" } },
    { "name": "群 B 加入域", "method": "POST", "url": "/api/domains/join", "body": { "invite_code": "{{s3Invite}}", "group_id": "{{s3GroupB}}" }, "expect": { "status": 200 } },
    { "name": "群 B 声明能力", "method": "POST", "url": "/api/domains/{{s3Domain}}/capabilities", "body": { "group_id": "{{s3GroupB}}", "capabilities": ["data-analysis"] }, "expect": { "status": 200 } },
    { "name": "创建机器与 agent", "method": "POST", "url": "/api/machines", "body": { "name": "S3F5-MB" }, "expect": { "status": 201 }, "capture": { "s3Machine": "id" } },
    { "name": "创建执行 agent", "method": "POST", "url": "/api/agents", "body": { "machineId": "{{s3Machine}}", "name": "S3F5-AgentB", "runtime": "claude", "capabilities": ["data-analysis"] }, "expect": { "status": 201 }, "capture": { "s3Agent": "id" } },
    { "name": "agent 归属团队 B", "method": "PATCH", "url": "/api/agents/{{s3Agent}}", "body": { "team_id": "{{s3TeamB}}" }, "expect": { "status": 200 } },
    { "name": "协作 1 发起", "method": "POST", "url": "/api/domains/{{s3Domain}}/tasks", "body": { "requester_group_id": "{{s3GroupA}}", "title": "协作 1", "required_capabilities": ["data-analysis"] }, "expect": { "status": 201 }, "capture": { "s3T1": "task_id" } },
    { "name": "协作 1 认领", "method": "POST", "url": "/api/tasks/{{s3T1}}/group-claim", "body": { "agent_id": "{{s3Agent}}", "team_id": "{{s3TeamB}}" }, "expect": { "status": 200 }, "capture": { "s3A1": "authorization_request_id" } },
    { "name": "协作 1 批准", "method": "POST", "url": "/api/authorizations/{{s3A1}}/approve", "body": {}, "expect": { "status": 200 } },
    { "name": "协作 1 完成", "method": "POST", "url": "/api/tasks/{{s3T1}}/force-complete", "body": {}, "expect": { "status": 200 } },
    { "name": "协作 1 评分 rejected", "method": "POST", "url": "/api/domains/{{s3Domain}}/tasks/{{s3T1}}/rating", "body": { "rater_group_id": "{{s3GroupA}}", "decision": "rejected" }, "expect": { "status": 200 } },
    { "name": "协作 2 发起", "method": "POST", "url": "/api/domains/{{s3Domain}}/tasks", "body": { "requester_group_id": "{{s3GroupA}}", "title": "协作 2", "required_capabilities": ["data-analysis"] }, "expect": { "status": 201 }, "capture": { "s3T2": "task_id" } },
    { "name": "协作 2 认领", "method": "POST", "url": "/api/tasks/{{s3T2}}/group-claim", "body": { "agent_id": "{{s3Agent}}", "team_id": "{{s3TeamB}}" }, "expect": { "status": 200 }, "capture": { "s3A2": "authorization_request_id" } },
    { "name": "协作 2 批准", "method": "POST", "url": "/api/authorizations/{{s3A2}}/approve", "body": {}, "expect": { "status": 200 } },
    { "name": "协作 2 完成", "method": "POST", "url": "/api/tasks/{{s3T2}}/force-complete", "body": {}, "expect": { "status": 200 } },
    { "name": "协作 2 评分 rejected", "method": "POST", "url": "/api/domains/{{s3Domain}}/tasks/{{s3T2}}/rating", "body": { "rater_group_id": "{{s3GroupA}}", "decision": "rejected" }, "expect": { "status": 200 } },
    { "name": "协作 3 发起", "method": "POST", "url": "/api/domains/{{s3Domain}}/tasks", "body": { "requester_group_id": "{{s3GroupA}}", "title": "协作 3", "required_capabilities": ["data-analysis"] }, "expect": { "status": 201 }, "capture": { "s3T3": "task_id" } },
    { "name": "协作 3 认领", "method": "POST", "url": "/api/tasks/{{s3T3}}/group-claim", "body": { "agent_id": "{{s3Agent}}", "team_id": "{{s3TeamB}}" }, "expect": { "status": 200 }, "capture": { "s3A3": "authorization_request_id" } },
    { "name": "协作 3 批准", "method": "POST", "url": "/api/authorizations/{{s3A3}}/approve", "body": {}, "expect": { "status": 200 } },
    { "name": "协作 3 完成", "method": "POST", "url": "/api/tasks/{{s3T3}}/force-complete", "body": {}, "expect": { "status": 200 } },
    { "name": "协作 3 评分 rejected", "method": "POST", "url": "/api/domains/{{s3Domain}}/tasks/{{s3T3}}/rating", "body": { "rater_group_id": "{{s3GroupA}}", "decision": "rejected" }, "expect": { "status": 200 } },
    { "name": "协作 4 发起", "method": "POST", "url": "/api/domains/{{s3Domain}}/tasks", "body": { "requester_group_id": "{{s3GroupA}}", "title": "协作 4", "required_capabilities": ["data-analysis"] }, "expect": { "status": 201 }, "capture": { "s3T4": "task_id" } },
    { "name": "协作 4 认领", "method": "POST", "url": "/api/tasks/{{s3T4}}/group-claim", "body": { "agent_id": "{{s3Agent}}", "team_id": "{{s3TeamB}}" }, "expect": { "status": 200 }, "capture": { "s3A4": "authorization_request_id" } },
    { "name": "协作 4 批准", "method": "POST", "url": "/api/authorizations/{{s3A4}}/approve", "body": {}, "expect": { "status": 200 } },
    { "name": "协作 4 完成", "method": "POST", "url": "/api/tasks/{{s3T4}}/force-complete", "body": {}, "expect": { "status": 200 } },
    { "name": "协作 4 评分 rejected", "method": "POST", "url": "/api/domains/{{s3Domain}}/tasks/{{s3T4}}/rating", "body": { "rater_group_id": "{{s3GroupA}}", "decision": "rejected" }, "expect": { "status": 200 } },
    { "name": "协作 5 发起", "method": "POST", "url": "/api/domains/{{s3Domain}}/tasks", "body": { "requester_group_id": "{{s3GroupA}}", "title": "协作 5", "required_capabilities": ["data-analysis"] }, "expect": { "status": 201 }, "capture": { "s3T5": "task_id" } },
    { "name": "协作 5 认领", "method": "POST", "url": "/api/tasks/{{s3T5}}/group-claim", "body": { "agent_id": "{{s3Agent}}", "team_id": "{{s3TeamB}}" }, "expect": { "status": 200 }, "capture": { "s3A5": "authorization_request_id" } },
    { "name": "协作 5 批准", "method": "POST", "url": "/api/authorizations/{{s3A5}}/approve", "body": {}, "expect": { "status": 200 } },
    { "name": "协作 5 完成", "method": "POST", "url": "/api/tasks/{{s3T5}}/force-complete", "body": {}, "expect": { "status": 200 } },
    { "name": "协作 5 评分 rejected", "method": "POST", "url": "/api/domains/{{s3Domain}}/tasks/{{s3T5}}/rating", "body": { "rater_group_id": "{{s3GroupA}}", "decision": "rejected" }, "expect": { "status": 200 } },
    { "name": "发现结果中 B 被标记", "method": "GET", "url": "/api/domains/{{s3Domain}}/discover?capabilities=data-analysis&group_id={{s3GroupA}}", "expect": { "status": 200, "json": { "$any": { "group_id": "{{s3GroupB}}", "flagged": true } } } },
    { "name": "信誉查询中 B 同样被标记", "method": "GET", "url": "/api/domains/{{s3Domain}}/reputation?group_id={{s3GroupA}}", "expect": { "status": 200, "json": { "$any": { "group_id": "{{s3GroupB}}", "flagged": true } } } }
  ]
}
---
# 边界场景：连续 5 次评审拒绝 → 降级标记

## 操作
1. 群 A 发起 5 次协作，群 B 全部完成，A 全部评 rejected。

## 期望
- 群 B 连续 5 次 review_rejected → discover 与 reputation 结果中 flagged = true（能力被标记）。
