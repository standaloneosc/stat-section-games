export const STARTING_BALANCE = 10_000;
export const MAX_BET = 10_000;
export const MULTIPLIERS = [2, 2.5, 3, 3.5, 4] as const;
export type Multiplier = (typeof MULTIPLIERS)[number];

export function formatMultiplier(multiplier: number): string {
  if (Number.isInteger(multiplier)) return `${multiplier}x`;
  return `${multiplier}x`;
}

export function maxAllowedBet(balance: number): number {
  if (!Number.isFinite(balance) || balance <= 0) return 0;
  return Math.min(MAX_BET, balance);
}

export function clampBet(bet: number, balance: number): number {
  if (!Number.isFinite(bet) || bet < 0) {
    throw new Error("Bet must be a number from 0 up to your balance.");
  }
  const max = maxAllowedBet(balance);
  if (bet > max + 1e-9) {
    throw new Error(`Bet cannot exceed ${max}.`);
  }
  return bet;
}

/**
 * Correct: stake returns with profit (multiplier − 1)×bet.
 * Incorrect: lose the bet. Bet 0 is a no-stake practice lock-in.
 */
export function applyPayout(
  balance: number,
  bet: number,
  multiplier: number,
  correct: boolean
): { nextBalance: number; delta: number } {
  const stake = clampBet(bet, balance);
  if (correct) {
    const nextBalance = balance - stake + stake * multiplier;
    return { nextBalance, delta: stake * (multiplier - 1) };
  }
  return { nextBalance: balance - stake, delta: -stake };
}

export function clampBalance(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value * 100) / 100);
}
