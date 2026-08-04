---
{
  "checks": [
    { "name": "创建团队 A", "method": "POST", "url": "/api/teams", "body": { "name": "S4L-TeamA", "user_id": "user-a" }, "expect": { "status": 201 }, "capture": { "s4TeamA": "id" } },
    { "name": "创建团队 B", "method": "POST", "url": "/api/teams", "body": { "name": "S4L-TeamB", "user_id": "user-b" }, "expect": { "status": 201 }, "capture": { "s4TeamB": "id" } },
    { "name": "创建群 A", "method": "POST", "url": "/api/groups", "body": { "name": "S4L-GA", "owner_team_id": "{{s4TeamA}}" }, "expect": { "status": 201 }, "capture": { "s4GroupA": "id" } },
    { "name": "创建群 B", "method": "POST", "url": "/api/groups", "body": { "name": "S4L-GB", "owner_team_id": "{{s4TeamB}}" }, "expect": { "status": 201 }, "capture": { "s4GroupB": "id" } },
    { "name": "群 A 创建域", "method": "POST", "url": "/api/domains", "body": { "name": "S4L-Dom", "owner_group_id": "{{s4GroupA}}" }, "expect": { "status": 201 }, "capture": { "s4Domain": "id" } },
    { "name": "生成邀请码", "method": "POST", "url": "/api/domains/{{s4Domain}}/invite", "body": {}, "expect": { "status": 200 }, "capture": { "s4Invite": "invite_code" } },
    { "name": "群 B 加入域", "method": "POST", "url": "/api/domains/join", "body": { "invite_code": "{{s4Invite}}", "group_id": "{{s4GroupB}}" }, "expect": { "status": 200 } },
    { "name": "群 B 声明能力", "method": "POST", "url": "/api/domains/{{s4Domain}}/capabilities", "body": { "group_id": "{{s4GroupB}}", "capabilities": ["data-analysis"] }, "expect": { "status": 200 } },
    { "name": "发起协作", "method": "POST", "url": "/api/domains/{{s4Domain}}/tasks", "body": { "requester_group_id": "{{s4GroupA}}", "title": "退出前协作", "required_capabilities": ["data-analysis"] }, "expect": { "status": 201 }, "capture": { "s4Task": "task_id" } },
    { "name": "退出前任务在域列表", "method": "GET", "url": "/api/domains/{{s4Domain}}/tasks?group_id={{s4GroupA}}", "expect": { "status": 200, "json": { "$any": { "task_id": "{{s4Task}}" } } } },
    { "name": "群 B 退出域", "method": "POST", "url": "/api/domains/{{s4Domain}}/leave", "body": { "group_id": "{{s4GroupB}}" }, "expect": { "status": 200 } },
    { "name": "退出后任务从域列表消失", "method": "GET", "url": "/api/domains/{{s4Domain}}/tasks?group_id={{s4GroupA}}", "expect": { "status": 200, "json": { "$none": { "task_id": "{{s4Task}}" } } } },
    { "name": "退出后评分 → 404", "method": "POST", "url": "/api/domains/{{s4Domain}}/tasks/{{s4Task}}/rating", "body": { "rater_group_id": "{{s4GroupA}}", "decision": "approved" }, "expect": { "status": 404 } },
    { "name": "群任务本身仍属群 B（域清理不碰群数据）", "method": "GET", "url": "/api/groups/{{s4GroupB}}/tasks", "expect": { "status": 200, "json": { "$any": { "id": "{{s4Task}}" } } } }
  ]
}
---
# 边界场景：群退出域清理协作任务索引

## 操作
1. 群 B 为域内协作任务的目标群。
2. 群 B 退出域。

## 期望
- 该协作任务从域任务列表消失（domain_tasks 索引已清理）。
- 原任务评分 → 404（索引不存在）。
- 群任务本身仍属于群 B（域层清理不碰群层数据）。
