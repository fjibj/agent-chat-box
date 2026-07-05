# 边界场景：联邦成员入群不自动加入已有频道

## 操作
1. 启动 dev server。
2. 创建群 A（群主团队 T1）。
3. 创建团队 T2，通过邀请码加入群 A。
4. 查询 `channel_members` 表。

## 期望
- `channel_members` 中只有 T1 的群主用户记录。
- T2 的用户或 Agent 不会自动加入该群聊频道。
