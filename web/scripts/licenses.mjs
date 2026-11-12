import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { web, json } from './shared.mjs';

const lock = await json(resolve(web, 'package-lock.json'));
const notices = ['Third-party software and wallet artwork notices\n\nThis export uses React, viem and Coinbase Wallet SDK. The list also retains notices for their production dependency tree; not every module is included by the bundler.\n'];
for (const [path, pkg] of Object.entries(lock.packages)) {
  if (!path || pkg.dev || pkg.devOptional) continue;
  const directory = resolve(web, path);
  const names = await readdir(directory);
  const licenses = names.filter((name) => /^(?:licen[cs]e|copying|notice)(?:\.|$)/i.test(name));
  if (!licenses.length) throw Error(`Missing license text for ${path}`);
  notices.push(`\n${'='.repeat(72)}\n${path.replace(/^node_modules\//, '')} ${pkg.version} (${pkg.license ?? 'see license'})\n`);
  for (const name of licenses.sort()) notices.push(await readFile(resolve(directory, name), 'utf8'));
}
notices.push('\nWallet marks: MetaMask, Rabby and Phantom SVGs from rainbow-me/rainbowkit; Coinbase mark from the pinned wallet connector reference. Marks remain trademarks of their respective owners.\n');
notices.push(await readFile(resolve(web, 'art/rainbowkit-LICENSE.txt'), 'utf8'));
await writeFile(resolve(web, 'public/third-party.txt'), notices.join('\n') + '\n');
console.log('Updated static third-party notices.');
