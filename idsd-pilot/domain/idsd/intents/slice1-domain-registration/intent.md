# 意图：切片 1 —— 域的数据模型与注册 API

## 目标

建立"域"层的最小可运行骨架：一个域聚合多个群。群可以创建域、凭邀请码加入域、退出域；域主群可以解散域。域的生命周期管理与群完全同构——成员实体从"团队"换成"群"，其余机制复用，不引入新规则族。本切片只做数据模型与注册生命周期，能力发现、域级信誉、跨域任务属于后续切片。

## 约束

- **分形递归**：域成员是"群"（复用群层"成员是团队"的模式）；域契约/邀请码/成员角色机制与群一致，不新增规则族。
- **数据模型**：新增 `domains` 与 `domain_members` 两张表，迁移 v9→v10；`domain_members` 含 `capabilities TEXT DEFAULT '[]'` 字段（能力声明占位，语义沿用标签；本切片只存不查）。
- **API 风格与 groups API 对齐**：
  - `POST /api/domains` — 创建域（body: name, description?, owner_group_id）
  - `GET /api/domains?group_id=` — 列出某群所属的域
  - `GET /api/domains/:id` — 域详情 + 成员列表
  - `DELETE /api/domains/:id` — 解散域
  - `POST /api/domains/:id/invite` — 生成邀请码（含过期/次数）
  - `POST /api/domains/join` — 凭邀请码加入（body: invite_code, group_id）
  - `POST /api/domains/:id/leave` — 退出域（body: group_id）
- **成员角色**：创建域的群为 owner（不可退出，只能解散域）；加入的群为 member。
- **群可同时属于多个域**，每个域独立维护成员关系。
- **向后兼容**：不启用域功能时，现有团队/群行为完全不变。
- **不引入新依赖**；TypeScript strict + ESM；代码注释英文。
- **本切片不做**：能力发现、域级信誉、跨域任务、域契约编辑 API、前端页面（域 UI 属后续切片）。

## 失败条件

- 域创建成功但数据库中无对应记录，或 owner 成员关系缺失。
- 无效 / 过期 / 超次数的邀请码仍能加入域。
- 域主群退出域成功（必须只能通过解散域离开）。
- 解散域后成员关系残留。
- 域层功能导致任何现有群 / 团队测试失败。
- 新增 npm 依赖。
