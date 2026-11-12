import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium, webkit } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { decodeFunctionData, encodeFunctionResult, encodeErrorResult, parseAbi, parseEther, toHex } from 'viem';
import { root, output, json } from '../scripts/shared.mjs';

// Entirely synthetic chain/wallet fixtures. No real wallet, key, funding or broadcast is used.
const manifest = await json(resolve(output, 'imd-deployment.json'));
const abi = await json(resolve(output, manifest.contracts[0].abiPath));
const address = '0x1111111111111111111111111111111111111111';
const hex32 = (digit) => '0x' + digit.repeat(64);
const results = [];
const evidence = resolve(root, 'docs/frontend');
await mkdir(evidence, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (!pathname.startsWith('/preview/')) { response.writeHead(404).end(); return; }
    const name = pathname.slice('/preview/'.length) || 'index.html';
    const file = resolve(output, name);
    if (!file.startsWith(output + sep)) { response.writeHead(403).end(); return; }
    response.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' });
    response.end(await readFile(file));
  } catch { response.writeHead(404).end(); }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const url = `http://127.0.0.1:${server.address().port}/preview/`;
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });

function fixture(overrides = {}) {
  return {
    timestamp: 1794452400n, chainId: 1, code: '0x60016000', failRpc: false, failPrimary: false,
    revert: '', voting: false, receiptStatus: '0x1', holdReceipt: false,
    state: { phase: 0, bettingOpen: true, yesTotal: parseEther('1'), noTotal: parseEther('2'), totalClaimed: 0n, questionCount: 0n, pendingQuestions: 0n, resolvedYes: false, resolvedAt: 0n, winningQuestionId: 0n, bettingClosesAt: 1798761599n, lastAskAt: 1799279999n, resolutionDeadline: 1799366399n },
    yesStake: parseEther('0.1'), noStake: 0n, claimable: 0n, ids: [], verdict: 0, calls: [], simulations: [], ...overrides,
  };
}
const block = (f) => ({ number: toHex(26396168), hash: hex32('2'), parentHash: hex32('3'), timestamp: toHex(f.timestamp), nonce: '0x0000000000000000', difficulty: '0x0', totalDifficulty: '0x0', gasLimit: '0x1c9c380', gasUsed: '0x10000', miner: address, extraData: '0x', baseFeePerGas: '0x3b9aca00', size: '0x200', transactions: [], uncles: [], logsBloom: '0x' + '0'.repeat(512), stateRoot: hex32('4'), receiptsRoot: hex32('4'), transactionsRoot: hex32('4'), sha3Uncles: hex32('4'), mixHash: hex32('4') });
function rpc(request, f) {
  f.calls.push(request.method);
  const p = request.params ?? [];
  switch (request.method) {
    case 'eth_chainId': return toHex(f.chainId);
    case 'eth_blockNumber': return toHex(26396168);
    case 'eth_getBlockByNumber': return block(f);
    case 'eth_getCode': assert.equal(p[0].toLowerCase(), manifest.contracts[0].address.toLowerCase()); return f.code;
    case 'eth_getBalance': return toHex(parseEther('5'));
    case 'eth_call': {
      assert.equal(p[0].to.toLowerCase(), manifest.contracts[0].address.toLowerCase(), 'all calls use manifest address');
      const call = decodeFunctionData({ abi, data: p[0].data });
      const values = { marketState: f.state, QUESTION: 'Was GTA 6 publicly released for sale and playable by 2026-12-31 UTC? Only a full general release counts.', questionIds: f.ids, yesStake: f.yesStake, noStake: f.noStake, claimable: f.claimable, askedAt: 1794452000n, askedBy: address, verdictOf: f.verdict };
      if (call.functionName in values) return encodeFunctionResult({ abi, functionName: call.functionName, result: values[call.functionName] });
      f.simulations.push({ ...call, value: p[0].value ?? '0x0', from: p[0].from });
      if (f.revert) throw { code: 3, message: 'execution reverted', data: encodeErrorResult({ abi, errorName: f.revert }) };
      if (call.functionName === 'settle' && f.voting) throw { code: 3, message: 'execution reverted: Judged: still voting', data: encodeErrorResult({ abi: parseAbi(['error Error(string)']), errorName: 'Error', args: ['Judged: still voting'] }) };
      return encodeFunctionResult({ abi, functionName: call.functionName, ...(call.functionName === 'resolve' ? { result: 42n } : {}) });
    }
    case 'eth_getTransactionReceipt': return f.holdReceipt ? null : { transactionHash: p[0], transactionIndex: '0x0', blockHash: hex32('2'), blockNumber: toHex(26396168), from: address, to: manifest.contracts[0].address, cumulativeGasUsed: '0x10000', gasUsed: '0x10000', effectiveGasPrice: '0x3b9aca00', contractAddress: null, logs: [], logsBloom: '0x' + '0'.repeat(512), status: f.receiptStatus, type: '0x2' };
    case 'eth_getTransactionByHash': return { hash: p[0], from: address, to: manifest.contracts[0].address, value: '0x0', input: '0x', nonce: '0x0', gas: '0x100000', gasPrice: '0x3b9aca00', blockHash: hex32('2'), blockNumber: toHex(26396168), transactionIndex: '0x0', type: '0x0', v: '0x1b', r: hex32('1'), s: hex32('1') };
    default: throw { code: -32601, message: `Unmocked RPC method ${request.method}` };
  }
}
async function newPage(f = fixture(), walletOptions = {}, contextOptions = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ...contextOptions });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => { if (r.url().startsWith(url) && r.status() >= 400) errors.push(`local ${r.status()} ${r.url()}`); });
  await page.route('https://**/*', async (route) => {
    const endpoint = route.request().url();
    if (!manifest.network.rpcUrls.some((rpcUrl) => endpoint.startsWith(rpcUrl))) { await route.abort(); return; }
    if (f.failRpc || f.failPrimary && endpoint.startsWith(manifest.network.rpcUrls[0])) { await route.fulfill({ status: 503, body: 'RPC unavailable' }); return; }
    const payload = route.request().postDataJSON();
    const answer = (r) => { try { return { jsonrpc: '2.0', id: r.id, result: rpc(r, f) }; } catch (error) { return { jsonrpc: '2.0', id: r.id, error }; } };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(Array.isArray(payload) ? payload.map(answer) : answer(payload)) });
  });
  await page.addInitScript(({ address, options }) => {
    const listeners = {};
    const state = { chain: options.chain ?? '0x1', known: options.known ?? true, reject: false, rejectConnect: false, sent: [], requests: [], account: address };
    const provider = {
      on: (event, callback) => { (listeners[event] ??= new Set()).add(callback); },
      removeListener: (event, callback) => listeners[event]?.delete(callback),
      request: async ({ method, params }) => {
        state.requests.push({ method, params });
        if (method === 'eth_accounts') return state.account ? [state.account] : [];
        if (method === 'eth_requestAccounts') { if (state.rejectConnect) throw { code: 4001, message: 'User rejected request' }; return [state.account]; }
        if (method === 'eth_chainId') return state.chain;
        if (method === 'wallet_switchEthereumChain') {
          if (options.rejectSwitch) throw { code: 4001, message: 'User rejected request' };
          if (!state.known) throw { code: 4902, message: 'Unknown chain' };
          state.chain = params[0].chainId; for (const fn of listeners.chainChanged ?? []) fn(state.chain); return null;
        }
        if (method === 'wallet_addEthereumChain') { state.known = true; return null; }
        if (method === 'eth_sendTransaction') {
          if (state.reject) throw { code: 4001, message: 'User rejected request' };
          state.sent.push(params[0]); return '0x' + state.sent.length.toString(16).padStart(64, '0');
        }
        throw { code: -32601, message: 'Unsupported mock wallet method ' + method };
      },
    };
    window.__mock = { ...state, provider, state, emit: (event, value) => { for (const fn of listeners[event] ?? []) fn(value); } };
    if (options.missing) return;
    window.ethereum = provider;
    const uuid = options.dynamicUuid ? crypto.randomUUID() : 'fixture-wallet';
    const announce = () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: { info: { uuid, name: 'Test wallet', icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"><rect width="28" height="28" fill="green"/></svg>', rdns: 'test.wallet' }, provider } }));
    window.addEventListener('eip6963:requestProvider', announce);
  }, { address, options: walletOptions });
  await page.goto(url);
  await page.getByRole('heading', { name: 'Take a side', exact: true }).waitFor();
  return { page, context, f, errors };
}
async function connected(page) {
  await page.getByRole('button', { name: 'Connect wallet', exact: true }).click();
  await page.getByRole('button', { name: 'Test wallet', exact: true }).click();
  await page.getByRole('button', { name: '0x1111…1111', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Review YES bet', exact: true }).waitFor({ state: 'visible' });
  await page.waitForFunction(() => !document.querySelector('.bet-submit').disabled);
}
async function confirm(page) { await page.getByRole('button', { name: 'Simulate & confirm in wallet', exact: true }).click(); }
async function contains(page, text) { await page.getByText(text, { exact: false }).first().waitFor(); }
async function scenario(name, run) {
  const started = Date.now();
  try { await run(); results.push({ name, passed: true, durationMs: Date.now() - started }); console.log(`PASS ${name}`); }
  catch (e) { results.push({ name, passed: false, error: e.message, durationMs: Date.now() - started }); console.error(`FAIL ${name}: ${e.message}`); throw e; }
}

try {
  await scenario('Static subpath, mobile first screen, reflow, typography and accessibility', async () => {
    const { page, context, errors } = await newPage();
    await contains(page, 'block 26396168');
    for (const width of [320, 390, 720, 1440]) {
      await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 });
      await page.screenshot({ path: resolve(evidence, `${width}.png`), fullPage: width === 1440 });
      const geometry = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, primary: document.querySelector('.bet-submit').getBoundingClientRect().toJSON(), wallet: document.querySelector('.wallet-button').getBoundingClientRect().toJSON() }));
      assert(geometry.scroll <= geometry.width + 1, `overflow at ${width}`);
      if (width === 390) { assert(geometry.primary.bottom <= 844, 'main action on first phone screen'); assert(geometry.wallet.bottom <= 844); }
    }
    const audit = await new AxeBuilder({ page }).analyze();
    await writeFile(resolve(evidence, 'accessibility.json'), JSON.stringify({ engine: 'axe-core', violations: audit.violations, incomplete: audit.incomplete.map(({ id, impact, description }) => ({ id, impact, description })), passes: audit.passes.length }, null, 2) + '\n');
    assert.equal(audit.violations.length, 0, JSON.stringify(audit.violations.map(({id, nodes}) => ({id, nodes:nodes.map((n)=>n.target)}))));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Connect wallet', exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('dialog').waitFor();
    assert(await page.getByRole('button', { name: 'Test wallet', exact: true }).isVisible());
    assert.equal(await page.getByText('Browser wallet', { exact: true }).count(), 0, 'named extension replaces generic row');
    await page.keyboard.press('Escape');
    assert(await page.getByRole('button', { name: 'Connect wallet', exact: true }).evaluate((e) => e === document.activeElement));
    await page.screenshot({ path: resolve(evidence, 'focus.png') });
    assert.deepEqual(errors, []);
    await context.close();
  });
  await scenario('YES and NO bets simulate, require review, and send exact wei to the manifest contract', async () => {
    const { page, context, f, errors } = await newPage(); await connected(page);
    await page.getByLabel('Stake amount', { exact: true }).fill('0');
    await page.getByRole('button', { name: 'Review YES bet', exact: true }).click();
    await contains(page, 'Enter an ETH amount greater than zero.');
    assert.equal(await page.getByRole('dialog').count(), 0);
    for (const side of ['YES', 'NO']) {
      await page.getByRole('radio', { name: new RegExp('^' + side + ' ') }).check();
      await page.getByLabel('Stake amount', { exact: true }).fill('0.01');
      await page.getByRole('button', { name: `Review ${side} bet`, exact: true }).click();
      assert.equal(await page.evaluate(() => window.__mock.state.sent.length), side === 'YES' ? 0 : 1, 'review does not sign');
      await confirm(page); await contains(page, 'Confirmed on Ethereum.');
      const sent = await page.evaluate(() => window.__mock.state.sent.at(-1));
      assert.equal(sent.to.toLowerCase(), manifest.contracts[0].address.toLowerCase());
      assert.equal(BigInt(sent.value), parseEther('0.01'));
      assert.equal(decodeFunctionData({ abi, data: sent.data }).functionName, side === 'YES' ? 'betYes' : 'betNo');
      assert.equal(f.simulations.at(-1).functionName, side === 'YES' ? 'betYes' : 'betNo');
    }
    assert.deepEqual(errors, []); await context.close();
  });
  await scenario('Keyboard-only wallet connection, radio choice, amount entry and reviewed bet', async () => {
    const { page, context } = await newPage(fixture(), {}, { viewport: { width: 390, height: 844 } });
    await page.getByRole('button', { name: 'Connect wallet', exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('dialog').waitFor();
    await page.keyboard.press('Tab');
    assert(await page.getByRole('button', { name: 'Test wallet', exact: true }).evaluate((e) => e === document.activeElement));
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: '0x1111…1111', exact: true }).waitFor();
    await page.waitForFunction(() => !document.querySelector('.bet-submit').disabled);
    await page.getByRole('radio', { name: /^YES/ }).focus();
    await page.keyboard.press('ArrowRight');
    assert(await page.getByRole('radio', { name: /^NO/ }).isChecked());
    await page.screenshot({ path: resolve(evidence, 'focus-radio.png') });
    await page.keyboard.press('Tab');
    assert(await page.getByLabel('Stake amount', { exact: true }).evaluate((e) => e === document.activeElement));
    await page.keyboard.type('0.01'); await page.keyboard.press('Enter');
    await page.getByRole('heading', { name: 'Bet NO', exact: true }).waitFor();
    await page.keyboard.press('Tab');
    assert(await page.getByRole('button', { name: 'Simulate & confirm in wallet', exact: true }).evaluate((e) => e === document.activeElement));
    await page.keyboard.press('Enter'); await contains(page, 'Confirmed on Ethereum.');
    const sent = await page.evaluate(() => window.__mock.state.sent[0]);
    assert.equal(decodeFunctionData({ abi, data: sent.data }).functionName, 'betNo');
    await context.close();
  });
  await scenario('Unknown chain offers exact wallet_addEthereumChain handoff, then switches again', async () => {
    const { page, context } = await newPage(fixture(), { chain: '0xa', known: false }); await connected(page);
    const requests = await page.evaluate(() => window.__mock.state.requests);
    const relevant = requests.filter((r) => r.method.startsWith('wallet_'));
    assert.deepEqual(relevant.map((r) => r.method), ['wallet_switchEthereumChain', 'wallet_addEthereumChain', 'wallet_switchEthereumChain']);
    assert.deepEqual(relevant[1].params, [manifest.walletAddChain]); await context.close();
  });
  await scenario('Rejected chain switch leaves a visible wrong-network state and no transaction access', async () => {
    const { page, context } = await newPage(fixture(), { chain: '0xa', rejectSwitch: true });
    await page.getByRole('button', { name: 'Connect wallet', exact: true }).click(); await page.getByRole('button', { name: 'Test wallet', exact: true }).click();
    await contains(page, 'Your wallet is on another network.');
    assert(await page.locator('.wallet-button').getByText('Switch to Ethereum').isVisible());
    assert(await page.getByRole('button', { name: 'Review YES bet', exact: true }).isDisabled());
    assert.equal(await page.evaluate(() => window.__mock.state.sent.length), 0); await context.close();
  });
  await scenario('Wallet rejection and simulation revert show recovery and do not broadcast', async () => {
    const { page, context, f } = await newPage(); await connected(page);
    await page.getByLabel('Stake amount', { exact: true }).fill('0.01');
    await page.evaluate(() => { window.__mock.state.reject = true; });
    await page.getByRole('button', { name: 'Review YES bet', exact: true }).click(); await confirm(page);
    await contains(page, 'Request declined in your wallet.');
    assert.equal(await page.evaluate(() => window.__mock.state.sent.length), 0);
    await page.evaluate(() => { window.__mock.state.reject = false; }); f.revert = 'BettingClosed';
    await page.getByRole('button', { name: 'Review YES bet', exact: true }).click(); await confirm(page);
    await contains(page, 'Betting has closed or is suspended.');
    assert.equal(await page.evaluate(() => window.__mock.state.sent.length), 0); await context.close();
  });
  await scenario('Pending confirmation prevents duplicate submissions; a reverted receipt reports gas spent', async () => {
    const f = fixture({ holdReceipt: true });
    const { page, context } = await newPage(f); await connected(page);
    await page.getByLabel('Stake amount', { exact: true }).fill('0.01');
    await page.getByRole('button', { name: 'Review YES bet', exact: true }).click(); await confirm(page);
    await contains(page, 'Transaction submitted.');
    assert(await page.getByRole('button', { name: 'Awaiting confirmation…', exact: true }).isDisabled());
    assert(await page.getByRole('button', { name: 'Review evidence submission', exact: true }).isDisabled());
    assert.equal(await page.evaluate(() => window.__mock.state.sent.length), 1);
    f.receiptStatus = '0x0'; f.holdReceipt = false;
    await contains(page, 'The transaction reverted on chain.'); await contains(page, 'network gas was spent.');
    await page.waitForFunction(() => !document.querySelector('.bet-submit').disabled);
    assert.equal(await page.evaluate(() => window.__mock.state.sent.length), 1); await context.close();
  });
  await scenario('Pending transaction survives reload and must be confirmed before actions unlock', async () => {
    const f = fixture({ holdReceipt: true });
    const { page, context } = await newPage(f); await connected(page);
    await page.getByLabel('Stake amount', { exact: true }).fill('0.01');
    await page.getByRole('button', { name: 'Review YES bet', exact: true }).click(); await confirm(page);
    await contains(page, 'Transaction submitted.');
    await page.waitForFunction(() => Object.keys(localStorage).some((k) => k.startsWith('six-pending-')));
    await page.reload(); await contains(page, 'A transaction from an earlier visit');
    assert(await page.locator('.bet-submit').isDisabled());
    f.holdReceipt = false;
    await page.getByRole('button', { name: 'Check confirmation', exact: true }).click();
    await contains(page, 'Transaction confirmed. Market state refresh finished.');
    await page.waitForFunction(() => !document.querySelector('.bet-submit').disabled);
    assert.equal(await page.evaluate(() => window.__mock.state.sent.length), 0, 'reload does not submit another transaction');
    await context.close();
  });
  await scenario('Evidence validates ASCII and byte length; resolve sends the reviewed proof and budget', async () => {
    const { page, context, f } = await newPage(); await connected(page);
    await page.getByRole('button', { name: 'Review evidence submission', exact: true }).click();
    await contains(page, 'Add a link to release evidence.');
    await page.getByLabel('Release evidence', { exact: true }).fill('https://example.com/é');
    await page.getByRole('button', { name: 'Review evidence submission', exact: true }).click(); await contains(page, 'Use ASCII evidence');
    const proof = 'https://example.com/official-release';
    await page.getByLabel('Release evidence', { exact: true }).fill(proof);
    await page.getByRole('button', { name: 'Review evidence submission', exact: true }).click(); await confirm(page); await contains(page, 'Confirmed on Ethereum.');
    const sent = await page.evaluate(() => window.__mock.state.sent[0]);
    const call = decodeFunctionData({ abi, data: sent.data });
    assert.equal(call.functionName, 'resolve'); assert.equal(call.args[0], proof); assert.equal(BigInt(sent.value), parseEther('0.002')); assert.equal(f.simulations.at(-1).functionName, 'resolve');
    await context.close();
  });
  await scenario('Pending questions suspend betting; settlement handles still-voting and successful simulation', async () => {
    const f = fixture({ ids: [42n], voting: true }); f.state = { ...f.state, phase: 1, bettingOpen: false, questionCount: 1n, pendingQuestions: 1n };
    const { page, context } = await newPage(f);
    await page.getByRole('button', { name: 'Connect wallet', exact: true }).click(); await page.getByRole('button', { name: 'Test wallet', exact: true }).click();
    await page.getByRole('button', { name: '0x1111…1111', exact: true }).waitFor();
    await contains(page, 'Betting suspended'); assert(await page.getByRole('button', { name: 'Review YES bet', exact: true }).isDisabled());
    const settle = page.getByRole('button', { name: 'Review settlement 42', exact: true });
    await page.waitForFunction(() => { const b = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Review settlement 42'); return b && !b.disabled; });
    await settle.click(); await confirm(page); await contains(page, 'Judge is still voting.');
    assert.equal(await page.evaluate(() => window.__mock.state.sent.length), 0);
    f.voting = false; await settle.click(); await confirm(page); await contains(page, 'Confirmed on Ethereum.');
    const sent = await page.evaluate(() => window.__mock.state.sent[0]); const call = decodeFunctionData({ abi, data: sent.data }); assert.equal(call.functionName, 'settle'); assert.equal(call.args[0], 42n);
    await context.close();
  });
  await scenario('Resolved market enables the exact claim amount and locks betting/evidence', async () => {
    const f = fixture({ claimable: parseEther('0.3') }); f.state = { ...f.state, phase: 2, bettingOpen: false, resolvedYes: true, resolvedAt: 1794452000n, winningQuestionId: 42n };
    const { page, context } = await newPage(f);
    await page.getByRole('button', { name: 'Connect wallet', exact: true }).click(); await page.getByRole('button', { name: 'Test wallet', exact: true }).click();
    await page.getByRole('button', { name: '0x1111…1111', exact: true }).waitFor();
    await page.waitForFunction(() => { const b = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Review claim'); return b && !b.disabled; });
    assert(await page.getByRole('button', { name: 'Review YES bet', exact: true }).isDisabled()); assert(await page.getByRole('button', { name: 'Review evidence submission', exact: true }).isDisabled());
    await page.getByRole('button', { name: 'Review claim', exact: true }).click(); await contains(page, 'Collect 0.3 ETH'); await confirm(page); await contains(page, 'Confirmed on Ethereum.');
    const sent = await page.evaluate(() => window.__mock.state.sent[0]); assert.equal(decodeFunctionData({ abi, data: sent.data }).functionName, 'claim'); assert.equal(BigInt(sent.value ?? '0x0'), 0n); await context.close();
  });
  await scenario('RPC fallback works; missing code and wrong RPC chain keep actions disabled', async () => {
    for (const overrides of [{ failPrimary: true }, { code: '0x' }, { chainId: 10 }]) {
      const { page, context } = await newPage(fixture(overrides));
      if (overrides.failPrimary) await connected(page);
      else { await contains(page, 'Transactions are disabled.'); await page.getByRole('button', { name: 'Connect wallet', exact: true }).click(); await page.getByRole('button', { name: 'Test wallet', exact: true }).click(); await page.getByRole('button', { name: 'Review YES bet', exact: true }).waitFor(); assert(await page.getByRole('button', { name: 'Review YES bet', exact: true }).isDisabled()); }
      await context.close();
    }
  });
  await scenario('Read failures retain marked data, lock actions, and recover on explicit refresh', async () => {
    const f = fixture(); const { page, context } = await newPage(f); await connected(page);
    f.failRpc = true;
    await page.getByRole('button', { name: 'Refresh state', exact: true }).click();
    await contains(page, 'Unable to complete this request.');
    assert(await page.getByRole('button', { name: 'Review YES bet', exact: true }).isDisabled());
    f.failRpc = false;
    await page.getByRole('button', { name: 'Retry reads', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('.bet-submit').disabled);
    assert.equal(await page.evaluate(() => window.__mock.state.sent.length), 0); await context.close();
  });
  await scenario('NO wins after the deadline and a contract-derived refund remains claimable', async () => {
    const f = fixture({ timestamp: 1799366400n, claimable: parseEther('0.1') });
    f.state = { ...f.state, phase: 3, bettingOpen: false, noTotal: 0n };
    const { page, context } = await newPage(f);
    await page.getByRole('button', { name: 'Connect wallet', exact: true }).click(); await page.getByRole('button', { name: 'Test wallet', exact: true }).click();
    await contains(page, 'NO won');
    await page.waitForFunction(() => { const b = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Review claim'); return b && !b.disabled; });
    assert(await page.getByRole('button', { name: 'Review YES bet', exact: true }).isDisabled());
    assert(await page.getByRole('button', { name: 'Review evidence submission', exact: true }).isDisabled());
    await page.getByRole('button', { name: 'Review claim', exact: true }).click(); await contains(page, 'Collect 0.1 ETH');
    await page.keyboard.press('Escape'); await context.close();
  });
  await scenario('Phone without extension offers four wallet browser links and Coinbase Smart Wallet', async () => {
    const { page, context } = await newPage(fixture(), { missing: true }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1' });
    await page.getByRole('button', { name: 'Connect wallet', exact: true }).click();
    for (const name of ['MetaMask', 'Coinbase Wallet', 'Rabby', 'Phantom']) assert(await page.getByRole('link', { name: `Open in ${name}` }).isVisible());
    assert(await page.getByRole('button', { name: 'Coinbase Smart Wallet', exact: true }).isVisible());
    const rabby = new URL(await page.getByRole('link', { name: 'Open in Rabby' }).getAttribute('href'));
    assert.equal(rabby.searchParams.get('_cmd'), 'open-dapp'); assert.equal(rabby.searchParams.get('dapp'), url);
    assert.equal(await page.getByText('WalletConnect', { exact: true }).count(), 0);
    await page.screenshot({ path: resolve(evidence, 'wallet-mobile.png') });
    const audit = await new AxeBuilder({ page }).analyze(); assert.equal(audit.violations.length, 0, JSON.stringify(audit.violations.map((v) => v.id)));
    await page.keyboard.press('Escape'); await context.close();
  });
  await scenario('Long balances, full addresses, 200% text and account changes preserve reflow', async () => {
    const f = fixture({ yesStake: parseEther('12345678901234567890.123456789012345678') });
    const { page, context } = await newPage(f); await connected(page);
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.getByRole('button', { name: '0x1111…1111', exact: true }).click();
      assert(await page.getByRole('dialog').locator('.address').isVisible());
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
      await page.keyboard.press('Escape');
    }
    await page.addStyleTag({ content: ':root{font-size:32px !important}' });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
    await page.evaluate(() => { window.__mock.state.account = null; window.__mock.emit('accountsChanged', []); });
    await page.getByRole('button', { name: 'Connect wallet', exact: true }).waitFor();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
    assert.equal(await page.getByRole('button', { name: 'Review YES bet', exact: true }).count(), 0); await context.close();
  });
  await scenario('Tampered ABI cannot unlock the app', async () => {
    const { page, context } = await newPage();
    await page.route('**/abi/GtaSixMarket.json', (route) => route.fulfill({ contentType: 'application/json', body: '[]' }));
    await page.reload(); await contains(page, 'ABI verification failed.');
    assert.equal(await page.getByRole('button', { name: 'Connect wallet', exact: true }).count(), 0); await context.close();
  });
  await scenario('Wallet session reconnects without a new permission request; disconnect clears it', async () => {
    const { page, context } = await newPage(fixture(), { dynamicUuid: true }); await connected(page); await page.reload();
    await page.getByRole('button', { name: '0x1111…1111', exact: true }).waitFor();
    const requests = await page.evaluate(() => window.__mock.state.requests.map((r) => r.method));
    assert(requests.includes('eth_accounts')); assert(!requests.includes('eth_requestAccounts'));
    await page.getByRole('button', { name: '0x1111…1111', exact: true }).click(); await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
    assert.equal(await page.evaluate(() => localStorage.getItem('gta-six-wallet')), null);
    await page.getByRole('button', { name: 'Connect wallet', exact: true }).waitFor(); await context.close();
  });
  try {
    const safari = await webkit.launch({ headless: true });
    await safari.close();
    results.push({ name: 'WebKit runtime availability', passed: true, note: 'Runtime available; Chromium scenarios above are not WebKit results.' });
  } catch { results.push({ name: 'WebKit', status: 'not run', reason: 'WebKit executable is not installed in the worker runtime.' }); }
} finally {
  await writeFile(resolve(evidence, 'interaction-results.json'), JSON.stringify({ recordedAt: new Date().toISOString(), validation: 'Worker-run; mocked chain/wallet only, no live transactions', results }, null, 2) + '\n');
  await browser.close(); await new Promise((done) => server.close(done));
}
