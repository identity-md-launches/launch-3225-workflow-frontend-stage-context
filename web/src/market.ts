import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createWalletClient, custom, type Address, type Hash } from 'viem';
import { publicClient, type Config } from './config';
import type { Wallet } from './wallet';
import { errorMessage, UserError } from './domain';

export interface MarketState {
  phase: number; bettingOpen: boolean; yesTotal: bigint; noTotal: bigint; totalClaimed: bigint;
  questionCount: bigint; pendingQuestions: bigint; resolvedYes: boolean; resolvedAt: bigint;
  winningQuestionId: bigint; bettingClosesAt: bigint; lastAskAt: bigint; resolutionDeadline: bigint;
}
export interface Question { id: bigint; askedBy: Address; askedAt: bigint; verdict: number }
export interface Snapshot { state: MarketState; question: string; ids: bigint[]; block: bigint; timestamp: bigint; readAt: number; account?: Address; yesStake?: bigint; noStake?: bigint; claimable?: bigint; balance?: bigint }
export interface Transaction { action: string; stage: 'review' | 'simulating' | 'signing' | 'pending' | 'unconfirmed' | 'success' | 'error'; hash?: Hash; message: string }
export type Action = { id: string; functionName: 'betYes' | 'betNo' | 'resolve' | 'settle' | 'claim'; args?: readonly unknown[]; value?: bigint; title: string; description: string };

