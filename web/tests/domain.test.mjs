import test from 'node:test';
import assert from 'node:assert/strict';
import { amountWei, validateProof, indicativePayout, eth, errorMessage } from '../src/domain.ts';
import { abiHash, json } from '../scripts/shared.mjs';

test('ABI is the implementation-derived handoff binding', async () => {
  const handoff = await json(new URL('../deployment/handoff.json', import.meta.url));
  const abi = await json(new URL('../deployment/GtaSixMarket.json', import.meta.url));
  assert.equal(abiHash(abi), handoff.contracts[0].abiHash);
  assert.deepEqual(abi.filter((f) => f.type === 'function' && ['payable', 'nonpayable'].includes(f.stateMutability)).map((f) => f.name).sort(), ['betNo', 'betYes', 'claim', 'resolve', 'settle']);
});
test('ETH parsing preserves wei and rejects rounding, scientific notation and nonpositive values', () => {
  assert.equal(amountWei('0.000000000000000001'), 1n);
  assert.equal(amountWei(' 1.25 '), 1250000000000000000n);
  for (const n of ['0', '-1', '1e18', '.1', '1.1234567890123456789', 'NaN', '', '1,000']) assert.throws(() => amountWei(n));
  assert.throws(() => amountWei('1' + '0'.repeat(80)));
});
test('evidence is nonempty ASCII up to 650 bytes and contains a URL', () => {
  assert.equal(validateProof('https://example.com/release'), 'https://example.com/release');
  const atLimit = 'https://' + 'a'.repeat(642);
  assert.equal(validateProof(atLimit), atLimit);
  for (const p of ['', 'release is out', 'https://example.com/é', atLimit + 'a']) assert.throws(() => validateProof(p));
});
test('indicative returns include the new stake in both pot and selected side', () => {
  assert.equal(indicativePayout(10n, 20n, 50n), 20n);
  assert.equal(indicativePayout(10n, 0n, 0n), 10n);
  assert.equal(indicativePayout(0n, 0n, 0n), 0n);
});
test('amount displays never imply a tiny positive balance is zero', () => {
  assert.equal(eth(1n), '<0.000001');
  assert.equal(eth(1n, true), '0.000000000000000001');
  assert.equal(eth(0n), '0');
});
test('wallet errors are recoverable without exposing RPC internals', () => {
  assert.match(errorMessage({code:4001}), /declined/);
  assert.match(errorMessage({message:'insufficient funds for gas'}), /Leave ETH/);
  assert.match(errorMessage({message:'Failed to fetch'}), /refresh/);
});
