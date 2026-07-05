# GAP-19 IDSD 试验：自动创建群聊频道

## 上下文
这是针对 **GAP-19** 的一次 IDSD Planned-Build 试验：创建群时，系统不会自动为群成员创建聊天频道。修复必须小巧、无破坏性，并与现有 v0.2.0 代码保持隔离。

## 范围
只修改"创建群"路径，使其同时创建一条对应的 `channels` 记录，并将群主团队加入为成员。如果复用现有频道列表接口，前端应能在 Chat 页面的频道列表中直接展示该频道。

## 关键文件
- `packages/server/src/api/groups.ts` —— `POST /api/groups` 创建处理器。
- `packages/server/src/api/channels.ts` —— `addChannelMember` 辅助函数与频道创建模式。
- `packages/server/src/db/schema.sql` —— `channels` 和 `channel_members` 的表结构。
- `packages/server/src/ws/handler.ts` —— WebSocket 广播辅助函数。
- `packages/web/src/pages/ChatPage.tsx` / `useWebSocket.ts` —— 频道列表渲染。

## 本次试验约束
1. 不新增依赖。
2. 不修改现有 `channels` 表结构；复用 `type='group'`。
3. 不破坏现有群创建 API 契约（新增字段可以，删除/重命名不行）。
4. 不为已存在的群自动创建频道（仅对新创建的群生效）。
5. 所有修改的代码注释保持英文。
6. 每次代码变更后运行现有自动化测试。
7. 本 IDSD 试验产生的所有文档（计划、意图、期望、状态、handoff、评估报告）使用简体中文。

## 如何验证
- 自动化：扩展 `POST /api/groups` 的服务器测试，断言频道已被创建。
- Holdout：实现后运行 `idsd-pilot/gap19/holdout/evaluate.py <版本>`。
