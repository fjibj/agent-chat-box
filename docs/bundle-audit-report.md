# Bundle Size & Dependency Bloat Audit

**Date:** 2026-05-04
**Tool:** rollup-plugin-visualizer + manual analysis
**Branch:** main (commit 14cd556)

---

## Executive Summary

The web frontend bundle is **274.77 KB raw / 84.33 KB gzipped**, which is reasonable for a React + React Router app. However, several issues cause unnecessary bloat: the node_modules directory is **700 MB** (272 MB web-only), there are **21 duplicate packages** with multiple versions installed, and critical build misconfigurations cause server-side code to leak into the client bundle.

| Severity | Count | Categories |
|----------|-------|-----------|
| 🔴 Critical | 2 | SSR code in client bundle, CJS-only react-dom |
| 🟠 High | 3 | No code splitting, duplicate root deps, Tailwind misconfig |
| 🟡 Medium | 4 | Duplicate packages, large node_modules, no bundle analysis CI, esbuild duplication |
| 🟢 Low | 2 | Large component files, type duplication |

---

## 1. Bundle Composition (Production Build)

```
Total JS:  274.77 KB raw  |  84.33 KB gzipped
Total CSS:   4.89 KB raw  |   1.44 KB gzipped
Total:     279.66 KB raw  |  85.77 KB gzipped
```

### Breakdown by Package

| Package | Raw Size | % of Bundle | Notes |
|---------|----------|-------------|-------|
| **react-dom** | 548.2 KB | 74.2% | CJS modules, no ESM available |
| **Application code** | 80.5 KB | 10.9% | All pages eagerly loaded |
| **react-router** | 78.9 KB | 10.7% | Development build + SSR deps |
| **react** | 19.8 KB | 2.7% | Production CJS |
| **scheduler** | 11.2 KB | 1.5% | React internal scheduler |

### Top 10 Largest Individual Modules

| Size | Module |
|------|--------|
| 539.9 KB | react-dom/cjs/react-dom-client.production.js |
| 78.9 KB | react-router/dist/development/chunk-EVOBXE3Y.mjs |
| 19.6 KB | src/components/TaskDetailModal.tsx |
| 17.9 KB | react/cjs/react.production.js |
| 10.9 KB | scheduler/cjs/scheduler.production.js |
| 9.3 KB | src/components/CreateTaskModal.tsx |
| 9.1 KB | src/pages/AgentsPage.tsx |
| 7.8 KB | src/pages/SettingsPage.tsx |
| 7.2 KB | src/App.tsx |
| 7.0 KB | react-dom/cjs/react-dom.production.js |

---

## 2. Critical Issues

### 🔴 Issue #1: SSR/Server Code in Client Bundle

**Problem:** react-router v7.14.2 bundles **server-side dependencies** into the client JavaScript:

- **cookie** — HTTP cookie parsing library
- **set-cookie-parser** — Set-Cookie header parser

These are pulled in through `react-router/dist/development/chunk-YQSHRJWW.mjs` and are only needed for SSR data loading (cookie handling on the server). They are completely unnecessary in a client-only SPA.

**Root Cause:** react-router v7 exports map does not provide a `browser` condition, so Vite cannot differentiate between client and server code paths.

**Estimated waste:** ~2-3 KB raw (~1 KB gzipped)

**Recommendation:**

```typescript
// packages/web/vite.config.ts — Add resolve alias to exclude SSR code
export default defineConfig({
  resolve: {
    alias: {
      cookie: false,          // Exclude from client bundle
      'set-cookie-parser': false,
    },
  },
});
```

### 🔴 Issue #2: react-dom Ships Only CJS (No ESM)

**Problem:** React 19.x (react-dom@19.2.5) does not ship ESM builds. The package exports only CJS files:
- react-dom/client.js → react-dom/cjs/react-dom-client.production.js (540 KB)

