import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, '..', 'supabase');
const files = await readdir(dir);
const numbered = files
  .map(name => ({ name, match: name.match(/^(\d{3})_.+\.sql$/) }))
  .filter(item => item.match)
  .map(item => ({ name: item.name, number: Number(item.match[1]) }))
  .filter(item => item.number >= 2)
  .sort((a,b) => a.number - b.number);

const seen = new Set();
for (const item of numbered) {
  if (seen.has(item.number)) throw new Error(`Duplicate migration number ${item.number}: ${item.name}`);
  seen.add(item.number);
}

const latest = 17;
for (let number = 2; number <= latest; number += 1) {
  if (!seen.has(number)) throw new Error(`Missing KORA migration ${String(number).padStart(3,'0')}`);
}
if (numbered.at(-1)?.number !== latest) throw new Error(`Update migration validator latest version; found ${numbered.at(-1)?.number ?? 'none'}, expected ${latest}`);

console.log(`KORA migration sequence validated: 002 through ${String(latest).padStart(3,'0')}.`);
