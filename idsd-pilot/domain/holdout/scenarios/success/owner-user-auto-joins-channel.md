---
{
  "checks": [
    {
      "name": "创建群",
      "method": "POST",
      "url": "/api/groups",
      "body": { "name": "Owner-Join-Test", "owner_team_id": "team-default" },
      "expect": { "status": 201 },
      "capture": { "channelId": "channel_id" }
    },
    {
      "name": "群主用户自动成为频道成员",
      "method": "GET",
      "url": "/api/channels/{{channelId}}/members",
      "expect": {
        "status": 200,
        "json": { "members": { "$any": { "memberId": "user-default", "memberKind": "human" } } }
      }
    }
  ]
}
---
# 成功场景：群主用户自动加入群聊频道

## 操作
1. 调用 `POST /api/groups`（owner_team_id=team-default，其 owner_user_id 为 user-default）。

## 期望
- 该群自动创建的频道的成员列表中包含 `user-default`（member_kind=human）。

> 回归覆盖 GAP-19：群主团队以 human 身份自动加入 channel_members。
