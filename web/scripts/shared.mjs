import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { keccak256, toHex } from 'viem';

export const web = resolve(import.meta.dirname, '..');
export const root = resolve(web, '..');
export const output = resolve(root, 'dist');
export const json = async (path) => JSON.parse(await readFile(path, 'utf8'));
export const canonical = (value) => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
export const abiHash = (abi) => keccak256(toHex(JSON.stringify(canonical(abi)))).slice(2);
export const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
export async function inventory(dir = output, prefix = '') {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw Error('Symlinks are not export assets');
    const path = prefix + entry.name;
    if (entry.isDirectory()) files.push(...await inventory(resolve(dir, entry.name), path + '/'));
    else if (path !== 'imd-deployment.json') {
      const bytes = await readFile(resolve(dir, entry.name));
      if (bytes.length > 8388608) throw Error(`${path} exceeds 8 MiB`);
      files.push({ path, sha256: sha(bytes), size: bytes.length });
    }
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}
