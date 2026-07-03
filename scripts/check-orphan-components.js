#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const baseline = JSON.parse(fs.readFileSync(path.join(root, 'scripts', 'quality-baseline.json'), 'utf8'));
const baselineOrphans = new Set((baseline.orphanComponents || []).map(item => item.file));

const componentsDir = path.join(root, 'packages', 'web', 'src', 'components');
const srcDir = path.join(root, 'packages', 'web', 'src');

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'coverage') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
  }
  return files;
}

function rel(file) {
  return path.relative(root, file).replaceAll(path.sep, '/');
}

function exportedNames(file) {
  const content = fs.readFileSync(file, 'utf8');
  const names = new Set();
  for (const match of content.matchAll(/export\s+function\s+([A-Z][A-Za-z0-9_]*)/g)) names.add(match[1]);
  for (const match of content.matchAll(/export\s+const\s+([A-Z][A-Za-z0-9_]*)/g)) names.add(match[1]);
  for (const match of content.matchAll(/export\s+class\s+([A-Z][A-Za-z0-9_]*)/g)) names.add(match[1]);
  return [...names];
}

const srcFiles = walk(srcDir);
const nonTestFiles = srcFiles.filter(file => !/\.(test|spec)\.(ts|tsx)$/.test(file));
const failures = [];

for (const componentFile of walk(componentsDir)) {
  if (/\.(test|spec)\.(ts|tsx)$/.test(componentFile)) continue;
  const relative = rel(componentFile);
  const names = exportedNames(componentFile);
  if (names.length === 0) continue;

  const importedByRuntime = nonTestFiles.some(file => {
    if (file === componentFile) return false;
    const content = fs.readFileSync(file, 'utf8');
    return names.some(name => new RegExp(`\\b${name}\\b`).test(content));
  });

  if (!importedByRuntime && !baselineOrphans.has(relative)) {
    failures.push({ file: relative, names });
  }
}

if (failures.length > 0) {
  console.error('Orphan component check failed. Components must be used by runtime code or registered in scripts/quality-baseline.json.');
  for (const item of failures) console.error(`- ${item.file}: exports ${item.names.join(', ')}`);
  process.exit(1);
}

console.log('Orphan component check passed.');
