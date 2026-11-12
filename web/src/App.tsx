import { useState, type FormEvent } from 'react';
import { formatEther } from 'viem';
import type { Config } from './config';
import { useWallet } from './wallet';
import { useMarket, type Action } from './market';
import { AddressView, Dialog, WalletSheet, shortAddress } from './components';
import { amountWei, errorMessage, eth, indicativePayout, utc, validateProof, UserError } from './domain';

export default function App({ config }: { config: Config }) {
  const wallet = useWallet(config);
  const market = useMarket(config, wallet);
  const [side, setSide] = useState<'yes' | 'no'>('yes');
  const [amount, setAmount] = useState('');
  const [betError, setBetError] = useState('');
  const [proof, setProof] = useState('');
  const [budget, setBudget] = useState('0.002');
  const [resolveError, setResolveError] = useState('');
  const [questionId, setQuestionId] = useState('');
  const [settleError, setSettleError] = useState('');
  const s = market.snapshot;
  const state = s?.state;
  const pot = state ? state.yesTotal + state.noTotal : undefined;
  const yesPercent = state && pot && pot > 0n ? Number(state.yesTotal * 10000n / pot) / 100 : undefined;
  const bettingAllowed = !!state?.bettingOpen && market.now <= state.bettingClosesAt;
  const resolved = state?.phase === 2 || state?.phase === 3;
  const canResolve = !!state && !state.resolvedYes && market.now <= state.lastAskAt;
  const own = !!wallet.address && s?.account === wallet.address;
  let preview: bigint | undefined;
  try { if (state) preview = indicativePayout(amountWei(amount), side === 'yes' ? state.yesTotal : state.noTotal, pot!); } catch { /* Preview appears after a valid amount. */ }
  const status = market.readError ? 'State unavailable' : state && !market.fresh ? 'Refresh required' : !state ? 'Loading market' : state.phase === 2 ? 'YES won' : state.phase === 3 ? 'NO won' : state.pendingQuestions > 0n ? 'Betting suspended' : bettingAllowed ? 'Betting open' : 'Betting closed';
  const label = (id: string, normal: string) => market.tx?.action === id && market.busy ? market.tx.stage === 'simulating' ? 'Checking transaction…' : market.tx.stage === 'signing' ? 'Confirm in wallet…' : 'Awaiting confirmation…' : normal;
  const feedback = (id: string, prefix = false) => market.tx && (prefix ? market.tx.action.startsWith(id) : market.tx.action === id) ? <div className={`action-feedback tx-${market.tx.stage}`} role="status"><p>{market.tx.message}</p>{market.tx.hash && <a className="tx-link" href={`${config.manifest.network.explorer}/tx/${market.tx.hash}`} target="_blank" rel="noreferrer">View transaction on explorer ↗</a>}{market.tx.stage === 'unconfirmed' && <button type="button" className="secondary" onClick={() => void market.checkConfirmation()}>Check confirmation</button>}{!market.busy && <button type="button" className="text-button" onClick={() => market.setTx(undefined)}>Dismiss status</button>}</div> : null;
  const entryAction = () => { if (!wallet.address) { wallet.setOpen(true); return true; } if (!wallet.isRightChain) return true; return false; };
  const actionLabel = (normal: string) => !wallet.address ? 'Connect to continue' : normal;
  const prepare = (action: Action) => { if (!entryAction() && market.ready && !market.busy) market.setReview(action); };
  const reviewBet = (e: FormEvent) => {
    e.preventDefault(); if (entryAction()) return;
    setBetError('');
    try {
      const value = amountWei(amount);
      if (own && s?.balance !== undefined && value >= s.balance) throw new UserError('Leave ETH in your wallet for network gas. Enter a smaller amount.');
      if (!bettingAllowed) throw new UserError('Betting is closed or suspended. Refresh to see the current state.');
      prepare({ id: 'bet', functionName: side === 'yes' ? 'betYes' : 'betNo', value, title: `Bet ${side.toUpperCase()}`, description: `Stake ${formatEther(value)} ETH on ${side.toUpperCase()}. Bets cannot be withdrawn. Winners share the final pot; odds can change until betting closes.` });
    } catch (error) { setBetError(errorMessage(error)); document.getElementById('bet-amount')?.focus(); }
  };
  const reviewResolve = (e: FormEvent) => {
    e.preventDefault(); if (entryAction()) return;
    setResolveError('');
    try {
      const evidence = validateProof(proof); const value = amountWei(budget);
      if (own && s?.balance !== undefined && value >= s.balance) throw new UserError('Leave ETH for gas. Lower the question budget or add funds.');
      prepare({ id: 'resolve', functionName: 'resolve', args: [evidence], value, title: 'Submit release evidence', description: `Send up to ${formatEther(value)} ETH to pay Judge. Unused budget returns in the same transaction. Every submitted question suspends betting until settled; a question fee is spent even when the answer is NO.` });
    } catch (error) { setResolveError(errorMessage(error)); }
  };
  const reviewSettle = (id: bigint) => prepare({ id: `settle-${id}`, functionName: 'settle', args: [id], title: `Settle question ${id}`, description: 'Copy the Judge verdict into this market. A timely YES is final and pays the YES side. NO or no answer can reopen betting. If Judge is still voting, the simulation will stop before signing.' });
  return <>
    <a className="skip-link" href="#market">Skip to market</a>
    <header className="site-header wrap">
      <a className="brand" href="#market" aria-label="Six market home"><img src="./favicon.svg" alt="" width="32" height="32" /><span>six<span className="brand-secondary"> / market</span></span></a>
      <div className="header-tools"><span className="network-label"><span className="network-dot" />{config.manifest.network.name}</span><button className="wallet-button" disabled={!!wallet.pending} onClick={() => { if (wallet.address && !wallet.isRightChain) void wallet.switchNetwork(); else wallet.setOpen(true); }}>{wallet.pending ? 'Opening wallet…' : wallet.address ? wallet.isRightChain ? shortAddress(wallet.address) : `Switch to ${config.manifest.network.name}` : 'Connect wallet'}</button></div>
    </header>
    <main id="market" className="wrap">
      {!wallet.open && wallet.error && <div className="notice error" role="alert">{wallet.error}<button className="text-button" onClick={() => wallet.setError('')}>Dismiss</button></div>}
      {wallet.address && !wallet.isRightChain && <div className="notice" role="status">Your wallet is on another network. Switch to {config.manifest.network.name} to use this market.</div>}
      <div className="intro"><div><h1>GTA 6 in 2026?</h1><p>Bet ETH on a full release by December 31.</p></div><a className="rules-link" href="#rules">How this market works <span aria-hidden="true">↙</span></a></div>
      <div className="market-grid">
        <section className="trade-panel" aria-labelledby="bet-heading">
          <div className="panel-heading"><h2 id="bet-heading">Take a side</h2><span className={`status ${bettingAllowed ? 'open' : ''}`}><span className="status-dot" aria-hidden="true" />{status}</span></div>
          <dl className="pool-summary"><div><dt>Total staked</dt><dd title={pot === undefined ? '' : formatEther(pot) + ' ETH'}>{eth(pot)} <span>ETH</span></dd></div><div><dt>YES share of pot</dt><dd>{!state ? 'Loading…' : yesPercent === undefined ? 'No odds yet' : `${yesPercent.toFixed(1)}%`}</dd></div></dl>
          <div className={`pool-bar ${yesPercent === undefined ? 'empty' : ''}`} role="img" aria-label={!state ? 'Loading stake totals' : yesPercent === undefined ? 'No stakes in the pool yet' : `YES ${yesPercent.toFixed(1)} percent of stakes, NO ${(100 - yesPercent).toFixed(1)} percent`}><span style={{ width: `${yesPercent ?? 0}%` }} /></div>
          <form onSubmit={reviewBet} noValidate>
            <fieldset className="side-picker"><legend className="sr-only">Choose your prediction</legend>{(['yes', 'no'] as const).map((choice) => <label key={choice} className={`side-option ${choice} ${side === choice ? 'selected' : ''}`}><input type="radio" name="side" value={choice} checked={side === choice} onChange={() => setSide(choice)} /><span><strong>{choice.toUpperCase()}</strong><span>{choice === 'yes' ? 'Released in 2026' : 'No release in 2026'}</span></span><span className="radio-mark" aria-hidden="true" /></label>)}</fieldset>
            <div className="field-heading"><label htmlFor="bet-amount">Stake amount</label><span className="small muted">{own ? `Balance: ${eth(s?.balance)} ETH` : 'Paid in ETH'}</span></div>
            <div className="amount-field"><input id="bet-amount" name="bet-amount" inputMode="decimal" autoComplete="off" placeholder="0.00" value={amount} onChange={(e) => { setAmount(e.target.value); setBetError(''); }} aria-invalid={!!betError} aria-describedby="bet-error payout-hint" /><span>ETH</span></div>
            <div className="amount-shortcuts">{['0.01', '0.05', '0.1'].map((n) => <button type="button" key={n} onClick={() => { setAmount(n); setBetError(''); }}>{n} ETH</button>)}</div>
            <p id="payout-hint" className="small payout">{preview !== undefined ? <>This stake’s return if {side.toUpperCase()} wins now: <strong>{eth(preview)} ETH</strong> total return.</> : 'Pick a side and enter an amount to estimate your return.'}</p>
            <p id="bet-error" className="error-text" role="status">{betError}</p>
            <button className="primary bet-submit" type="submit" disabled={market.busy || (!!wallet.address && (!wallet.isRightChain || !market.ready || !bettingAllowed))}>{label('bet', actionLabel(`Review ${side.toUpperCase()} bet`))}<span aria-hidden="true">↗</span></button>
            {feedback('bet')}
            {market.readError && <p className="small error-text">Live state is unavailable. <button type="button" className="text-button" disabled={market.loading} onClick={() => void market.read()}>Retry market reads</button></p>}
          </form>
          {state && !bettingAllowed && <p className="small notice">{state.pendingQuestions > 0n && !resolved ? `${state.pendingQuestions} question(s) pending. Settle them below to reopen betting, if the window is still open.` : resolved ? `${state.phase === 2 ? 'YES' : 'NO'} won. Check your claim below.` : 'The betting window has ended. Follow resolution below.'}</p>}
          <p className="small muted bet-note">Pooled stakes, changing returns. You can lose your full stake.</p>
          <ul className="risk-list"><li>One wrong YES verdict is final.</li><li>Unlimited asks can produce a false YES.</li><li>Judge, payment-door or pool outages can make NO win.</li></ul>
          <p className="small muted">No price feed is configured; USD values are unavailable.</p>
        </section>

        <aside className="market-detail" aria-label="Market overview">
          <section className="overview"><div className="section-head"><h2>On the clock</h2><span className="small muted">All times UTC</span></div>
            <ol className="timeline"><li><span className="timeline-index">01</span><div><h3>Release &amp; betting cutoff</h3><p>{state ? utc(state.bettingClosesAt) : '31 Dec 2026, 23:59:59 UTC'}</p></div></li><li><span className="timeline-index">02</span><div><h3>Last evidence submission</h3><p>{state ? utc(state.lastAskAt) : '6 Jan 2027, 23:59:59 UTC'}</p></div></li><li><span className="timeline-index">03</span><div><h3>Last counted YES settlement</h3><p>{state ? utc(state.resolutionDeadline) : '7 Jan 2027, 23:59:59 UTC'}</p></div></li></ol>
            <p className="small muted">December 31 counts. A full public release is required; trailers, preorders, betas, demos and leaks do not count.</p>
          </section>
          <section className="state-section"><div className="section-head"><h2>Pool breakdown</h2><button className="text-button" disabled={market.loading} onClick={() => void market.read()}>{market.loading ? 'Refreshing…' : 'Refresh state'}</button></div>
            <dl className="data-list"><div><dt><span className="dot yes-dot" />YES stakes</dt><dd>{eth(state?.yesTotal)} ETH</dd></div><div><dt><span className="dot no-dot" />NO stakes</dt><dd>{eth(state?.noTotal)} ETH</dd></div><div><dt>Paid to claimants</dt><dd>{eth(state?.totalClaimed)} ETH</dd></div><div><dt>Questions / pending</dt><dd>{state ? `${state.questionCount} / ${state.pendingQuestions}` : 'Loading…'}</dd></div>{state?.resolvedYes && <><div><dt>Winning question</dt><dd>{state.winningQuestionId.toString()}</dd></div><div><dt>YES settled</dt><dd>{utc(state.resolvedAt)}</dd></div></>}</dl>
            <details><summary>Exact ETH balances</summary><dl className="data-list"><div><dt>YES total</dt><dd>{eth(state?.yesTotal, true)}</dd></div><div><dt>NO total</dt><dd>{eth(state?.noTotal, true)}</dd></div><div><dt>Paid out</dt><dd>{eth(state?.totalClaimed, true)}</dd></div><div><dt>Wallet balance</dt><dd>{own ? eth(s?.balance, true) : 'Connect wallet'}</dd></div></dl></details>
            <div className="read-status" role="status">{market.readError ? <p className="error-text">{market.readError} <button className="text-button" onClick={() => void market.read()}>Retry reads</button></p> : s ? <p className="small muted">{market.fresh ? 'Read from Ethereum' : 'State is stale; refresh before acting'} · <a href={`${config.manifest.network.explorer}/block/${s.block}`} target="_blank" rel="noreferrer">block {s.block.toString()}</a><br />Updates every 15 seconds.</p> : <p className="small muted">Verifying deployment and loading live state…</p>}</div>
          </section>
        </aside>
      </div>

      <section className="position-section" aria-labelledby="position-heading"><div className="section-head"><h2 id="position-heading">Your position</h2>{wallet.address && <button className="text-button" onClick={() => wallet.setOpen(true)}>Manage wallet</button>}</div>
        <div className="position-grid"><dl className="position-values"><div><dt>YES stake</dt><dd>{own ? eth(s?.yesStake, true) : '…'} <span>ETH</span></dd></div><div><dt>NO stake</dt><dd>{own ? eth(s?.noStake, true) : '…'} <span>ETH</span></dd></div><div><dt>Available to claim</dt><dd>{own ? eth(s?.claimable, true) : '…'} <span>ETH</span></dd></div></dl><button className="secondary" disabled={market.busy || (!!wallet.address && (!wallet.isRightChain || !market.ready || !own || !s?.claimable))} onClick={() => prepare({ id: 'claim', functionName: 'claim', title: 'Claim your ETH', description: `Collect ${eth(s?.claimable, true)} ETH from this market. Both stake balances reset after a successful claim. Network gas is additional.` })}>{label('claim', actionLabel('Review claim'))}</button></div>{feedback('claim')}
        <p className="small muted">{!wallet.address ? 'Connect your wallet to read your stakes and claimable ETH.' : !own ? 'Loading this account’s stakes…' : !resolved ? 'Claims open after a counted YES, or after the final deadline for NO.' : s?.claimable === 0n ? 'This wallet has nothing to claim. It may have no winning stake or may already have claimed.' : 'Your claim is available. Review it before signing.'}</p>
      </section>

      <div className="lower-grid">
        <section className="resolve-section" aria-labelledby="resolve-heading"><h2 id="resolve-heading">Bring the release evidence</h2><p>Anyone can ask Judge. Submit an official Rockstar or Take-Two announcement, or a major news report showing a full release by the cutoff.</p>
          <form onSubmit={reviewResolve} noValidate><label htmlFor="proof">Release evidence</label><textarea id="proof" name="proof" rows={3} value={proof} onChange={(e) => { setProof(e.target.value); setResolveError(''); }} placeholder="https://www.rockstargames.com/…" aria-invalid={!!resolveError} aria-describedby="proof-help resolve-error" /><p id="proof-help" className="small muted">ASCII only, up to 650 bytes. {new TextEncoder().encode(proof).length}/650 bytes.</p><label htmlFor="budget">Maximum question budget (ETH)</label><input id="budget" name="budget" inputMode="decimal" autoComplete="off" value={budget} onChange={(e) => setBudget(e.target.value)} aria-describedby="budget-help resolve-error" /><p id="budget-help" className="small muted">0.002 ETH is a suggested budget, not a live quote. Unused ETH returns immediately; gas is extra. Payment depends on Judge’s ETH door and its IMD pool.</p><p id="resolve-error" className="error-text" role="status">{resolveError}</p><button type="submit" className="secondary" disabled={market.busy || (!!wallet.address && (!wallet.isRightChain || !market.ready || !canResolve))}>{label('resolve', actionLabel('Review evidence submission'))}</button>{feedback('resolve')}{state && !canResolve && <p className="small muted">{state.resolvedYes ? 'YES has already resolved this market.' : 'The evidence submission window has ended.'}</p>}</form>
        </section>
        <section aria-labelledby="questions-heading"><div className="section-head"><h2 id="questions-heading">Judge questions</h2><span className="small muted">{state?.questionCount.toString() ?? '…'} asked</span></div><p>Settling is a separate transaction. Try after about five minutes; a question can take up to a day. A YES must be settled here before the final deadline.</p>
          {market.questionError && <p className="error-text" role="status">{market.questionError}</p>}
          {market.questionLoading ? <p role="status" className="small muted">Loading questions…</p> : !s ? <p className="small muted">Questions appear after live state loads.</p> : market.questions.length === 0 && !market.questionError ? <p className="empty-state">No questions asked yet. Submit release evidence when it is available.</p> : <ul className="question-list">{market.questions.map((q) => <li key={q.id.toString()}><div className="section-head"><h3>Question {q.id.toString()}</h3><span className="small">{['Pending', 'YES', 'NO', 'No answer'][q.verdict] ?? 'Unknown verdict'}</span></div><p className="small muted">Asked {utc(q.askedAt)}</p><a className="address small" href={`${config.manifest.network.explorer}/address/${q.askedBy}`} target="_blank" rel="noreferrer">{q.askedBy}</a>{q.verdict === 0 && <button className="secondary" disabled={market.busy || (!!wallet.address && (!wallet.isRightChain || !market.ready))} onClick={() => reviewSettle(q.id)}>{label(`settle-${q.id}`, actionLabel(`Review settlement ${q.id}`))}</button>}</li>)}</ul>}
          {s && s.ids.length > 8 && <div className="pagination"><button className="secondary" disabled={!market.page} onClick={() => market.setPage(market.page - 1)}>Newer</button><span className="small">Page {market.page + 1} of {Math.ceil(s.ids.length / 8)}</span><button className="secondary" disabled={(market.page + 1) * 8 >= s.ids.length} onClick={() => market.setPage(market.page + 1)}>Older</button></div>}
          {feedback('settle-', true)}<details className="manual-settle"><summary>Settle a specific question</summary><form onSubmit={(e) => { e.preventDefault(); setSettleError(''); if (entryAction()) return; try { if (!/^\d+$/.test(questionId) || !s?.ids.includes(BigInt(questionId))) throw new UserError('Enter an ID from this market’s question list.'); reviewSettle(BigInt(questionId)); } catch (error) { setSettleError(errorMessage(error)); } }}><label htmlFor="question-id">Question ID</label><input id="question-id" name="question-id" inputMode="numeric" value={questionId} onChange={(e) => setQuestionId(e.target.value)} aria-describedby="settle-error" aria-invalid={!!settleError} /><p id="settle-error" className="error-text" role="status">{settleError}</p><button className="secondary" disabled={market.busy || (!!wallet.address && (!wallet.isRightChain || !market.ready))}>{actionLabel('Review settlement')}</button></form></details>
        </section>
      </div>

      <section id="rules" className="rules-section"><h2>The rules, before you bet</h2><div className="rules-grid"><div><h3>A shared pot, no fixed odds</h3><p>Winners receive their winning stake × the full pot ÷ total winning stakes. Later bets change returns. There is no market fee, owner, pause or upgrade.</p><p>If nobody backed the winning side, every bettor reclaims their own stake. Integer rounding can leave a few wei unclaimable.</p></div><div><h3>Only a timely YES decides</h3><p>The first YES settled by January 7, 2027 at 23:59:59 UTC is final. If none counts, NO wins after that second, without a resolution transaction.</p><p>A NO or no-answer verdict only ends that question. Betting reopens if every question is settled and the betting window is still open.</p></div><div><h3>Trust the oracle with care</h3><p>Judge uses AI agents. An incorrect YES can move the entire pot. Anyone can repeatedly ask without a bond; a false YES only has to happen once.</p><p>An outage in Judge, its payment door or the IMD pool can prevent a YES from landing, so NO wins by time even if the game is out. Bet only what you can afford to lose.</p></div></div>
        <details><summary>Read the exact on-chain question</summary><p>{s?.question ?? 'The on-chain question will appear when the RPC read succeeds.'}</p></details>
      </section>
      <section className="deployment-section"><h2>Verify the market</h2><div className="deployment-grid"><AddressView config={config} label={`${config.contract.name} · ${config.manifest.network.name}`} address={config.contract.address} /><div className="deployment-meta"><p className="small muted">Configuration and ABI verified at load. Contract code and RPC chain are checked before actions unlock.</p><a href="./imd-deployment.json" target="_blank" rel="noreferrer">Deployment manifest</a><a href={`./${config.contract.abiPath}`} target="_blank" rel="noreferrer">Implementation ABI</a><details><summary>Source and attestation</summary><p className="small">Source commit <code>{config.manifest.sourceCommit}</code></p><p className="small">Attestation hash <code>{config.manifest.attestationHash}</code></p></details></div></div></section>
    </main>
    <footer className="wrap"><p className="small muted">An independent prediction market. Not affiliated with Rockstar Games or Take-Two Interactive.</p><a href="#market">Back to market ↑</a></footer>

    {wallet.open && <WalletSheet wallet={wallet} config={config} />}
    {market.review && <Dialog title={market.review.title} close={() => market.setReview(undefined)}><p>{market.review.description}</p>{market.review.functionName === 'resolve' && <blockquote className="proof-preview">{String(market.review.args?.[0])}</blockquote>}<dl className="data-list"><div><dt>Network</dt><dd>{config.manifest.network.name}</dd></div><div><dt>ETH sent</dt><dd>{eth(market.review.value ?? 0n, true)} ETH + gas</dd></div><div><dt>Contract action</dt><dd><code>{market.review.functionName}</code></dd></div></dl><p className="small address">From: {wallet.address}</p><p className="small address">To: {config.contract.address}</p><p className="small error-text" role="status">{!market.ready ? !wallet.address ? 'Wallet disconnected. Close this review and connect again.' : !wallet.isRightChain ? 'Your wallet changed networks. Close this review and switch to the configured network.' : 'Waiting for fresh, verified market reads. Close this review to refresh if needed.' : ''}</p><button className="primary" disabled={!market.ready || market.busy} onClick={() => void market.send(market.review!)}>Simulate &amp; confirm in wallet</button><p className="small muted">Simulation checks the current state. You still approve the transaction in your wallet.</p></Dialog>}
  </>;
}
