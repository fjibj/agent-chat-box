# 意图：切片 5 —— 域层 UI（DomainsPage）

## 目标

为域层提供完整的用户界面：一个 `/domains` 页面，让用户以某个群的身份完成域管理的全部操作——创建/加入/解散域、成员与邀请、能力声明、能力发现、协作任务与评分、信誉看板。UI 只消费切片 1-4 已交付的 API，**不新增后端能力**。

## 约束

- **单页面**：`DomainsPage` 挂在路由 `/domains`，导航栏新增 "Domains" 项（与 Groups/Tasks 平级）。
- **群选择器**：页面顶部提供"当前操作群"选择——基于现有 `acb-teamId` 机制拉取群列表，用户选中一个群后，所有域操作以该群身份发起。无群时给出提示。
- **功能块**（全部基于已交付 API）：
  1. 域列表：当前群参与的域（`GET /api/domains?group_id=`）
  2. 创建域（`POST /api/domains`，owner_group_id = 当前群）；邀请码加入（`POST /api/domains/join`）
  3. 域详情：成员列表、生成邀请码（`POST /:id/invite`）、退出（`POST /:id/leave`，owner 禁退）、解散（`DELETE /:id`，仅 owner 可见可用）
  4. 能力声明：当前群声明能力（`POST /:id/capabilities`）；成员能力列表（`GET /:id/capabilities`）
  5. 发现：按能力搜索（`GET /:id/discover?capabilities=&group_id=`），展示信誉排序与 flagged 标记
  6. 协作：域任务列表（`GET /:id/tasks?group_id=`）、发起协作（`POST /:id/tasks`）、评分 approved/rejected（`POST /:id/tasks/:tid/rating`）
  7. 信誉看板：各成员群信誉与 flagged（`GET /:id/reputation?group_id=`）
  8. 错误处理：非成员 403、owner 不能退出、无匹配群 400 等错误以可见提示呈现，不崩溃
- **技术约束**：不新增 npm 依赖（fetch + 现有 Tailwind 深色主题体系）；不改后端 API、不改 schema；交互模式与 GroupsPage 一致（加载态、错误态、弹窗确认）。
- **测试**：`DomainsPage.test.tsx` 组件测试（vitest + testing-library，仿现有 GroupsPage.test.tsx 模式），覆盖核心交互；既有测试全部保持通过。
- **本切片不做**：域契约编辑、domain.* WS 广播消费、多群并行身份切换、移动端适配。

## 失败条件

- `/domains` 路由或导航缺失（页面 404）。
- 任一功能块调用了后端不存在的 API 或错误的方法/路径。
- 群选择器无法切换身份，导致操作以错误群身份发起。
- 非成员/owner 限制在 UI 上无任何提示。
- 新增 npm 依赖。
- 组件测试或既有测试失败。
