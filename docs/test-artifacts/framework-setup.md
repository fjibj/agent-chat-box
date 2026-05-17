# TEA Framework Setup Report

**Date:** 2026-05-15
**Agent:** Murat (Test Architect)
**Project:** Agent Chat Box

---

## 1. 技术栈检测

| 层级 | 检测依据 | 结果 |
|------|---------|------|
| Frontend | `packages/web/package.json` (React + Vite) | React 19 + Vite 6 + TypeScript |
| Backend | `packages/server/package.json` (Fastify) | Fastify 5 + Node.js + TypeScript |
| Fullstack | 两者都有 | 全栈项目 |

## 2. 测试框架配置

### 2.1 前端 (packages/web)

**测试框架**: Vitest + React Testing Library + Playwright

| 文件 | 说明 |
|------|------|
| `vitest.config.ts` | Vitest 配置 (jsdom 环境, 覆盖率 v8) |
| `playwright.config.ts` | Playwright E2E 配置 (Chromium + Firefox) |
| `src/pages/GroupsPage.test.tsx` | 示例组件测试 |
| `e2e/groups.spec.ts` | 示例 E2E 测试 |

**package.json scripts**:
```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage",
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui"
```

### 2.2 后端 (packages/server)

**测试框架**: Vitest (Node.js 环境)

| 文件 | 说明 |
|------|------|
| `vitest.config.ts` | Vitest 配置 (node 环境, 覆盖率 v8) |
| `src/api/teams.test.ts` | 示例 API 测试 |
| `src/modules/reputation.test.ts` | 示例模块测试 |

**package.json scripts**:
```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

### 2.3 根级 (package.json)

```json
"test": "vitest run"
```

## 3. CI/CD 配置

**文件**: `.github/workflows/test.yml`

| Job | 触发条件 | 执行内容 |
|-----|---------|---------|
| `unit-test` | push/PR to main | `npm ci` → `npm run test` → `npm run test:coverage` → 上传覆盖率报告 |
| `e2e-test` | push/PR to main | `npm ci` → Playwright install → `npm run test:e2e` → 上传 Playwright 报告 |

## 4. 待安装依赖

根级 `package.json` 已添加以下 devDependencies (需运行 `npm install`):

- `@playwright/test`
- `@testing-library/jest-dom`
- `@testing-library/react`
- `@testing-library/user-event`
- `jsdom`

## 5. 目录结构

```
packages/
├── server/
│   ├── vitest.config.ts
│   └── src/
│       └── **/*.test.ts
├── web/
│   ├── vitest.config.ts
│   ├── playwright.config.ts
│   ├── e2e/
│   │   └── *.spec.ts
│   └── src/
│       └── **/*.test.{ts,tsx}
```

## 6. 下一步

运行 `npm install` 安装测试依赖后，即可执行：

```bash
# 全项目测试
npm run test

# 前端 E2E
npx playwright install
npm run test:e2e
```