export function useMarket(config: Config, wallet: Wallet) {
  const client = useMemo(() => publicClient(config, wallet.isRightChain ? wallet.provider : undefined), [config, wallet.provider, wallet.isRightChain]);
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [loading, setLoading] = useState(false);
  const [readError, setReadError] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionError, setQuestionError] = useState('');
  const [questionLoading, setQuestionLoading] = useState(false);
  const [page, setPage] = useState(0);
  const pendingKey = `six-pending-${config.manifest.chainId}-${config.contract.address.toLowerCase()}`;
  const [tx, setTx] = useState<Transaction | undefined>(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(pendingKey) ?? 'null') as Transaction | null;
      if (cached?.hash && /^0x[a-fA-F0-9]{64}$/.test(cached.hash) && /^(bet|claim|resolve|settle-\d+)$/.test(cached.action)) {
        return { action: cached.action, hash: cached.hash, stage: 'unconfirmed', message: 'A transaction from an earlier visit is awaiting confirmation. Check its status before submitting another.' };
      }
    } catch { /* Storage is optional; tracking continues in this page. */ }
    return undefined;
  });
  const [review, setReview] = useState<Action>();
  const [clock, setClock] = useState(Date.now());
  const readGeneration = useRef(0);
  const activeRead = useRef<{ client: typeof client; account?: Address; generation: number; promise: Promise<void> } | undefined>(undefined);
  const txLock = useRef(false);
  const accountRef = useRef(wallet.address);
  accountRef.current = wallet.address;
  useEffect(() => {
    try {
      if (tx?.hash && ['pending', 'unconfirmed'].includes(tx.stage)) localStorage.setItem(pendingKey, JSON.stringify({ action: tx.action, hash: tx.hash }));
      else if (!tx || tx.stage === 'success' || tx.stage === 'error') localStorage.removeItem(pendingKey);
    } catch { /* A blocked storage API does not block wallet signing. */ }
  }, [pendingKey, tx]);
  const read = useCallback((force = false): Promise<void> => {
    if (!force && activeRead.current?.client === client && activeRead.current.account === wallet.address) return activeRead.current.promise;
    const generation = ++readGeneration.current;
    setLoading(true);
    const operation = (async () => {
    try {
      if (await client.getChainId() !== config.manifest.chainId) throw new UserError('The RPC returned the wrong chain. Transactions are disabled.');
      const block = await client.getBlock();
      const code = await client.getCode({ address: config.contract.address, blockNumber: block.number });
      if (!code || code === '0x') throw new UserError('No contract code was found at this deployment. Transactions are disabled.');
      const contract = { address: config.contract.address, abi: config.abi, blockNumber: block.number };
      const [state, question, ids, yesStake, noStake, claimable, balance] = await Promise.all([
        client.readContract({ ...contract, functionName: 'marketState' }),
        client.readContract({ ...contract, functionName: 'QUESTION' }),
        client.readContract({ ...contract, functionName: 'questionIds' }),
        ...(wallet.address ? [
          client.readContract({ ...contract, functionName: 'yesStake', args: [wallet.address] }),
          client.readContract({ ...contract, functionName: 'noStake', args: [wallet.address] }),
          client.readContract({ ...contract, functionName: 'claimable', args: [wallet.address] }),
          client.getBalance({ address: wallet.address, blockNumber: block.number }),
        ] : []),
      ]);
      if (generation !== readGeneration.current || wallet.address !== accountRef.current) return;
      setSnapshot({ state: state as MarketState, question: question as string, ids: ids as bigint[], block: block.number, timestamp: block.timestamp, readAt: Date.now(), account: wallet.address, yesStake: yesStake as bigint | undefined, noStake: noStake as bigint | undefined, claimable: claimable as bigint | undefined, balance: balance as bigint | undefined });
      setReadError('');
    } catch (e) { if (generation === readGeneration.current) setReadError(errorMessage(e)); }
    finally {
      if (generation === readGeneration.current) setLoading(false);
      if (activeRead.current?.generation === generation) activeRead.current = undefined;
    }
    })();
    activeRead.current = { client, account: wallet.address, generation, promise: operation };
    return operation;
  }, [client, config, wallet.address]);
  const latestRead = useRef(read);
  latestRead.current = read;

  useEffect(() => {
    void read();
    const timer = window.setInterval(() => { if (!document.hidden) void read(); }, 15000);
    const focus = () => { void read(); };
    window.addEventListener('focus', focus);
    return () => { readGeneration.current++; clearInterval(timer); window.removeEventListener('focus', focus); };
  }, [read]);
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 5000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    let cancelled = false;
    const ids = snapshot?.ids.slice().reverse().slice(page * 8, (page + 1) * 8) ?? [];
    setQuestionLoading(true); setQuestionError('');
    Promise.all(ids.map(async (id) => {
      const contract = { address: config.contract.address, abi: config.abi, blockNumber: snapshot?.block };
      const [askedBy, askedAt, verdict] = await Promise.all([
        client.readContract({ ...contract, functionName: 'askedBy', args: [id] }),
        client.readContract({ ...contract, functionName: 'askedAt', args: [id] }),
        client.readContract({ ...contract, functionName: 'verdictOf', args: [id] }),
      ]);
      return { id, askedBy: askedBy as Address, askedAt: askedAt as bigint, verdict: Number(verdict) };
    })).then((list) => { if (!cancelled) setQuestions(list); }).catch(() => { if (!cancelled) { setQuestions([]); setQuestionError('Unable to load the questions. Refresh the market to retry.'); } }).finally(() => { if (!cancelled) setQuestionLoading(false); });
    return () => { cancelled = true; };
  }, [snapshot, page, client, config]);
  const wallClock = Math.max(clock, Date.now());
  const fresh = !!snapshot && wallClock - snapshot.readAt < 60000 && !readError;
  const accountReady = !!wallet.address && snapshot?.account === wallet.address;
  const ready = fresh && accountReady && wallet.isRightChain && !wallet.pending;
  const busy = !!tx && ['simulating', 'signing', 'pending', 'unconfirmed'].includes(tx.stage);
  const now = snapshot ? snapshot.timestamp + BigInt(Math.max(0, Math.floor((wallClock - snapshot.readAt) / 1000))) : 0n;

  const send = async (action: Action) => {
    if (txLock.current || busy || !wallet.provider || !wallet.address || !ready) return;
    if (!snapshot || Date.now() - snapshot.readAt >= 60000) {
      setReview(undefined);
      setTx({ action: action.id, stage: 'error', message: 'Market state expired. Refreshing now; review the action again when reads finish.' });
      void latestRead.current(true);
      return;
    }
    txLock.current = true; setReview(undefined);
    setTx({ action: action.id, stage: 'simulating', message: 'Checking the transaction against current chain state…' });
    const account = wallet.address;
    let submittedHash: Hash | undefined;
    let outcomeKnown = false;
    try {
      const actualChain = Number(await wallet.provider.request({ method: 'eth_chainId' }));
      const accounts = await wallet.provider.request({ method: 'eth_accounts' }) as Address[];
      if (actualChain !== config.manifest.chainId || accounts[0]?.toLowerCase() !== account.toLowerCase()) throw new UserError('Your wallet account or network changed. Refresh and review the action again.');
      const { request } = await client.simulateContract({ address: config.contract.address, abi: config.abi, functionName: action.functionName, args: action.args, value: action.value, account });
      if (accountRef.current !== account) throw new UserError('Your wallet account changed. Review the action again.');
      setTx({ action: action.id, stage: 'signing', message: 'Confirm this transaction in your wallet. Network gas is additional.' });
      const signer = createWalletClient({ account, chain: config.chain, transport: custom(wallet.provider) });
      const hash = await signer.writeContract(request);
      submittedHash = hash;
      setTx({ action: action.id, stage: 'pending', hash, message: 'Transaction submitted. Waiting for an Ethereum confirmation…' });
      let finalHash = hash;
      let replaced = false;
      const receipt = await client.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 180000, onReplaced: ({ transaction, reason }) => { finalHash = transaction.hash; submittedHash = finalHash; replaced = reason !== 'repriced'; setTx({ action: action.id, stage: 'pending', hash: finalHash, message: 'Replacement transaction submitted. Waiting for confirmation…' }); } });
      outcomeKnown = true;
      if (replaced) throw new UserError('The transaction was cancelled or replaced with a different action. Check it on the explorer before trying again.');
      if (receipt.status !== 'success') throw new UserError('The transaction reverted on chain. No action completed; network gas was spent.');
      setTx({ action: action.id, stage: 'pending', hash: finalHash, message: 'Confirmed on Ethereum. Refreshing market state before unlocking actions…' });
      await latestRead.current(true);
      setTx({ action: action.id, stage: 'success', hash: finalHash, message: 'Confirmed on Ethereum. Market state refresh finished.' });
    } catch (e) { setTx({ action: action.id, stage: submittedHash && !outcomeKnown ? 'unconfirmed' : 'error', hash: submittedHash, message: submittedHash && !outcomeKnown ? 'Confirmation is not available yet. Check the explorer or check confirmation again. Actions remain locked to prevent duplicate transactions.' : errorMessage(e) }); }
    finally { txLock.current = false; }
  };
  const checkConfirmation = async () => {
    if (!tx?.hash || txLock.current) return;
    txLock.current = true;
    setTx({ ...tx, stage: 'pending', message: 'Checking confirmation again…' });
    let hash = tx.hash;
    let replaced = false;
    try {
      const receipt = await client.waitForTransactionReceipt({ hash, timeout: 30000, onReplaced: ({ transaction, reason }) => { hash = transaction.hash; replaced = reason !== 'repriced'; } });
      await latestRead.current(true);
      setTx({ ...tx, hash, stage: receipt.status === 'success' && !replaced ? 'success' : 'error', message: replaced ? 'Transaction cancelled or replaced. Check the explorer before trying again.' : receipt.status === 'success' ? 'Transaction confirmed. Market state refresh finished.' : 'The transaction reverted on chain. Network gas was spent.' });
    } catch { setTx({ ...tx, hash, stage: 'unconfirmed', message: 'Confirmation is still unavailable. Check the explorer, then check confirmation again.' }); }
    finally { txLock.current = false; }
  };
  return { snapshot, loading, readError, read, fresh, ready, now, questions, questionError, questionLoading, page, setPage, tx, setTx, review, setReview, busy, send, checkConfirmation };
}
export type Market = ReturnType<typeof useMarket>;
