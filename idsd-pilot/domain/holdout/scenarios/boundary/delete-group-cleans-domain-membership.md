---
{
  "checks": [
    { "name": "创建团队 A", "method": "POST", "url": "/api/teams", "body": { "name": "S4G-TeamA", "user_id": "user-a" }, "expect": { "status": 201 }, "capture": { "s4TeamA": "id" } },
    { "name": "创建团队 B", "method": "POST", "url": "/api/teams", "body": { "name": "S4G-TeamB", "user_id": "user-b" }, "expect": { "status": 201 }, "capture": { "s4TeamB": "id" } },
    { "name": "创建群 A（域 owner）", "method": "POST", "url": "/api/groups", "body": { "name": "S4G-GA", "owner_team_id": "{{s4TeamA}}" }, "expect": { "status": 201 }, "capture": { "s4GroupA": "id" } },
    { "name": "创建群 B（域成员）", "method": "POST", "url": "/api/groups", "body": { "name": "S4G-GB", "owner_team_id": "{{s4TeamB}}" }, "expect": { "status": 201 }, "capture": { "s4GroupB": "id" } },
    { "name": "群 A 创建域", "method": "POST", "url": "/api/domains", "body": { "name": "S4G-Dom", "owner_group_id": "{{s4GroupA}}" }, "expect": { "status": 201 }, "capture": { "s4Domain": "id" } },
    { "name": "生成邀请码", "method": "POST", "url": "/api/domains/{{s4Domain}}/invite", "body": {}, "expect": { "status": 200 }, "capture": { "s4Invite": "invite_code" } },
    { "name": "群 B 加入域", "method": "POST", "url": "/api/domains/join", "body": { "invite_code": "{{s4Invite}}", "group_id": "{{s4GroupB}}" }, "expect": { "status": 200 } },
    { "name": "群 B 声明能力", "method": "POST", "url": "/api/domains/{{s4Domain}}/capabilities", "body": { "group_id": "{{s4GroupB}}", "capabilities": ["data-analysis"] }, "expect": { "status": 200 } },
    { "name": "发起协作", "method": "POST", "url": "/api/domains/{{s4Domain}}/tasks", "body": { "requester_group_id": "{{s4GroupA}}", "title": "删群前协作", "required_capabilities": ["data-analysis"] }, "expect": { "status": 201 }, "capture": { "s4Task": "task_id" } },
    { "name": "删除成员群 B", "method": "DELETE", "url": "/api/groups/{{s4GroupB}}", "body": {}, "expect": { "status": 200 } },
    { "name": "能力列表不再含 B", "method": "GET", "url": "/api/domains/{{s4Domain}}/capabilities", "expect": { "status": 200, "json": { "$none": { "group_id": "{{s4GroupB}}" } } } },
    { "name": "域任务列表不再含该协作", "method": "GET", "url": "/api/domains/{{s4Domain}}/tasks?group_id={{s4GroupA}}", "expect": { "status": 200, "json": { "$none": { "task_id": "{{s4Task}}" } } } },
    { "name": "删除 owner 群 A → 域解散", "method": "DELETE", "url": "/api/groups/{{s4GroupA}}", "body": {}, "expect": { "status": 200 } },
    { "name": "域详情 404", "method": "GET", "url": "/api/domains/{{s4Domain}}", "expect": { "status": 404 } },
    { "name": "域任务列表 404", "method": "GET", "url": "/api/domains/{{s4Domain}}/tasks?group_id={{s4GroupA}}", "expect": { "status": 404 } }
  ]
}
---
# 边界场景：删群级联清理域数据

## 操作
1. 删除域成员群 B。
2. 删除域 owner 群 A。

## 期望
- 删 B 后：B 从能力列表消失，其协作任务索引消失（域任务列表不含）。
- 删 A 后：A 拥有的域被解散（域详情 404、任务列表 404），协作任务索引一并清理。
