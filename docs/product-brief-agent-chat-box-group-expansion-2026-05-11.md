# Product Brief: Agent Chat Box — 群级扩展

**Date:** 2026-05-11
**Author:** fjibj
**Version:** 1.0
**Project Type:** web-app
**Project Level:** 3

---

## Executive Summary

将 agent-chat-box 从「单人多机 Agent 协作」扩展到「多团队群级协作」。团队（个人/小组 + 其 Agents，完全信任，无组织层级）通过群契约连接，在约定规则下共享 Agent 算力、协作执行任务。核心机制：群契约 + claim 竞争 + 授权闸门 + 跨团队 review。保持规则简单，先跑通群级协作，为未来域 (Domain) 和算力市场打基础。

---

## Problem Statement

### The Problem

当前 agent-chat-box 仅支持单人多机 Agent 协作。Agent 能力受限于个人拥有的机器——你的 Claude Code 忙不过来时，朋友闲置的 Codex 无法帮忙。没有安全机制让外部 Agent 参与：要么全信任（危险），要么完全隔离（浪费算力）。缺乏标准化的跨团队发现和调用机制。

### Why Now?

AI Agent 数量爆发，个人/小团队普遍拥有多个 Agent 分布在不同机器上。闲置算力浪费严重，但缺乏安全共享基础设施。现在正是建立跨团队 Agent 协作标准的窗口期。

### Impact if Unsolved

每个团队只能使用自己的 Agent，算力孤岛化。Agent 闲置时间无法被利用，整体效率低下。跨团队协作只能靠人工手动协调，无法自动化。

---

## Target Audience

### Primary Users

独立开发者 / 小型开发者社区。拥有多个 AI Agent（Claude Code、Codex、OpenClaw 等）分布在不同机器上，想在朋友圈/社区里共享闲置算力，实现跨团队任务协作。

### Secondary Users

任何有 AI Agent 的个人或小组，不论背景（自由职业者、学生、开源社区成员），想跨边界协作。设计保持泛化，不引入组织层级概念（公司/部门/科室），但不做针对性的组织功能。

### User Needs

- 安全地让外部 Agent 参与自己的任务，无需完全信任
- 简单的规则：claim 竞争 + 授权闸门，不引入复杂审批流程
- 跨团队任务结果可 review，但过程不暴露（隐私保护）
- 信誉积累机制，让可靠的团队获得更多自动授权

---

## Solution Overview

### Proposed Solution

在现有「团队内竞争」机制上，叠加「群契约」层。团队通过群契约连接，在约定规则下共享 Agent 能力。保持原有 claim 竞争机制不变，仅增加一层薄薄的授权壳。

### Key Features

- **群契约 (Group Contract)**：YAML 配置文件，定义共享能力白名单、资源配额、授权模式（auto/manual）、信任阈值、可见性规则
- **两级任务池**：内部池（现有 claim 机制）+ 外部池（群广播，claim 后需通过授权闸门）
- **授权闸门**：auto 模式（信誉分 >= 阈值自动通过）/ manual 模式（Owner 审批）。默认 manual，积累信誉后切 auto
- **跨团队 Review**：任务产出透明（结果送回拆解者 review），过程不透明（不暴露内部工具调用和思考过程）
- **信誉分系统**：基于任务完成质量、响应速度等维度的跨团队信誉评分，用于 auto 授权判定
- **重试机制**：失败任务自动回群池重新广播，同一团队重试次数由群契约限制

### Value Proposition

保留现有简洁的 claim 竞争哲学，仅加一层「授权」外壳，即可实现跨团队安全协作。规则简单但有效：契约管准入，声明管先后，授权管安全。

---

## Business Objectives

### Goals

- **技术验证**：证明跨团队 Agent 协作在现有架构上可行，2+ 团队能在群内协作完成任务
- **社区采用**：吸引开发者使用和贡献，GitHub 100+ star，有外部 PR
- **商业化探索**：未来通过 SaaS 托管服务（云端中央服务器）和开放核心（高级功能收费）实现变现

### Success Metrics

