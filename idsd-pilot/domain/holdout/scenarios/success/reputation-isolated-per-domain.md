---
{
  "checks": [
    { "name": "创建团队 A", "method": "POST", "url": "/api/teams", "body": { "name": "S4I-TeamA", "user_id": "user-a" }, "expect": { "status": 201 }, "capture": { "s4TeamA": "id" } },
    { "name": "创建团队 B", "method": "POST", "url": "/api/teams", "body": { "name": "S4I-TeamB", "user_id": "user-b" }, "expect": { "status": 201 }, "capture": { "s4TeamB": "id" } },
    { "name": "创建群 A", "method": "POST", "url": "/api/groups", "body": { "name": "S4I-GA", "owner_team_id": "{{s4TeamA}}" }, "expect": { "status": 201 }, "capture": { "s4GroupA": "id" } },
    { "name": "创建群 B", "method": "POST", "url": "/api/groups", "body": { "name": "S4I-GB", "owner_team_id": "{{s4TeamB}}" }, "expect": { "status": 201 }, "capture": { "s4GroupB": "id" } },
    { "name": "群 A 创建域 D1", "method": "POST", "url": "/api/domains", "body": { "name": "S4I-D1", "owner_group_id": "{{s4GroupA}}" }, "expect": { "status": 201 }, "capture": { "s4D1": "id" } },
    { "name": "群 A 创建域 D2", "method": "POST", "url": "/api/domains", "body": { "name": "S4I-D2", "owner_group_id": "{{s4GroupA}}" }, "expect": { "status": 201 }, "capture": { "s4D2": "id" } },
    { "name": "D1 邀请码", "method": "POST", "url": "/api/domains/{{s4D1}}/invite", "body": {}, "expect": { "status": 200 }, "capture": { "s4Inv1": "invite_code" } },
    { "name": "D2 邀请码", "method": "POST", "url": "/api/domains/{{s4D2}}/invite", "body": {}, "expect": { "status": 200 }, "capture": { "s4Inv2": "invite_code" } },
    { "name": "群 B 加入 D1", "method": "POST", "url": "/api/domains/join", "body": { "invite_code": "{{s4Inv1}}", "group_id": "{{s4GroupB}}" }, "expect": { "status": 200 } },
    { "name": "群 B 加入 D2", "method": "POST", "url": "/api/domains/join", "body": { "invite_code": "{{s4Inv2}}", "group_id": "{{s4GroupB}}" }, "expect": { "status": 200 } },
    { "name": "群 B 在 D1 声明能力", "method": "POST", "url": "/api/domains/{{s4D1}}/capabilities", "body": { "group_id": "{{s4GroupB}}", "capabilities": ["data-analysis"] }, "expect": { "status": 200 } },
    { "name": "群 B 在 D2 声明能力", "method": "POST", "url": "/api/domains/{{s4D2}}/capabilities", "body": { "group_id": "{{s4GroupB}}", "capabilities": ["data-analysis"] }, "expect": { "status": 200 } },
    { "name": "创建机器与 agent", "method": "POST", "url": "/api/machines", "body": { "name": "S4I-MB" }, "expect": { "status": 201 }, "capture": { "s4Machine": "id" } },
    { "name": "创建执行 agent", "method": "POST", "url": "/api/agents", "body": { "machineId": "{{s4Machine}}", "name": "S4I-AgentB", "runtime": "claude", "capabilities": ["data-analysis"] }, "expect": { "status": 201 }, "capture": { "s4Agent": "id" } },
    { "name": "agent 归属团队 B", "method": "PATCH", "url": "/api/agents/{{s4Agent}}", "body": { "team_id": "{{s4TeamB}}" }, "expect": { "status": 200 } },
    { "name": "D1 协作发起", "method": "POST", "url": "/api/domains/{{s4D1}}/tasks", "body": { "requester_group_id": "{{s4GroupA}}", "title": "D1 协作", "required_capabilities": ["data-analysis"] }, "expect": { "status": 201 }, "capture": { "s4Task": "task_id" } },
    { "name": "认领", "method": "POST", "url": "/api/tasks/{{s4Task}}/group-claim", "body": { "agent_id": "{{s4Agent}}", "team_id": "{{s4TeamB}}" }, "expect": { "status": 200 }, "capture": { "s4Auth": "authorization_request_id" } },
    { "name": "批准", "method": "POST", "url": "/api/authorizations/{{s4Auth}}/approve", "body": {}, "expect": { "status": 200 } },
    { "name": "完成", "method": "POST", "url": "/api/tasks/{{s4Task}}/force-complete", "body": {}, "expect": { "status": 200 } },
    { "name": "D1 评分 rejected", "method": "POST", "url": "/api/domains/{{s4D1}}/tasks/{{s4Task}}/rating", "body": { "rater_group_id": "{{s4GroupA}}", "decision": "rejected" }, "expect": { "status": 200 } },
    { "name": "D1 中群 B 信誉 = -1", "method": "GET", "url": "/api/domains/{{s4D1}}/reputation?group_id={{s4GroupA}}", "expect": { "status": 200, "json": { "$any": { "group_id": "{{s4GroupB}}", "reputation": -1 } } } },
    { "name": "D2 中群 B 信誉不受影响 = 0", "method": "GET", "url": "/api/domains/{{s4D2}}/reputation?group_id={{s4GroupA}}", "expect": { "status": 200, "json": { "$any": { "group_id": "{{s4GroupB}}", "reputation": 0 } } } }
  ]
}
---
# 成功场景：域级信誉隔离

## 操作
1. 群 B 同属域 D1、D2，并在两域声明相同能力。
2. 群 A 在 D1 发起协作 → B 执行 → 评分 rejected（-2，叠加完成 +1 = -1）。

## 期望
- 群 B 在 D1 的信誉 = -1（评分生效）。
- 群 B 在 D2 的信誉 = 0（域 A 的评分事件不跨域传播）。
