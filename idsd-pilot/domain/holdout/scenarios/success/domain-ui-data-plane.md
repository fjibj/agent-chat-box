---
{
  "checks": [
    { "name": "创建团队 A", "method": "POST", "url": "/api/teams", "body": { "name": "S5U-TeamA", "user_id": "user-a" }, "expect": { "status": 201 }, "capture": { "s5TeamA": "id" } },
    { "name": "创建团队 B", "method": "POST", "url": "/api/teams", "body": { "name": "S5U-TeamB", "user_id": "user-b" }, "expect": { "status": 201 }, "capture": { "s5TeamB": "id" } },
    { "name": "创建群 A", "method": "POST", "url": "/api/groups", "body": { "name": "S5U-GA", "owner_team_id": "{{s5TeamA}}" }, "expect": { "status": 201 }, "capture": { "s5GroupA": "id" } },
    { "name": "创建群 B", "method": "POST", "url": "/api/groups", "body": { "name": "S5U-GB", "owner_team_id": "{{s5TeamB}}" }, "expect": { "status": 201 }, "capture": { "s5GroupB": "id" } },
    { "name": "UI-创建域", "method": "POST", "url": "/api/domains", "body": { "name": "S5U-Dom", "owner_group_id": "{{s5GroupA}}" }, "expect": { "status": 201 }, "capture": { "s5Domain": "id" } },
    { "name": "UI-域列表（群 A 视角）", "method": "GET", "url": "/api/domains?group_id={{s5GroupA}}", "expect": { "status": 200, "json": { "$any": { "id": "{{s5Domain}}", "name": "S5U-Dom" } } } },
    { "name": "UI-生成邀请码", "method": "POST", "url": "/api/domains/{{s5Domain}}/invite", "body": {}, "expect": { "status": 200 }, "capture": { "s5Invite": "invite_code" } },
    { "name": "UI-群 B 加入", "method": "POST", "url": "/api/domains/join", "body": { "invite_code": "{{s5Invite}}", "group_id": "{{s5GroupB}}" }, "expect": { "status": 200 } },
    { "name": "UI-域详情（含成员）", "method": "GET", "url": "/api/domains/{{s5Domain}}", "expect": { "status": 200, "json": { "members": { "$any": { "group_id": "{{s5GroupB}}" } } } } },
    { "name": "UI-群 B 声明能力", "method": "POST", "url": "/api/domains/{{s5Domain}}/capabilities", "body": { "group_id": "{{s5GroupB}}", "capabilities": ["data-analysis"] }, "expect": { "status": 200 } },
    { "name": "UI-成员能力列表", "method": "GET", "url": "/api/domains/{{s5Domain}}/capabilities", "expect": { "status": 200, "json": { "$any": { "group_id": "{{s5GroupB}}", "capabilities": { "$any": { "$eq": "data-analysis" } } } } } },
    { "name": "UI-发现（信誉+flagged）", "method": "GET", "url": "/api/domains/{{s5Domain}}/discover?capabilities=data-analysis&group_id={{s5GroupA}}", "expect": { "status": 200, "json": { "$any": { "group_id": "{{s5GroupB}}", "reputation": 0, "flagged": false } } } },
    { "name": "UI-发起协作", "method": "POST", "url": "/api/domains/{{s5Domain}}/tasks", "body": { "requester_group_id": "{{s5GroupA}}", "title": "UI 协作", "required_capabilities": ["data-analysis"] }, "expect": { "status": 201 }, "capture": { "s5Task": "task_id" } },
    { "name": "UI-任务列表", "method": "GET", "url": "/api/domains/{{s5Domain}}/tasks?group_id={{s5GroupA}}", "expect": { "status": 200, "json": { "$any": { "task_id": "{{s5Task}}" } } } },
    { "name": "UI-信誉看板", "method": "GET", "url": "/api/domains/{{s5Domain}}/reputation?group_id={{s5GroupA}}", "expect": { "status": 200, "json": { "$any": { "group_id": "{{s5GroupB}}", "reputation": 0 } } } }
  ]
}
---
# 成功场景：UI 数据面全链路回归

## 操作
以 DomainsPage 的 8 个功能块为序，逐一调用其依赖的 API（创建→列表→邀请→加入→详情→能力→发现→协作→任务→信誉）。

## 期望
- 所有 UI 依赖端点均可用且返回形状符合 UI 展示需求。
- 发现结果含 reputation 与 flagged 字段；域详情含 members。
- 说明：认领一步预期 400（agent-s5u 不存在），仅验证数据面端点可达性，不进入执行链路。
