import { BaseError, ContractFunctionRevertedError, formatEther, parseEther } from 'viem';

export class UserError extends Error {}

export function eth(value: bigint | undefined, full = false) {
  if (value === undefined) return '…';
  const exact = formatEther(value);
  if (full || !exact.includes('.')) return exact;
  const [whole, decimals] = exact.split('.');
  const short = decimals.slice(0, 6).replace(/0+$/, '');
  if (!short && value > 0n && whole === '0') return '<0.000001';
  return whole + (short ? '.' + short : '');
}
export function amountWei(value: string): bigint {
  if (!/^(?:\d+)(?:\.\d{1,18})?$/.test(value.trim())) throw new UserError('Enter an ETH amount with up to 18 decimal places.');
  const amount = parseEther(value.trim());
  if (amount <= 0n) throw new UserError('Enter an ETH amount greater than zero.');
  if (amount >= 2n ** 256n) throw new UserError('This ETH amount is too large.');
  return amount;
}
export function validateProof(value: string) {
  if (!value.trim()) throw new UserError('Add a link to release evidence.');
  if (!/^[\x20-\x7e\n\r\t]+$/.test(value) || new TextEncoder().encode(value).length > 650) throw new UserError('Use ASCII evidence, at most 650 bytes.');
  if (!/https?:\/\//i.test(value)) throw new UserError('Include an https:// or http:// link to the release evidence.');
  return value;
}
export function indicativePayout(stake: bigint, selectedTotal: bigint, pot: bigint) {
  return stake === 0n ? 0n : stake * (pot + stake) / (selectedTotal + stake);
}
export const utc = (seconds: bigint) => new Date(Number(seconds) * 1000).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'UTC' }) + ' UTC';
const friendly: Record<string, string> = {
  ZeroBet: 'Enter an ETH amount greater than zero.', BettingClosed: 'Betting has closed or is suspended. Refresh the market state.',
  AlreadyResolved: 'YES has already won. Refresh to see the result.', ResolutionWindowOver: 'The deadline for submitting evidence has passed.',
  NotOverYet: 'The market has no winner yet. Come back after resolution.', NothingToClaim: 'This wallet has no ETH to claim.',
  DirectDepositRefused: 'Use a bet control to send ETH to this market.',
};
export function errorMessage(error: unknown): string {
  if (error instanceof UserError) return error.message;
  const e = error as { code?: number; message?: string; shortMessage?: string; cause?: unknown };
  if (e?.code === 4001 || /user rejected|user denied|rejected the request/i.test(e?.message ?? '')) return 'Request declined in your wallet. You can try again.';
  if (/insufficient funds|exceeds the balance/i.test(e?.message ?? '')) return 'Not enough ETH. Leave ETH in your wallet to pay network gas.';
  if (error instanceof BaseError) {
    const revert = error.walk((x) => x instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError;
    if (revert instanceof ContractFunctionRevertedError) {
      const name = revert.data?.errorName;
      if (name && friendly[name]) return friendly[name];
      const reason = revert.reason ?? '';
      if (/still voting/i.test(reason)) return 'Judge is still voting. Wait a few minutes, then try settling again.';
      if (/not an open question/i.test(reason)) return 'That question is not pending in this market. Refresh the question list.';
      if (reason) return `Contract declined: ${reason}. Refresh and check the inputs before retrying.`;
    }
  }
  if (e?.cause && e.cause !== error) {
    const nested = errorMessage(e.cause);
    if (!nested.startsWith('Unable to')) return nested;
  }
  if (error instanceof Error && !('shortMessage' in error) && error.message.length < 200 && !/fetch|network|http|rpc/i.test(error.message)) return error.message;
  return 'Unable to complete this request. Check your network, refresh the market and try again.';
}