Vite esbuild pre-bundler converts CJS to ESM, but this results in:
- `commonjsHelpers.js` being injected (140 bytes overhead)
- Additional CJS interop shim modules
- Suboptimal tree-shaking compared to native ESM

**Status:** This is a React upstream issue. No action available until React ships ESM.

---

## 3. High Priority Issues

### 🟠 Issue #3: No Code Splitting / Lazy Loading

**Problem:** All 4 pages are eagerly imported in App.tsx:

```typescript
// App.tsx — ALL imported synchronously
import { AgentsPage } from './pages/AgentsPage';
import { SettingsPage } from './pages/SettingsPage';
import { TaskBoard } from './components/TaskBoard';
// + all modal components (TaskDetailModal at 19.6 KB, CreateTaskModal at 9.3 KB)
```

**Impact:** A user visiting / (Chat page) still downloads the full Agents page, Settings page, Task board, and all modals.

**Recommendation:** Use React.lazy() for route-level code splitting:

```typescript
import { lazy, Suspense } from 'react';

const AgentsPage = lazy(() => import('./pages/AgentsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const TasksPage = lazy(() => import('./pages/TasksPage'));

// In Routes:
<Route path="/agents" element={
  <Suspense fallback={<Loading />}><AgentsPage /></Suspense>
} />
```

**Expected improvement:** ~25-30 KB savings on initial load by lazy-loading non-default routes.

### 🟠 Issue #4: Root package.json Duplicates All Sub-Package Dependencies

**Problem:** The root package.json duplicates all dependencies from both server and web:

```
Root deps:   @fastify/cors, @fastify/multipart, @fastify/static, fastify,
             nanoid, react, react-dom, sql.js, ws
Server deps: @fastify/cors, @fastify/multipart, @fastify/static, fastify,
             nanoid, sql.js, ws
Web deps:    react, react-dom, react-router-dom
```

The root package is a workspace orchestrator and should only have devDependencies. Runtime dependencies belong only in sub-packages.

**Recommendation:** Remove all `dependencies` from root package.json, keep only `devDependencies`.

### 🟠 Issue #5: Tailwind CSS Configuration Warning

**Problem:** The Vite build emits a warning about missing content option despite tailwind.config.js having proper content paths. The warning occurs because Vite runs from the **project root** while the config paths are relative to packages/web/.

**Recommendation:** Update the tailwind config to use absolute paths:

```javascript
import path from 'path';
export default {
  content: [
    path.resolve(__dirname, './index.html'),
    path.resolve(__dirname, './src/**/*.{js,ts,jsx,tsx}'),
  ],
}
```

---

## 4. Medium Priority Issues

### 🟡 Issue #6: 21 Duplicate Packages in Dependency Tree

Multiple packages have 2-3 different versions installed simultaneously:

| Package | Versions | Impact |
|---------|----------|--------|
| esbuild | 0.25.12, 0.27.7 | ~22 MB duplication |
| glob | 10.5.0, 13.0.6 | ~10 MB |
| minimatch | 3.1.5, 9.0.9, 10.2.5 | ~3 versions |
| lru-cache | 5.1.1, 10.4.3, 11.3.5 | ~3 versions |
| nanoid | 3.3.12, 5.1.11 | Different major versions |
| ajv | 6.15.0, 8.20.0 | Different major versions |
| brace-expansion | 1.1.14, 2.1.0, 5.0.5 | ~3 versions |

**Root Cause:** Different major version ranges in transitive dependencies.

**Recommendation:** Add pnpm.overrides in root package.json to deduplicate where safe.

### 🟡 Issue #7: Bloated node_modules/ (700 MB)

| Directory | Size | Purpose |
|-----------|------|---------|
| @typescript-eslint/ | 69 MB | ESLint TypeScript plugin |
| @babel/ | 55 MB | Babel (used by @vitejs/plugin-react) |
| caniuse-lite | 53 MB | Browser compat data (autoprefixer) |
| @fastify/ | 52 MB | Fastify server plugins |
| fast-json-stringify | 36 MB | Fastify serialization |
| ajv-formats | 31 MB | JSON Schema validation |
| typescript | 30 MB | TypeScript compiler |
| eslint | 29 MB | Linter |

