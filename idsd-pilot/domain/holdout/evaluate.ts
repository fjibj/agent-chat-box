#!/usr/bin/env tsx
/**
 * IDSD Holdout Set Evaluator v2 — scenario → API assertion automation.
 *
 * v1 (gap19) 的问题：每个场景只是跑一遍全量 `npm test + typecheck`，
 * 场景描述从未被真正验证，且迭代多次时成本线性爆炸。
 * v2 把场景文件升级为「人类语言描述 + 可执行 API 断言」：
 *   1. 基线门禁跑一次（npm test + typecheck），快速失败；
 *   2. 每个场景通过 Fastify app.inject 在进程内执行 HTTP 断言
 *      （不起服务、不占端口、每场景独立全新数据库）；
 *   3. 无断言的场景标记为 MANUAL（需要人工验证），不参与通过率。
 *
 * 用法：
 *   npx tsx evaluate.ts <version_tag> [--skip-baseline]
 *   例：npx tsx evaluate.ts slice1-v1
 *
 * 场景文件格式（scenarios/{success,failure,boundary}/*.md）：
 *   ---
 *   { "checks": [ ... ] }
 *   ---
 *   # 人类语言场景描述……
 *
 * check 结构：
 *   {
 *     "name": "创建群",                      // 可选，默认 "METHOD url"
 *     "method": "POST",                     // 默认 GET
 *     "url": "/api/groups",                 // 支持 {{var}} 替换
 *     "body": { ... },                      // 支持 {{var}} 替换
 *     "expect": {
 *       "status": 201,                      // 期望 HTTP 状态码
 *       "json": { ... }                     // 响应体部分匹配（见下）
 *     },
 *     "capture": { "groupId": "id", "channelId": "channel_id" }  // 匹配通过后按点路径捕获变量
 *   }
 *
 * json 匹配器（部分匹配：只检查列出的字段；对象默认部分匹配）：
 *   字面值          → 严格相等
 *   数组字面值      → 深比较
 *   {"$exists":b}   → 键存在性
 *   {"$eq":v}       → 深相等（v 支持 {{var}}）
 *   {"$ne":v}       → 不相等
 *   {"$gt":n} {"$gte":n} {"$lt":n} {"$lte":n} → 数值比较
 *   {"$startsWith":s} {"$endsWith":s} {"$contains":s} → 字符串
 *   {"$matches":r}  → 正则（new RegExp(r)）
 *   {"$length":n}   → 数组长度
 *   {"$any":m}      → 数组中至少一项匹配 m
 *   {"$all":m}      → 数组中所有项匹配 m
 *   {"$none":m}     → 数组中无一项匹配 m
 *
 * 每个场景使用独立的全新数据库（DATA_DIR 指向临时目录，逐场景重建），
 * 场景之间互不影响。结果写入 results/<version>.json。
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const holdoutDir = __dirname;
const resultsDir = path.join(holdoutDir, 'results');
const SCENARIO_CATEGORIES = ['success', 'failure', 'boundary'];

// ---- 必须在导入 server 模块之前设置（DATA_DIR 在模块加载时读取） ----
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'idsd-holdout-'));
const DATA_DIR = process.env.DATA_DIR;

// ---- 动态导入 server 模块 ----
const dbMod = await import('../../../packages/server/src/db/index.js');
const { createDatabase, getDatabase, resetDatabase } = dbMod;

const { ensureDefaultChannel } = await import('../../../packages/server/src/api/channels.js');

// ============================================================
// 场景加载
// ============================================================

function parseScenario(file: string) {
  const raw = fs.readFileSync(file, 'utf-8').replace(/^\uFEFF/, '');
  const name = path.basename(file, '.md');
  const category = path.basename(path.dirname(file));
  let checks: Array<Record<string, any>> | null = null;
  const fm = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (fm) {
    try {
      const parsed = JSON.parse(fm[1]);
      checks = Array.isArray(parsed.checks) ? parsed.checks : null;
    } catch {
      checks = null;
    }
  }
  return { name, category, checks, description: raw };
}

function loadScenarios() {
  const scenarios: Array<ReturnType<typeof parseScenario>> = [];
  for (const category of SCENARIO_CATEGORIES) {
    const dir = path.join(holdoutDir, 'scenarios', category);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort()) {
      scenarios.push(parseScenario(path.join(dir, f)));
    }
  }
  return scenarios;
}

// ============================================================
// 模板替换与匹配器
// ============================================================

function substitute(value: any, ctx: Record<string, any>): any {
  if (typeof value === 'string') {
    return value.replace(/\{\{(\w+)\}\}/g, (_, k) =>
      k in ctx ? String(ctx[k]) : `{{${k}}}`,
    );
  }
  if (Array.isArray(value)) return value.map((v) => substitute(v, ctx));
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) out[k] = substitute(v, ctx);
    return out;
  }
  return value;
}

function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a && b && typeof a === 'object') {
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => deepEqual(a[k], b[k]));
  }
  return false;
}

function matchValue(actual: any, expected: any, ctx: Record<string, any>): boolean {
  if (expected === null) return actual === null;
  if (typeof expected === 'object' && expected !== null && !Array.isArray(expected)) {
    const keys = Object.keys(expected);
    if (keys.length === 1 && keys[0].startsWith('$')) {
      return matchOp(actual, expected, keys[0], ctx);
    }
    // 部分匹配：actual 必须是对象，且所有期望字段存在并匹配
    if (actual === null || typeof actual !== 'object' || Array.isArray(actual)) return false;
    return keys.every((k) => k in actual && matchValue(actual[k], expected[k], ctx));
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return false;
    return (
      expected.length === actual.length &&
      expected.every((e, i) => matchValue(actual[i], e, ctx))
    );
  }
  // 字面值：先做 {{var}} 替换再比较
  return actual === substitute(expected, ctx);
}

function matchOp(actual: any, spec: Record<string, any>, op: string, ctx: Record<string, any>): boolean {
  const arg = spec[op];
  switch (op) {
    case '$exists':
      return arg ? actual !== undefined && actual !== null : actual === undefined || actual === null;
    case '$eq':
      return deepEqual(actual, substitute(arg, ctx));
    case '$ne':
      return !deepEqual(actual, substitute(arg, ctx));
    case '$gt':
      return typeof actual === 'number' && actual > arg;
    case '$gte':
      return typeof actual === 'number' && actual >= arg;
    case '$lt':
      return typeof actual === 'number' && actual < arg;
    case '$lte':
      return typeof actual === 'number' && actual <= arg;
    case '$startsWith':
      return typeof actual === 'string' && actual.startsWith(arg);
    case '$endsWith':
      return typeof actual === 'string' && actual.endsWith(arg);
    case '$contains':
      return typeof actual === 'string' && actual.includes(arg);
    case '$matches':
      return typeof actual === 'string' && new RegExp(arg).test(actual);
    case '$length':
      return Array.isArray(actual) && actual.length === arg;
    case '$any':
      return Array.isArray(actual) && actual.some((item) => matchValue(item, arg, ctx));
    case '$all':
      return Array.isArray(actual) && actual.length > 0 && actual.every((item) => matchValue(item, arg, ctx));
    case '$none':
      return Array.isArray(actual) && !actual.some((item) => matchValue(item, arg, ctx));
    default:
      return false;
  }
}

function getPath(obj: any, dotPath: string): any {
  return dotPath.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

// ============================================================
// 检查执行
// ============================================================

async function runCheck(app: any, check: Record<string, any>, ctx: Record<string, any>) {
  const method = String(check.method || 'GET').toUpperCase();
  const url = substitute(check.url, ctx);
  const body = check.body ? substitute(check.body, ctx) : undefined;
  const name = check.name || `${method} ${url}`;

  const res = await app.inject({ method, url, payload: body });
  let bodyObj: any = null;
  try {
    bodyObj = res.json();
  } catch {
    bodyObj = null;
  }

  const expect = check.expect || {};
  if (expect.status !== undefined && res.statusCode !== expect.status) {
    return {
      name,
      pass: false,
      detail: `status: expected ${expect.status}, got ${res.statusCode}; body=${JSON.stringify(bodyObj)}`,
    };
  }
  if (expect.json !== undefined && !matchValue(bodyObj, expect.json, ctx)) {
    return {
      name,
      pass: false,
      detail: `json mismatch; expected=${JSON.stringify(expect.json)} actual=${JSON.stringify(bodyObj)}`,
    };
  }
  if (check.capture) {
    for (const [varName, dotPath] of Object.entries(check.capture)) {
      ctx[varName] = getPath(bodyObj, String(dotPath));
    }
  }
  return { name, pass: true, detail: `${method} ${url} → ${res.statusCode}` };
}

// ============================================================
// 基线门禁
// ============================================================

function runBaseline(): Record<string, boolean> {
  const results: Record<string, boolean> = {};
  for (const [label, cmd] of [
    ['test', 'npm test'],
    ['typecheck', 'npm run typecheck'],
  ] as const) {
    try {
      execSync(cmd, { cwd: PROJECT_ROOT, stdio: ['ignore', 'pipe', 'pipe'], timeout: 600_000 });
      results[label] = true;
    } catch (err: any) {
      results[label] = false;
      if (err.stdout) process.stdout.write(String(err.stdout).slice(-1500));
      if (err.stderr) process.stderr.write(String(err.stderr).slice(-1500));
    }
  }
  return results;
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  const args = process.argv.slice(2);
  const version = args[0];
  if (!version) {
    console.log('Usage: npx tsx evaluate.ts <version_tag> [--skip-baseline]');
    process.exit(1);
  }
  const skipBaseline = args.includes('--skip-baseline');

  console.log('='.repeat(56));
  console.log('IDSD Holdout Set Evaluation v2');
  console.log(`Version: ${version}`);
  console.log('='.repeat(56));

  // 1. 基线门禁（跑一次）
  let baseline: Record<string, boolean> | null = null;
  if (!skipBaseline) {
    console.log('\n[1/3] Baseline gate (npm test + typecheck)…');
    baseline = runBaseline();
    console.log(`  test:      ${baseline.test ? 'PASS ✅' : 'FAIL ❌'}`);
    console.log(`  typecheck: ${baseline.typecheck ? 'PASS ✅' : 'FAIL ❌'}`);
    if (!baseline.test || !baseline.typecheck) {
      console.log('\nBaseline gate failed — 先修基线，再评估场景。');
    }
  }

  // 2. 构建 app + 逐场景评估
  console.log('\n[2/3] Building app + evaluating scenarios…');
  await createDatabase(); // 初始化数据库单例（路由注册/种子频道需要）
  const app = Fastify({ logger: false });
  await app.register(fastifyCors as any, { origin: true });
  await app.register(fastifyMultipart as any);
  app.get('/api/health', async () => ({ status: 'ok' }));
  // 自动发现并注册 api/ 下所有 register*Routes 模块
  // （新切片新增路由模块后无需再改本文件；联邦 Hub 路由在 federation/ 下，单独注册）
  const apiDir = path.resolve(PROJECT_ROOT, 'packages', 'server', 'src', 'api');
  const apiFiles = fs
    .readdirSync(apiDir)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .sort();
  for (const file of apiFiles) {
    const mod = await import(`../../../packages/server/src/api/${file.replace(/\.ts$/, '.js')}`);
    const registerFn = Object.keys(mod).find(
      (k) => k.startsWith('register') && k.endsWith('Routes') && typeof mod[k] === 'function',
    );
    if (registerFn) {
      try {
        await mod[registerFn](app);
      } catch (err) {
        console.log(`  [warn] ${file} ${registerFn}: ${(err as Error).message}`);
      }
    }
  }
  try {
    const hubMod = await import('../../../packages/server/src/federation/hub.js');
    if (typeof hubMod.registerFederationHubRoutes === 'function') {
      await hubMod.registerFederationHubRoutes(app);
    }
  } catch (err) {
    console.log(`  [warn] federation hub routes: ${(err as Error).message}`);
  }
  ensureDefaultChannel();

  const scenarios = loadScenarios();
  const results: Record<string, any> = {
    version,
    total: 0,
    passed: 0,
    failed: 0,
    manual: 0,
    baseline,
    scenarios: [],
    timestamp: Math.floor(Date.now() / 1000),
  };

  for (const scenario of scenarios) {
    const ctx: Record<string, any> = {};
    // 每个场景一个全新数据库
    resetDatabase();
    const dbFile = path.join(DATA_DIR, 'chatbox.sqlite');
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
    await createDatabase();

    console.log(`\n  Scenario: ${scenario.name} (${scenario.category})`);
    if (!scenario.checks || scenario.checks.length === 0) {
      results.manual += 1;
      results.total += 1;
      results.scenarios.push({ name: scenario.name, category: scenario.category, status: 'MANUAL', checks: [] });
      console.log('    (no checks — MANUAL verification required)');
      continue;
    }

    const checkResults: Array<Record<string, any>> = [];
    for (const check of scenario.checks) {
      const r = await runCheck(app, check, ctx);
      checkResults.push(r);
      console.log(`    ${r.pass ? '✅' : '❌'} ${r.name} — ${r.detail}`);
      if (!r.pass) break;
    }
    const status = checkResults.every((r) => r.pass) ? 'PASS' : 'FAIL';
    results.total += 1;
    if (status === 'PASS') results.passed += 1;
    else results.failed += 1;
    results.scenarios.push({ name: scenario.name, category: scenario.category, status, checks: checkResults });
  }

  // 3. 结果与汇总
  if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });
  const outFile = path.join(resultsDir, `${version}.json`);
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));

  // 清理临时数据库目录
  resetDatabase();
  try {
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  } catch {
    /* ignore */
  }

  console.log('\n' + '='.repeat(56));
  console.log(`Results saved: ${outFile}`);
  console.log('='.repeat(56));
  console.log(`Total scenarios: ${results.total}`);
  console.log(`Passed:          ${results.passed} ✅`);
  console.log(`Failed:          ${results.failed} ❌`);
  console.log(`Manual:          ${results.manual} ⏭️`);
  if (results.total - results.manual > 0) {
    const rate = (results.passed / (results.total - results.manual)) * 100;
    console.log(`Pass rate:       ${rate.toFixed(1)}%`);
  }
  console.log('='.repeat(56));

  const baselineOk = baseline === null || (baseline.test && baseline.typecheck);
  if (results.failed > 0 || !baselineOk) process.exit(1);
}

main().catch((err) => {
  console.error('[evaluate] Fatal:', err);
  process.exit(1);
});
