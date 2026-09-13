import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';

const root = process.cwd();
const files = ['README.md', 'AGENTS.md', ...readdirSync('docs').filter(f => f.endsWith('.md')).map(f => join('docs', f))];
const broken = [];
let words = 0;
for (const file of files) {
  const content = readFileSync(file, 'utf8');
  words += content.split(/\s+/).filter(Boolean).length;
  for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].split('#')[0];
    if (!target || /^[a-z]+:/i.test(target)) continue;
    if (!existsSync(resolve(root, dirname(file), target))) broken.push({ file, target });
  }
}
console.log(JSON.stringify({ markdownFiles: files.length, approximateWords: words, brokenLinks: broken }, null, 2));
if (broken.length) process.exitCode = 1;
