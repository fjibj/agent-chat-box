# GAP-19 IDSD 试验的 Agent 行为规则

## 绝对禁止
- 禁止修改 `idsd-pilot/gap19/holdout/scenarios/` 下的任何文件。
- 禁止读取或修改 `.claudeignore`。
- 除非用户明确要求，否则禁止执行 `git commit`、`git push` 或分支操作。
- 未经确认，禁止删除文件或进行破坏性批量修改。
- 未经用户明确批准，禁止新增 npm 依赖。
- 禁止以不兼容方式修改现有 API 响应结构。

## 常见错误预防
- 写 sql.js 代码时，`step()` 之后必须调用 `stmt.free()`，防止内存泄漏。
- 修改 `groups.ts` 时，注意当前事务由单个 `db.run` 调用处理；将频道创建包装在同一个 try/catch 中，并调用 `db.save()`。
- 频道名称应避免冲突：优先使用确定且唯一的模式，例如 `group:<groupId>`，或根据群名加后缀派生。
- 广播时合理使用 `MSG.CHANNEL_CREATED` 或 `MSG.GROUP_CREATED`；除非必要，不要发明新消息类型。
- 前端频道列表已通过 `/api/channels` 查询复用；除非创建后频道不显示，否则不要触碰 WebSocket 路由。

## 语言约定
- 本 IDSD 试验产生的所有文档（包括计划文件、意图、期望、状态更新、handoff 笔记、评估报告）必须使用简体中文。
- 代码注释仍保持英文，以与现有代码库一致。

## 工作习惯
- 编辑前先读取相关文件。
- 每次重大变更后运行 `npm test` 和 `npm run typecheck`。
- 完成一个切片后更新 `idsd-pilot/gap19/idsd/idsd-status.yaml`。
- 保持最小改动；如果修改超过 5 个文件，先暂停并在 handoff 笔记中记录进度。