Most of this is dev-only tooling. The actual runtime bundle (84 KB gzipped) is well under control.

### 🟡 Issue #8: Triple esbuild Installation

Three separate esbuild instances exist:
1. node_modules/esbuild (root, used by tsx)
2. node_modules/vite/node_modules/esbuild (vite's own copy)
3. packages/web/node_modules/esbuild (web-specific)

This wastes ~33 MB. Aligning esbuild versions across vite and tsx would allow deduplication.

### 🟡 Issue #9: No Bundle Analysis in CI

There is no automated bundle size tracking. Bundle regressions can silently ship.

**Recommendation:** Add a size-limit check to CI:

```json
{
  "size-limit": [
    {
      "path": "packages/web/dist/assets/*.js",
      "limit": "100 kB",
      "gzip": true
    }
  ]
}
```

---

## 5. Low Priority Issues

### 🟢 Issue #10: Large Component Files

| File | Source Size | Bundled Size |
|------|-----------|-------------|
| TaskDetailModal.tsx | 20.3 KB | 19.6 KB |
| CreateTaskModal.tsx | 8.3 KB | 9.3 KB |
| AgentsPage.tsx | 8.0 KB | 9.1 KB |
| App.tsx | 7.2 KB | 7.2 KB |

These files contain extensive inline JSX and duplicated interface definitions (Task, Channel, Agent interfaces are redefined in multiple files).

**Recommendation:**
- Move shared interfaces to @agent-chat-box/shared
- Consider splitting TaskDetailModal.tsx into sub-components
- Use React.memo() for expensive render paths

### 🟢 Issue #11: Duplicate Type Packages in Root and Web

Both root and web package.json declare @types/react and @types/react-dom. This is harmless but redundant — types only need to be in the package that uses them.

---

## 6. Tree-Shaking Assessment

### ✅ What Works Well
- **Application code:** Only 43 modules included, all actively used
- **No dead code detected:** All imported components are rendered
- **CSS:** Tailwind JIT produces only 4.89 KB (44 rules) — excellent purge
- **No PropTypes:** Not included (React 19 doesn't use them)

### ⚠️ What Could Be Better
- **react-dom CJS:** Cannot tree-shake unused react-dom internals
- **react-router SSR code:** cookie + set-cookie-parser included unnecessarily
- **commonjsHelpers.js:** Injected for every CJS module conversion (18 instances)
- **react-router ENABLE_DEV_WARNINGS:** Development build included by default

---

## 7. Action Items (Priority Order)

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| 1 | Add resolve.alias for cookie/set-cookie-parser in Vite config | 5 min | Remove SSR code from client |
| 2 | Add React.lazy() for non-default routes | 30 min | ~25-30 KB initial load savings |
| 3 | Remove dependencies from root package.json | 10 min | Cleaner workspace |
| 4 | Fix Tailwind content paths to absolute | 5 min | Eliminate build warning |
| 5 | Add pnpm.overrides to deduplicate packages | 15 min | Smaller node_modules |
| 6 | Align esbuild versions across vite/tsx | 10 min | ~33 MB node_modules savings |
| 7 | Move shared interfaces to @agent-chat-box/shared | 30 min | Cleaner code, less duplication |
| 8 | Add size-limit CI check | 20 min | Prevent future regressions |

---

## 8. Bundle Size Comparison

| App Type | Typical Size (gzip) | This Project |
|----------|---------------------|-------------|
| Minimal React SPA | 30-50 KB | — |
| React + Router SPA | 50-80 KB | 84.33 KB ✅ |
| React + Router + State Mgmt | 80-120 KB | — |
| Full React Admin Panel | 150-300 KB | — |

**Verdict:** The production bundle is within the expected range for a React + React Router SPA. The main optimizations are around reducing the initial load via code splitting and removing unnecessary SSR code.