import { useCallback, useEffect, useRef, useState } from 'react';
import { getAddress, type Address, type EIP1193Provider } from 'viem';
import type { Config } from './config';
import { errorMessage, UserError } from './domain';

export type Provider = EIP1193Provider & { on?: (event: string, callback: (...args: unknown[]) => void) => void; removeListener?: (event: string, callback: (...args: unknown[]) => void) => void; disconnect?: () => Promise<void> };
export interface WalletOption { info: { uuid: string; name: string; icon: string; rdns: string }; provider: Provider }
declare global { interface Window { ethereum?: Provider } }
const storageKey = 'gta-six-wallet';
const remember = (id: string | null) => { try { if (id) localStorage.setItem(storageKey, id); else localStorage.removeItem(storageKey); } catch { /* Storage is optional. */ } };
const remembered = () => { try { return localStorage.getItem(storageKey); } catch { return null; } };

export async function switchChain(provider: Provider, config: Config) {
  const chainId = `0x${config.manifest.chainId.toString(16)}`;
  try { await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId }] }); }
  catch (error) {
    const e = error as { code?: number; message?: string; data?: { originalError?: { code?: number } } };
    if ((e.code === 4902 || e.data?.originalError?.code === 4902 || /unknown chain|unrecognized chain|not added/i.test(e.message ?? '')) && config.manifest.walletAddChain) {
      await provider.request({ method: 'wallet_addEthereumChain', params: [config.manifest.walletAddChain] });
      await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId }] });
    } else throw error;
  }
}

export function useWallet(config: Config) {
  const [options, setOptions] = useState<WalletOption[]>([]);
  const [provider, setProvider] = useState<Provider>();
  const [address, setAddress] = useState<Address>();
  const [chainId, setChainId] = useState<number>();
  const [pending, setPending] = useState<string>();
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const reconnecting = useRef(false);
  const epoch = useRef(0);
  const isRightChain = chainId === config.manifest.chainId;
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && !window.ethereum && options.length === 0;

  useEffect(() => {
    const announced = (event: Event) => {
      const option = (event as CustomEvent<WalletOption>).detail;
      if (!option?.provider?.request || !option.info?.uuid || !option.info.name) return;
      setOptions((prior) => prior.some((w) => w.info.uuid === option.info.uuid) ? prior : [...prior, option]);
    };
    window.addEventListener('eip6963:announceProvider', announced);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    return () => window.removeEventListener('eip6963:announceProvider', announced);
  }, []);

  const connect = useCallback(async (id: string, silent = false) => {
    if (pending) return;
    const currentEpoch = ++epoch.current;
    setPending(id); setError('');
    try {
      const option = options.find((w) => w.info.uuid === id || `rdns:${w.info.rdns}` === id);
      let selected = option?.provider;
      if (id === 'browser') selected = window.ethereum;
      if (id === 'coinbase') {
        const { createCoinbaseWalletSDK } = await import('@coinbase/wallet-sdk');
        selected = createCoinbaseWalletSDK({ appName: 'GTA 6 in 2026?', appLogoUrl: new URL('./favicon.svg', location.href).href, appChainIds: [config.manifest.chainId], preference: { options: 'smartWalletOnly' } }).getProvider() as Provider;
      }
      if (!selected) throw new UserError('No browser wallet found. Install a wallet extension, or open this page inside a mobile wallet.');
      const accounts = await selected.request({ method: silent ? 'eth_accounts' : 'eth_requestAccounts' }) as Address[];
      if (currentEpoch !== epoch.current) return;
      if (!accounts.length) { if (!silent) throw new UserError('Your wallet returned no account. Unlock it and try again.'); return; }
      const chain = await selected.request({ method: 'eth_chainId' });
      if (currentEpoch !== epoch.current) return;
      setProvider(selected); setAddress(getAddress(accounts[0])); setChainId(Number(chain)); remember(option?.info.rdns ? `rdns:${option.info.rdns}` : id); setOpen(false);
      if (!silent && Number(chain) !== config.manifest.chainId) {
        try { await switchChain(selected, config); setChainId(Number(await selected.request({ method: 'eth_chainId' }))); }
        catch (e) { setError(errorMessage(e)); }
      }
    } catch (e) { if (currentEpoch === epoch.current) setError(errorMessage(e)); }
    finally { if (currentEpoch === epoch.current) setPending(undefined); }
  }, [config, options, pending]);

  useEffect(() => {
    const id = remembered();
    if (id && !reconnecting.current && (id === 'browser' && window.ethereum || id === 'coinbase' || options.some((o) => o.info.uuid === id || `rdns:${o.info.rdns}` === id))) {
      reconnecting.current = true; void connect(id, true);
    }
  }, [options, connect]);

  useEffect(() => {
    if (!provider) return;
    const accountsChanged = (...args: unknown[]) => { const accounts = args[0] as Address[]; setAddress(accounts[0] ? getAddress(accounts[0]) : undefined); if (!accounts[0]) { remember(null); setProvider(undefined); } };
    const chainChanged = (...args: unknown[]) => { setChainId(Number(args[0])); setError(''); };
    const disconnected = () => { setAddress(undefined); setProvider(undefined); setChainId(undefined); remember(null); };
    provider.on?.('accountsChanged', accountsChanged); provider.on?.('chainChanged', chainChanged); provider.on?.('disconnect', disconnected);
    return () => { provider.removeListener?.('accountsChanged', accountsChanged); provider.removeListener?.('chainChanged', chainChanged); provider.removeListener?.('disconnect', disconnected); };
  }, [provider]);

  const disconnect = () => { epoch.current++; setPending(undefined); setAddress(undefined); setChainId(undefined); setProvider(undefined); setError(''); remember(null); };
  const switchNetwork = async () => {
    if (!provider || pending) return;
    setPending('switch'); setError('');
    try { await switchChain(provider, config); setChainId(Number(await provider.request({ method: 'eth_chainId' }))); }
    catch (e) { setError(errorMessage(e)); }
    finally { setPending(undefined); }
  };
  return { options, provider, address, chainId, pending, error, setError, open, setOpen, mobile, isRightChain, connect, disconnect, switchNetwork };
}
export type Wallet = ReturnType<typeof useWallet>;
