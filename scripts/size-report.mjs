import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { gzipSync } from 'node:zlib';

const root = '.output/chrome-mv3';
const manifestPath = join(root, 'manifest.json');
const cache = new Map();
const allFiles = [];

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (entry.isFile() && entry.name.endsWith('.js')) allFiles.push(full);
  }
}

async function sourceOf(file) {
  if (!cache.has(file)) cache.set(file, await readFile(file));
  return cache.get(file);
}

function importedJsFiles(source) {
  const text = source.toString('utf8');
  const refs = new Set();
  const patterns = [
    /\bfrom\s*['"]([^'"]+\.js(?:\?[^'"]*)?)['"]/g,
    /\bimport\s*['"]([^'"]+\.js(?:\?[^'"]*)?)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+\.js(?:\?[^'"]*)?)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) refs.add(match[1].split('?')[0]);
  }
  return [...refs];
}

async function bundleClosure(entries) {
  const seen = new Set();
  const pending = [...entries];
  while (pending.length) {
    const file = pending.pop();
    if (!file || seen.has(file)) continue;
    try { await stat(file); } catch { continue; }
    seen.add(file);
    const source = await sourceOf(file);
    for (const ref of importedJsFiles(source)) {
      const dependency = ref.startsWith('/') ? join(root, ref.slice(1)) : resolve(dirname(file), ref);
      if (dependency.startsWith(`${root}${sep}`) && !seen.has(dependency)) pending.push(dependency);
    }
  }
  return seen;
}

try {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  await walk(root);

  const contentEntries = (manifest.content_scripts ?? []).flatMap((item) => item.js ?? []).map((file) => join(root, file));
  const mainWorldEntries = (manifest.web_accessible_resources ?? []).flatMap((item) => item.resources ?? [])
    .filter((file) => /leetcode-main-world\.js$/i.test(file)).map((file) => join(root, file));
  const backgroundEntries = manifest.background?.service_worker ? [join(root, manifest.background.service_worker)] : [];

  let total = 0;
  for (const file of allFiles) {
    const size = gzipSync(await sourceOf(file)).byteLength;
    total += size;
    console.log(`${relative(root, file).padEnd(48)} ${String(size).padStart(8)} bytes gzip`);
  }
  console.log(`\nAll JavaScript gzip total: ${total} bytes`);

  const groups = [
    ['LeetCode content + MAIN-world JS', [...contentEntries, ...mainWorldEntries], 50_000],
    ['Background JS', backgroundEntries, 200_000],
  ];
  for (const [label, entries, budget] of groups) {
    if (!entries.length) { console.warn(`${label}: manifest entry not found; inspect generated manifest.`); continue; }
    const files = await bundleClosure(entries);
    const size = [...files].reduce((sum, file) => sum + gzipSync(cache.get(file)).byteLength, 0);
    console.log(`${label}: ${size} / ${budget} bytes gzip ${size <= budget ? 'PASS' : 'OVER BUDGET'}`);
    if (size > budget) process.exitCode = 2;
  }
} catch (error) {
  console.error(`Build not found or invalid at ${root}. Run npm run build first.`, error instanceof Error ? error.message : '');
  process.exit(1);
}
