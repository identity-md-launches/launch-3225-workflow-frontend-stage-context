import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { web, root, output, json, abiHash, inventory, canonical } from './shared.mjs';

const pinned = await access(resolve(root, '.imd/reads/deployment.json')).then(() => true, () => false);
const handoff = await json(resolve(pinned ? root : web, pinned ? '.imd/reads/deployment.json' : 'deployment/handoff.json'));
const chain = await json(resolve(pinned ? root : web, pinned ? '.imd/reads/network.json' : 'deployment/network.json'));
const m = await json(resolve(output, 'imd-deployment.json'));
const keys = ['version', 'launchId', 'chainId', 'sourceCommit', 'attestationHash', 'contracts', 'assets', 'network', ...(chain.walletAddChain ? ['walletAddChain'] : []), ...(handoff.poolKey ? ['poolKey'] : [])];
assert.deepEqual(Object.keys(m).sort(), keys.sort());
assert.equal(m.version, 1);
for (const key of ['launchId', 'chainId', 'sourceCommit', 'attestationHash']) assert.equal(m[key], handoff[key]);
assert.deepEqual(m.network, chain.network);
assert.deepEqual(m.walletAddChain, chain.walletAddChain);
assert.deepEqual(m.poolKey, handoff.poolKey);
assert.deepEqual(m.contracts.map(({ abiPath, ...c }) => c), handoff.contracts.map(({ name, address, abiHash }) => ({ name, address, abiHash })));
for (const c of m.contracts) {
  assert.match(c.abiPath, /^abi\/[A-Za-z][A-Za-z0-9_]*\.json$/);
  assert.equal(abiHash(await json(resolve(output, c.abiPath))), c.abiHash);
}
const files = await inventory();
assert(files.length <= 128);
assert.deepEqual(canonical(m.assets), canonical(files.map(({ path, sha256 }) => ({ path, sha256 }))));
assert(files.some((f) => f.path === 'index.html'));
console.log(JSON.stringify({ passed: true, comparedAgainstPinnedHandoff: pinned, contracts: m.contracts.length, assets: files.length, bytes: files.reduce((s, f) => s + f.size, 0), abiHash: m.contracts[0].abiHash }, null, 2));
