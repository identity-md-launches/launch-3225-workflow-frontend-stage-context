import { useEffect, useRef, useState, type ReactNode } from 'react';
import { getAddress, type Address } from 'viem';
import type { Config } from './config';
import type { Wallet } from './wallet';

export function Dialog({ title, children, close }: { title: string; children: ReactNode; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = ref.current!;
    const trigger = document.activeElement as HTMLElement | null;
    element.showModal();
    return () => { element.close(); trigger?.focus(); };
  }, []);
  return <dialog ref={ref} className="dialog" aria-labelledby="dialog-title" onCancel={(e) => { e.preventDefault(); close(); }} onClick={(e) => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close(); } }}>
    <div className="dialog-head"><h2 id="dialog-title">{title}</h2><button type="button" className="icon-button" onClick={close} aria-label="Close dialog">×</button></div>
    {children}
  </dialog>;
}

export const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
export function AddressView({ address, config, label }: { address: Address; config: Config; label: string }) {
  const [note, setNote] = useState('');
  const copy = async () => {
    try { await navigator.clipboard.writeText(getAddress(address)); setNote('Address copied'); }
    catch { setNote('Copy unavailable. Select the full address above.'); }
  };
  return <div className="address-view"><span className="muted">{label}</span><a className="address" href={`${config.manifest.network.explorer}/address/${address}`} target="_blank" rel="noreferrer">{getAddress(address)}</a><button type="button" className="text-button" onClick={copy}>Copy address</button><span className="small" role="status">{note}</span></div>;
}

const mobileWallets = [
  { id: 'metaMask', name: 'MetaMask', href: (url: string) => `https://link.metamask.io/dapp/${url.replace(/^https?:\/\//, '')}` },
  { id: 'coinbase', name: 'Coinbase Wallet', href: (url: string) => `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(url)}` },
  { id: 'rabby', name: 'Rabby', href: (url: string) => `https://go.rabby.io/mobile/?_cmd=open-dapp&dapp=${encodeURIComponent(url)}` },
  { id: 'phantom', name: 'Phantom', href: (url: string) => `https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(new URL(url).origin)}` },
];

export function WalletSheet({ wallet, config }: { wallet: Wallet; config: Config }) {
  const safeIcon = (icon: string) => /^data:image\/(?:svg\+xml|png|webp|jpeg)[;,]/i.test(icon) || /^https:\/\//.test(icon);
  return <Dialog title={wallet.address ? 'Connected wallet' : 'Connect a wallet'} close={() => wallet.setOpen(false)}>
    {wallet.address ? <>
      <AddressView label="Signing account" address={wallet.address} config={config} />
      <p>{wallet.isRightChain ? `Connected to ${config.manifest.network.name}.` : `Your wallet is on another network. Switch to ${config.manifest.network.name} to act.`}</p>
      {!wallet.isRightChain && <button className="primary" disabled={!!wallet.pending} onClick={() => void wallet.switchNetwork()}>Switch to {config.manifest.network.name}</button>}
      <button className="wallet-row" onClick={() => { wallet.disconnect(); wallet.setOpen(false); }}>Disconnect</button>
    </> : <>
      <p className="muted">Choose where to connect. You review every transaction before signing.</p>
      <div className="wallet-list">
        {wallet.mobile && mobileWallets.map((w) => <a className="wallet-row" key={w.id} href={w.href(location.href)}><img src={`./wallets/${w.id}.svg`} width="28" height="28" alt="" />Open in {w.name}<span aria-hidden="true" className="push">↗</span></a>)}
        {!wallet.mobile && wallet.options.map((w) => <button className="wallet-row" key={w.info.uuid} disabled={!!wallet.pending} onClick={() => void wallet.connect(w.info.uuid)}>
          {safeIcon(w.info.icon) && <img src={w.info.icon} width="28" height="28" alt="" />}<span>{w.info.name}{wallet.pending === w.info.uuid ? ' · opening…' : ''}</span>
        </button>)}
        {!wallet.mobile && wallet.options.length === 0 && <button className="wallet-row" disabled={!!wallet.pending} onClick={() => void wallet.connect('browser')}><svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true"><rect x="2" y="5" width="24" height="18" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M19 12h7v7h-7z" fill="currentColor"/></svg><span>Browser wallet{wallet.pending === 'browser' ? ' · opening…' : ''}</span></button>}
        <button className="wallet-row" disabled={!!wallet.pending} onClick={() => void wallet.connect('coinbase')}><img src="./wallets/coinbase.svg" width="28" height="28" alt="" /><span>Coinbase Smart Wallet{wallet.pending === 'coinbase' ? ' · opening…' : ''}</span></button>
      </div>
      {wallet.mobile && <p className="small muted">Wallet links open this page in the wallet app. If an app is missing, install it first.</p>}
    </>}
    <p className="error-text" role="status">{wallet.error}</p>
  </Dialog>;
}