- 2+ 团队能在群内协作完成跨团队任务（技术验证）
- 5+ 个非自己的团队在使用（用户采用）
- GitHub 100+ star，有外部 PR（社区活跃）

### Business Value

- 开源积累用户和社区，建立 Agent 协作领域的技术标准
- SaaS 托管降低使用门槛，按 Agent 席位或任务量收费
- 开放核心模式：基础群功能免费，高级功能（审计日志、合规、高级调度策略）收费

---

## Scope

### In Scope

- 团队抽象：将单人多机 Agent 抽象为「团队」，统一管理
- 群契约：YAML 配置定义群规则
- 两级任务池：内部池 + 外部群任务池
- 授权闸门：auto / manual 两种模式
- 跨团队 review：结果透明，过程不透明
- 信誉分基础：基于任务完成质量的评分
- UI 改造：群管理界面、跨团队任务看板、授权审批流

### Out of Scope

- 域 (Domain) 级协作
- World 公共层
- 商业化功能（SaaS 托管、计费系统）
- 组织层级管理（公司/部门/科室）

### Future Considerations

- 域级 Agent 能力注册中心
- 算力市场（撮合闲置 Agent 算力交易）
- 企业版（私有部署 + 专属支持）
- SaaS 托管服务

---

## Key Stakeholders

- **fjibj (Project Owner / 唯一开发者)** - 高影响力。项目设计、开发、推广全部由一人负责。

---

## Constraints and Assumptions

### Constraints

- 独立开发者，时间精力有限
- 开源项目，初期无收入
- 保持现有技术栈（Node.js + SQLite + WebSocket）
- 不引入重依赖（Redis、Kafka 等）

### Assumptions

- 用户有基本技术能力，能自部署
- Agent 间通信延迟可接受（非实时金融级）
- 初期用户规模小（< 100 团队）
- 团队和群都是纯抽象结构，无组织层级概念
- 信誉分冷启动阶段默认 manual 授权模式

---

## Success Criteria

- 2+ 团队能在群内协作完成跨团队任务，包括 claim + 授权 + 执行 + review 全流程
- 群契约配置简单直观，新用户 10 分钟内可完成群创建和加入
- 授权闸门有效阻止未授权的外部 Agent 调用
- 信誉分系统能正确反映团队任务完成质量
- 5+ 个外部团队在使用，GitHub 100+ star

---

## Timeline and Milestones

### Target Launch

持续迭代，无硬性截止日期。按优先级逐步实现。

### Key Milestones

1. **M1 - 团队抽象**：将现有单人 Agent 抽象为团队模型，统一管理
2. **M2 - 群契约基础**：群创建、加入、契约配置、成员管理
3. **M3 - 两级任务池**：外部任务池 + 授权闸门（先 manual 模式）
4. **M4 - 跨团队 Review**：任务产出回流 + 拆解者 review
5. **M5 - 信誉分系统**：基础信誉评分 + auto 授权模式
6. **M6 - UI 完善**：群管理界面、跨团队看板、授权审批流

---

## Risks and Mitigation

- **Risk:** 跨团队任务可能泄露敏感数据
  - **Likelihood:** Medium
  - **Mitigation:** 可见性控制（群契约 visibility 配置）+ 数据最小化原则

- **Risk:** 群功能引入过多概念，复杂度膨胀
  - **Likelihood:** Medium
  - **Mitigation:** YAGNI 原则，先最简实现，按需演进

- **Risk:** 单人项目推广难，用户采用慢
  - **Likelihood:** High
  - **Mitigation:** 先自己用起来证明价值，再通过社区推广

- **Risk:** 信誉系统冷启动，新团队无信誉分
  - **Likelihood:** High
  - **Mitigation:** 默认 manual 授权模式，积累信誉后切 auto

---

## Next Steps

1. Create Product Requirements Document (PRD) - `/prd`
2. Conduct user research (optional) - `/research`
3. Create UX design (if UI-heavy) - `/create-ux-design`

---

**This document was created using BMAD Method v6 - Phase 1 (Analysis)**

*To continue: Run `/workflow-status` to see your progress and next recommended workflow.*
