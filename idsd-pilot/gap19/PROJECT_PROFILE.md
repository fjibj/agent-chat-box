# 项目画像：Agent Chat Box

## 产品定位
一个跨机器多 Agent 任务调度与协作平台。它管理运行在不同机器（家庭电脑、公司电脑、云服务器）上的多种 AI 编程 Agent（Claude Code、Codex、OpenClaw、Hermes），实现跨机调度、任务争抢、协作分解以及人机实时聊天。

## 当前阶段
- v0.1.0 核心调度：已完成并经过人工验证。
- v0.2.0 群扩展 + 联邦网关：已完成，TEA 自动化测试通过，人工验证 A~M 已执行。
- v0.2.0 follow-up stories（G027~G031、F011~F012、Q001）：已完成，用于关闭人工验证阶段发现的 14 个 GAP。
- 仍然开放的缺口：GAP-19 —— 创建群时不会自动创建群聊频道。

## 技术栈
- 服务器：Fastify 5 + ws 8 + sql.js 1.11（WASM SQLite，无原生依赖）
- 联邦网关：WebSocket 自定义协议（slock 风格信封）
- Daemon：Node.js 20+ + ws + 进程管理 + Agent 适配器
- 前端：React 19 + Vite 6 + Tailwind CSS 4 + React Router
- 类型：TypeScript strict mode + ESM
- 包管理：npm（monorepo，根目录管理依赖）
- 测试：Vitest 3（362+ 用例）+ Playwright 1.49 E2E
- 代码检查：ESLint 9 + Prettier 3

## 必须遵守的规则
- TypeScript strict + ESM；源代码中禁止使用 CommonJS `require`。
- 所有代码注释使用英文，以与现有代码库保持一致。
- 服务器使用 sql.js；通过 `getDatabase()` 写 SQL，并在 `step()` 后记得调用 `stmt.free()`。
- WebSocket / 联邦消息使用统一信封 `{ v, id, type, ts, [from, to,] data }`。
- REST API 错误返回 `{ error: string }`，并附带合适的 HTTP 状态码。
- 前端使用函数式 React 组件 + hooks；状态持久化使用 `localStorage`。
- 每次变更都必须保持现有测试通过（`npm test`、`npm run typecheck`、`npm run lint`）。
- YAGNI：除非有明确理由，否则不引入新基础设施（不用 Redis、PostgreSQL、不新增依赖）。

## GAP-19 可复用模块
- `packages/server/src/api/channels.ts` —— 频道创建、成员关系、名称解析。
- `packages/server/src/api/groups.ts` —— 群创建、入群/退群、契约、解散。
- `packages/server/src/db/schema.sql` —— `channels`、`channel_members`、`groups`、`group_members` 表。
- `packages/shared/src/constants.ts` —— `MSG` 消息类型常量。
- `packages/web/src/pages/GroupsPage.tsx` —— 群列表/详情 UI。
- `packages/web/src/pages/ChatPage.tsx` —— 频道列表/消息流 UI。
