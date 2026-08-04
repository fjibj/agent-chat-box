# Checkpoint: 域层切片 1 —— 数据模型与注册 API

## 版本标签
- slice1-v1：构建代理交卷版本（2026-08-03）
- slice1-v2：holdout 评估版本（16/16 通过）

## 完成期望

### 成功场景
- ✅ 群创建域：域创建成功，发起群自动成为 owner 成员（域详情可见）。
- ✅ 群凭邀请码加入域：邀请码 8 位大写；加入后为 member 成员。
- ✅ 群同时属于多个域：D1/D2 成员列表都包含该群，互不影响。
- ✅ 查询所属域：成员群可见；非成员群列表不可见。
- ✅ 群退出域：member 退出后成员关系与列表同步消失。

### 失败场景
- ✅ 无效邀请码 → 404，不产生成员关系。
- ✅ 邀请码达 max_uses → 400。
- ✅ owner 群退出 → 400（只能解散域），owner 仍在成员列表。
- ✅ 重复加入同一域 → 400。

### 边界场景
- ✅ 解散域：成员关系全部清理，域详情 404，各群列表不再出现。
- ✅ 无任何域的群 → 域列表返回空数组。
- ✅ 缺 owner_group_id / 缺 name 创建域 → 400。
- （过期邀请码为 intent 级失败条件，未纳入 holdout：API 无法构造已过期邀请码，留待人工验证。）

## 验证结果
- 基线门禁：`npm test` 76/76 ✅；`npm run typecheck` ✅；`npm run lint` 0 errors ✅。
- server 套件：vitest 268/268 通过（21 文件，含新增 23 个域测试 TC-D001~D005）。
- **Holdout 评估：16/16 场景 100% 通过**（5 个切片 0 回归 + 11 个切片 1 域场景）。
- 评估器 v2（evaluate.ts）：自动发现 api/ 目录 register*Routes 模块；每场景独立全新数据库（DATA_DIR 临时目录 + resetDatabase）；捕获替换 + 13 个匹配操作符。

## 交付物
- `packages/server/src/db/schema.sql` — schema v10：`domains` + `domain_members` 表、3 索引、user_version=10
- `packages/server/src/db/index.ts` — v9→v10 迁移块（幂等，仿 v8→v9）
- `packages/server/src/api/domains.ts` — 7 条域 API（create/list/get/delete/invite/join/leave）
- `packages/server/src/api/domains.test.ts` — 23 个测试
- `packages/server/src/index.ts` — 注册 registerDomainRoutes
- `packages/server/src/test-helpers.ts` — buildApp 注册域路由 + createDomain helper
- `packages/shared/src/types.ts` — Domain / DomainMember 接口

## 与群 API 的同构点（分形递归验证）
- 校验顺序与错误文案镜像 groups.ts；邀请码生成/过期/次数逻辑逐条照搬；
- 成员实体从"团队"换成"群"；未新增任何规则族——符合总体意图"规则预算 ≤ 1"约束。

## 有意差异（符合切片 1 范围）
- 域无聊天频道实体（域不是聊天空间）。
- 不发 domain.* WS 广播（后续切片按需）。
- leave 无任务清理（域只持群级元数据，数据边界约束）。
- 域契约 contract_yaml 存默认值，编辑 API 属后续切片。

## 遗留事项（后续切片）
- 切片 2：能力发现 + 信誉查询（capabilities 已入库待查）
- 切片 3：信誉更新机制 + 异常检测
- 切片 4：多域交互边界
- 域契约编辑 API、域 UI 页面、domain.* WS 广播

---

# Checkpoint: 域层切片 2 —— 能力发现与信誉查询

## 版本标签
- slice2-v1：构建代理交卷版本（2026-08-03）；holdout 23/24（1 个场景为考题自身漏传 group_id，非实现缺陷）
- slice2-v2：修正考题后评估版本（24/24 通过，100%）

## 完成期望

### 成功场景
- ✅ 群声明能力：成员群 POST /api/domains/:id/capabilities 更新声明，能力列表反映新值。
- ✅ 能力发现精确匹配：required ⊆ 声明能力 才命中；多 required 全具备才返回；不匹配群不出现。
- ✅ 发现结果含信誉：每个命中结果带 reputation 数值（无记录为 0）。
- ✅ 域信誉查询：GET /api/domains/:id/reputation 返回全部成员及其信誉数值。

### 失败场景
- ✅ 非成员声明能力 → 403。
- ✅ 非成员调用发现 / 信誉查询 → 403。

