---
{
  "checks": [
    { "name": "创建团队 A", "method": "POST", "url": "/api/teams", "body": { "name": "S4X-TeamA", "user_id": "user-a" }, "expect": { "status": 201 }, "capture": { "s4TeamA": "id" } },
    { "name": "创建团队 B", "method": "POST", "url": "/api/teams", "body": { "name": "S4X-TeamB", "user_id": "user-b" }, "expect": { "status": 201 }, "capture": { "s4TeamB": "id" } },
    { "name": "创建团队 C", "method": "POST", "url": "/api/teams", "body": { "name": "S4X-TeamC", "user_id": "user-c" }, "expect": { "status": 201 }, "capture": { "s4TeamC": "id" } },
    { "name": "创建群 A", "method": "POST", "url": "/api/groups", "body": { "name": "S4X-GA", "owner_team_id": "{{s4TeamA}}" }, "expect": { "status": 201 }, "capture": { "s4GroupA": "id" } },
    { "name": "创建群 B", "method": "POST", "url": "/api/groups", "body": { "name": "S4X-GB", "owner_team_id": "{{s4TeamB}}" }, "expect": { "status": 201 }, "capture": { "s4GroupB": "id" } },
    { "name": "创建群 C", "method": "POST", "url": "/api/groups", "body": { "name": "S4X-GC", "owner_team_id": "{{s4TeamC}}" }, "expect": { "status": 201 }, "capture": { "s4GroupC": "id" } },
    { "name": "群 A 创建域 D1", "method": "POST", "url": "/api/domains", "body": { "name": "S4X-D1", "owner_group_id": "{{s4GroupA}}" }, "expect": { "status": 201 }, "capture": { "s4D1": "id" } },
    { "name": "群 A 创建域 D2", "method": "POST", "url": "/api/domains", "body": { "name": "S4X-D2", "owner_group_id": "{{s4GroupA}}" }, "expect": { "status": 201 }, "capture": { "s4D2": "id" } },
    { "name": "D1 邀请码", "method": "POST", "url": "/api/domains/{{s4D1}}/invite", "body": {}, "expect": { "status": 200 }, "capture": { "s4Inv1": "invite_code" } },
    { "name": "D2 邀请码", "method": "POST", "url": "/api/domains/{{s4D2}}/invite", "body": {}, "expect": { "status": 200 }, "capture": { "s4Inv2": "invite_code" } },
    { "name": "群 B 加入 D1", "method": "POST", "url": "/api/domains/join", "body": { "invite_code": "{{s4Inv1}}", "group_id": "{{s4GroupB}}" }, "expect": { "status": 200 } },
    { "name": "群 C 加入 D2", "method": "POST", "url": "/api/domains/join", "body": { "invite_code": "{{s4Inv2}}", "group_id": "{{s4GroupC}}" }, "expect": { "status": 200 } },
    { "name": "群 B 在 D1 声明能力", "method": "POST", "url": "/api/domains/{{s4D1}}/capabilities", "body": { "group_id": "{{s4GroupB}}", "capabilities": ["data-analysis"] }, "expect": { "status": 200 } },
    { "name": "D1 协作发起", "method": "POST", "url": "/api/domains/{{s4D1}}/tasks", "body": { "requester_group_id": "{{s4GroupA}}", "title": "D1 协作", "required_capabilities": ["data-analysis"] }, "expect": { "status": 201 }, "capture": { "s4Task": "task_id" } },
    { "name": "D1 任务列表含该任务", "method": "GET", "url": "/api/domains/{{s4D1}}/tasks?group_id={{s4GroupA}}", "expect": { "status": 200, "json": { "$any": { "task_id": "{{s4Task}}" } } } },
    { "name": "D2 任务列表不含 D1 任务", "method": "GET", "url": "/api/domains/{{s4D2}}/tasks?group_id={{s4GroupA}}", "expect": { "status": 200, "json": { "$none": { "task_id": "{{s4Task}}" } } } },
    { "name": "D2 成员 C 访问 D1 任务列表 → 403", "method": "GET", "url": "/api/domains/{{s4D1}}/tasks?group_id={{s4GroupC}}", "expect": { "status": 403 } },
    { "name": "D2 成员 C 访问 D1 发现 → 403", "method": "GET", "url": "/api/domains/{{s4D1}}/discover?capabilities=data-analysis&group_id={{s4GroupC}}", "expect": { "status": 403 } },
    { "name": "D2 成员 C 访问 D1 信誉 → 403", "method": "GET", "url": "/api/domains/{{s4D1}}/reputation?group_id={{s4GroupC}}", "expect": { "status": 403 } }
  ]
}
---
# 成功场景：跨域不可见

## 操作
1. 域 D1（成员 A、B）内有协作任务；域 D2（成员 A、C）独立。
2. 从 D2 视角查询 D1 的数据。

## 期望
- D2 的任务列表不含 D1 的协作任务。
- D2 成员 C（非 D1 成员）访问 D1 的任务/发现/信誉 → 403。
