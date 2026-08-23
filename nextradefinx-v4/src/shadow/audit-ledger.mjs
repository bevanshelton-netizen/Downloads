import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).filter(k => value[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}

export function recordHash(record, previousHash = 'GENESIS') {
  const body = { ...record };
  delete body.hash;
  delete body.previous_hash;
  return createHash('sha256').update(`${previousHash}|${canonical(body)}`).digest('hex');
}

export async function readLedger(path) {
  try {
    const raw = await readFile(path, 'utf8');
    return raw.split('\n').filter(Boolean).map(line => JSON.parse(line));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

export async function appendLedger(path, record) {
  const rows = await readLedger(path);
  const previousHash = rows.at(-1)?.hash || 'GENESIS';
  const entry = { ...record, previous_hash: previousHash };
  entry.hash = recordHash(entry, previousHash);
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(entry)}\n`, 'utf8');
  return entry;
}

export async function verifyLedger(path) {
  const rows = await readLedger(path);
  let previousHash = 'GENESIS';
  for (let i = 0; i < rows.length; i++) {
    const expected = recordHash(rows[i], previousHash);
    if (rows[i].previous_hash !== previousHash || rows[i].hash !== expected) return { valid: false, index: i, count: rows.length };
    previousHash = rows[i].hash;
  }
  return { valid: true, count: rows.length, tail_hash: previousHash };
}