### 边界场景
- ✅ 空 required 发现：命中全部成员。
- ✅ 群退出域：能力与信誉从发现/能力列表消失（信誉重算不再计入已退群）。

## 关键设计点（盲考独立实现，与意图一致）
- 信誉聚合 = 单一聚合函数（均值）：群内各团队在"域内成员群"中信誉分之和的均值，COALESCE 0，保留 2 位小数，实时计算无缓存。
- 排序：reputation 降序，同分按 joined_at 升序（稳定）。
- 访问控制：404 域不存在 → 400 缺 group_id → 403 非成员。

## 交付物
- packages/server/src/api/domain-capabilities.ts（4 端点：capabilities POST/GET、discover、reputation）
- packages/server/src/api/domain-capabilities.test.ts（23 个测试 TC-S2-001~023）
- packages/server/src/index.ts、test-helpers.ts（注册路由）
- 未动：schema（沿用 v10 的 domain_members.capabilities）、holdout/、git

## 质量门禁
- server vitest 291/291（268 旧 + 23 新）；根 npm test 76/76；typecheck clean；lint 0 errors（54 warnings 均为既有）；prettier clean

## 遗留事项
- GET /api/domains/:id/capabilities 列表接口未加访问控制（意图只约束 声明/发现/信誉 三类）；收紧需另行决策。
- 信誉查询为每成员一次 SQL（N+1），域规模小可接受；成员数增长后优化为单条聚合 SQL。
- 信誉排序在真实差异数据下的行为：聚合正确性由单测覆盖；端到端信誉差异排序场景留待切片 3（信誉更新机制落地后）。
- 切片 1/2 代码仍未 git commit（构建代理红线）。

---

# Checkpoint: 域层切片 3 —— 信誉更新机制与异常检测

## 版本标签
- slice3-v1：构建代理交卷版本（2026-08-04）；holdout 27/34（7 个失败均为考题自身断言 200，实现按 REST 惯例返回 201）
- slice3-v2/v3：考题修正 + 行尾编码事故（批量工具引入 CRLF/BOM 破坏 front-matter 解析，场景被误判 MANUAL）
- slice3-v4：最终评估 34/34 通过（100%）

## 完成期望

### 成功场景
- ✅ 域协作发起：A 发起（required_capabilities）→ 域路由到唯一匹配 B，任务进 B 的群任务列表，pending。
- ✅ 协作执行回流信誉：认领→授权→完成 → recordTaskReputation 自动 +1 → 域级信誉实时反映（零新规则）。
- ✅ 评分 approved：发起群评分 → 信誉 +2（完成 +1 + 评审 +1）；重复评分 400 不生效。
- ✅ 协作任务列表：域成员可查（发起群/目标群/状态）。

### 失败场景
- ✅ 无匹配群 → 400；非成员发起 → 403；非发起群评分 → 403；未完成评分 → 400；重复评分 → 400。

### 边界场景
- ✅ 路由排除发起群自身（唯一匹配者是自己 → 400，防自刷）。
- ✅ 连续 5 次 rejected → discover 与 reputation 中 flagged = true。
- ✅ 单次 rejected / approved 打断连续计数 → flagged = false。

## 关键设计点（盲考独立实现，与意图一致）
- 零新规则：协作任务在目标群创建（域层内部直插 tasks/group_tasks），执行与信誉回流全部复用群层机制。
- 路由：required ⊆ 声明能力，排除 requester，信誉降序 + joined_at 升序。
- 评分：薄封装映射 review 事件（approved +1 / rejected -2）记在执行团队于目标群的信誉；仅发起群可评、每任务一次。
- 异常检测：连续 review_rejected ≥ 5（MAX_CONSECUTIVE_REJECTIONS）→ flagged；实时计算不加表。
- schema v10→v11：domain_tasks（域协作任务索引），用真实 v10 库验证迁移。
- 补全缺口：PATCH /api/agents/:id 支持 team_id（既有列缺 HTTP 写入路径）。

## 交付物
- 新建：packages/server/src/api/domain-collab.ts（3 端点）、domain-collab.test.ts（23 用例）
- 修改：domain-capabilities.ts（flagged）、agents.ts（PATCH team_id）、db/schema.sql、db/index.ts（v11）、index.ts、test-helpers.ts、domains.test.ts

## 质量门禁
- server vitest 314/314（291 旧 + 23 新）；根 npm test 76/76；typecheck clean；lint 0 errors

## 遗留事项
- 无技术遗留。域协作任务默认标题 'Domain collaboration task'。
- 切片 1-3 代码仍未 git commit（构建代理红线）。
