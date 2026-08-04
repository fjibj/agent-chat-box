---
{
  "checks": [
    { "name": "创建团队 A", "method": "POST", "url": "/api/teams", "body": { "name": "S4D-TeamA", "user_id": "user-a" }, "expect": { "status": 201 }, "capture": { "s4TeamA": "id" } },
    { "name": "创建团队 B", "method": "POST", "url": "/api/teams", "body": { "name": "S4D-TeamB", "user_id": "user-b" }, "expect": { "status": 201 }, "capture": { "s4TeamB": "id" } },
    { "name": "创建群 A", "method": "POST", "url": "/api/groups", "body": { "name": "S4D-GA", "owner_team_id": "{{s4TeamA}}" }, "expect": { "status": 201 }, "capture": { "s4GroupA": "id" } },
    { "name": "创建群 B", "method": "POST", "url": "/api/groups", "body": { "name": "S4D-GB", "owner_team_id": "{{s4TeamB}}" }, "expect": { "status": 201 }, "capture": { "s4GroupB": "id" } },
    { "name": "群 A 创建域", "method": "POST", "url": "/api/domains", "body": { "name": "S4D-Dom", "owner_group_id": "{{s4GroupA}}" }, "expect": { "status": 201 }, "capture": { "s4Domain": "id" } },
    { "name": "生成邀请码", "method": "POST", "url": "/api/domains/{{s4Domain}}/invite", "body": {}, "expect": { "status": 200 }, "capture": { "s4Invite": "invite_code" } },
    { "name": "群 B 加入域", "method": "POST", "url": "/api/domains/join", "body": { "invite_code": "{{s4Invite}}", "group_id": "{{s4GroupB}}" }, "expect": { "status": 200 } },
    { "name": "群 B 声明能力", "method": "POST", "url": "/api/domains/{{s4Domain}}/capabilities", "body": { "group_id": "{{s4GroupB}}", "capabilities": ["data-analysis"] }, "expect": { "status": 200 } },
    { "name": "发起协作", "method": "POST", "url": "/api/domains/{{s4Domain}}/tasks", "body": { "requester_group_id": "{{s4GroupA}}", "title": "解散前协作", "required_capabilities": ["data-analysis"] }, "expect": { "status": 201 }, "capture": { "s4Task": "task_id" } },
    { "name": "解散域", "method": "DELETE", "url": "/api/domains/{{s4Domain}}", "body": {}, "expect": { "status": 200 } },
    { "name": "域任务列表 404", "method": "GET", "url": "/api/domains/{{s4Domain}}/tasks?group_id={{s4GroupA}}", "expect": { "status": 404 } },
    { "name": "域信誉查询 404", "method": "GET", "url": "/api/domains/{{s4Domain}}/reputation?group_id={{s4GroupA}}", "expect": { "status": 404 } },
    { "name": "原协作任务评分 404", "method": "POST", "url": "/api/domains/{{s4Domain}}/tasks/{{s4Task}}/rating", "body": { "rater_group_id": "{{s4GroupA}}", "decision": "approved" }, "expect": { "status": 404 } }
  ]
}
---
# 边界场景：解散域清理协作任务索引

## 操作
1. 域内存在协作任务（含 domain_tasks 索引）。
2. 解散域。

## 期望
- 解散后域 API 全部 404（域已删除）。
- 原协作任务不可再评分（域不存在 → 404）。
- domain_tasks 记录随域清理（由构建侧单测验证表内无残留）。
