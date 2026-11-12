import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { web, output, json, abiHash, inventory } from './shared.mjs';

const handoff = await json(resolve(web, 'deployment/handoff.json'));
const chain = await json(resolve(web, 'deployment/network.json'));
if (chain.network.chainId !== handoff.chainId) throw Error('Network/handoff chain mismatch');
const contracts = [];
for (const contract of handoff.contracts) {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(contract.name)) throw Error('Unsafe ABI name');
  const source = resolve(web, `deployment/${contract.name}.json`);
  const abi = await json(source);
  if (!Array.isArray(abi) || abiHash(abi) !== contract.abiHash) throw Error(`ABI binding failed: ${contract.name}`);
  const abiPath = `abi/${contract.name}.json`;
  await mkdir(resolve(output, 'abi'), { recursive: true });
  await copyFile(source, resolve(output, abiPath));
  contracts.push({ name: contract.name, address: contract.address, abiHash: contract.abiHash, abiPath });
}
const files = await inventory();
if (files.length > 128 || files.reduce((sum, f) => sum + f.size, 0) > 8 * 1024 * 1024) throw Error('Export exceeds assignment budget');
const manifest = {
  version: 1, launchId: handoff.launchId, chainId: handoff.chainId,
  sourceCommit: handoff.sourceCommit, attestationHash: handoff.attestationHash, contracts,
  ...(handoff.poolKey ? { poolKey: handoff.poolKey } : {}),
  network: chain.network, ...(chain.walletAddChain ? { walletAddChain: chain.walletAddChain } : {}),
  assets: files.map(({ path, sha256 }) => ({ path, sha256 })),
};
await writeFile(resolve(output, 'imd-deployment.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Export bound to ${handoff.sourceCommit}: ${files.length} assets, ${files.reduce((s, f) => s + f.size, 0)} bytes`);
