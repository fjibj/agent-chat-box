#!/usr/bin/env node
/**
 * IDSD Holdout Set evaluator for GAP-19 (Node.js version).
 *
 * Usage:
 *   node evaluate.js <version_tag>
 *   node evaluate.js gap19-v1
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function loadScenarios(categoryDir) {
  if (!fs.existsSync(categoryDir)) return [];
  return fs
    .readdirSync(categoryDir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((file) => ({
      name: path.basename(file, '.md'),
      category: path.basename(categoryDir),
      description: fs.readFileSync(path.join(categoryDir, file), 'utf-8'),
    }));
}

function runCommand(cmd, cwd, timeout = 120000) {
  console.log(`  Running: ${cmd}`);
  try {
    execSync(cmd, { cwd, stdio: ['ignore', 'pipe', 'pipe'], timeout });
    return true;
  } catch (err) {
    console.log(`  FAILED: ${err.message}`);
    if (err.stdout) console.log(err.stdout.toString().slice(-800));
    if (err.stderr) console.log(err.stderr.toString().slice(-800));
    return false;
  }
}

function evaluateScenario(scenario, projectRoot) {
  console.log(`\n  Scenario: ${scenario.name} (${scenario.category})`);
  if (!runCommand('npm test', projectRoot)) return 'FAIL';
  if (!runCommand('npm run typecheck', projectRoot)) return 'FAIL';
  return 'PASS';
}

function runAll(projectRoot, holdoutDir) {
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    scenarios: [],
    timestamp: Math.floor(Date.now() / 1000),
  };

  for (const category of ['success', 'failure', 'boundary']) {
    const scenarios = loadScenarios(path.join(holdoutDir, 'scenarios', category));
    for (const scenario of scenarios) {
      const status = evaluateScenario(scenario, projectRoot);
      results.total += 1;
      if (status === 'PASS') results.passed += 1;
      else if (status === 'FAIL') results.failed += 1;
      else results.skipped += 1;
      results.scenarios.push({
        name: scenario.name,
        category,
        status,
      });
    }
  }

  return results;
}

function saveResults(results, version, resultsDir) {
  if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });
  const outputFile = path.join(resultsDir, `${version}.json`);
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
  console.log(`\nResults saved: ${outputFile}`);
}

function printSummary(results) {
  console.log('\n' + '='.repeat(50));
  console.log('IDSD Holdout Set Evaluation — GAP-19');
  console.log('='.repeat(50));
  console.log(`Total scenarios: ${results.total}`);
  console.log(`Passed:          ${results.passed} ✅`);
  console.log(`Failed:          ${results.failed} ❌`);
  console.log(`Skipped:         ${results.skipped} ⏭️`);
  if (results.total > 0) {
    console.log(`Pass rate:       ${((results.passed / results.total) * 100).toFixed(1)}%`);
  }
  console.log('='.repeat(50));
}

function main() {
  const version = process.argv[2];
  if (!version) {
    console.log('Usage: node evaluate.js <version_tag>');
    console.log('Example: node evaluate.js gap19-v1');
    process.exit(1);
  }

  const holdoutDir = __dirname;
  const projectRoot = path.resolve(holdoutDir, '..', '..', '..');
  const resultsDir = path.join(holdoutDir, 'results');

  const results = runAll(projectRoot, holdoutDir);
  saveResults(results, version, resultsDir);
  printSummary(results);

  if (results.failed > 0) process.exit(1);
}

main();
