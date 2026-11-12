import { createPublicClient, custom, defineChain, fallback, http, isAddress, keccak256, toHex, type Abi, type Address } from 'viem';
import type { Provider } from './wallet';

export interface Deployment {
  version: 1; launchId: string; chainId: number; sourceCommit: string; attestationHash: string;
  contracts: { name: string; address: Address; abiHash: string; abiPath: string }[];
  assets: { path: string; sha256: string }[];
  network: { chainId: number; name: string; testnet: boolean; rpcUrls: string[]; explorer: string; nativeCurrency: { name: string; symbol: string; decimals: number } };
  walletAddChain?: { chainId: string; chainName: string; rpcUrls: string[]; nativeCurrency: { name: string; symbol: string; decimals: number }; blockExplorerUrls: string[] };
}
export const canonical = (v: unknown): unknown => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical((v as Record<string, unknown>)[k])])) : v;
export const hashAbi = (v: unknown) => keccak256(toHex(JSON.stringify(canonical(v)))).slice(2);
export const localUrl = (path: string) => new URL(path, new URL(import.meta.env.BASE_URL, location.href)).href;
const safePath = (path: string) => /^[a-zA-Z0-9_./-]+$/.test(path) && !path.startsWith('/') && !path.split('/').includes('..');

export async function loadDeployment() {
  const response = await fetch(localUrl('imd-deployment.json'), { cache: 'no-store' });
  if (!response.ok) throw Error('Deployment configuration could not be loaded. Reload to try again.');
  const manifest = await response.json() as Deployment;
  const contract = manifest.contracts?.find((c) => c.name === 'GtaSixMarket');
  if (manifest.version !== 1 || !contract || !isAddress(contract.address) || !safePath(contract.abiPath)
      || manifest.chainId !== manifest.network?.chainId || !manifest.network.rpcUrls?.length) throw Error('Deployment configuration is invalid. Transactions are disabled.');
  const abiResponse = await fetch(localUrl(contract.abiPath));
  if (!abiResponse.ok) throw Error('The deployed contract ABI could not be loaded. Reload to retry.');
  const abi = await abiResponse.json() as Abi;
  if (!Array.isArray(abi) || hashAbi(abi) !== contract.abiHash) throw Error('ABI verification failed. Transactions are disabled.');
  const chain = defineChain({
    id: manifest.chainId, name: manifest.network.name, nativeCurrency: manifest.network.nativeCurrency,
    rpcUrls: { default: { http: manifest.network.rpcUrls } },
    blockExplorers: { default: { name: 'Explorer', url: manifest.network.explorer } }, testnet: manifest.network.testnet,
  });
  return { manifest, contract, abi: abi as Abi, chain };
}
export type Config = Awaited<ReturnType<typeof loadDeployment>>;
export function publicClient(config: Config, provider?: Provider) {
  const transports = config.manifest.network.rpcUrls.map((url) => http(url, { timeout: 8000, retryCount: 0 }));
  return createPublicClient({ chain: config.chain, batch: { multicall: false }, transport: fallback([
    ...transports, ...(provider ? [custom(provider, { retryCount: 0 })] : []),
  ], { retryCount: 0 }) });
}
