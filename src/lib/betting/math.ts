/** Binomial coefficient C(n, k) via a multiplicative loop (stable for n ≤ 40). */
export function binomialCoefficient(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  const kk = Math.min(k, n - k);
  let c = 1;
  for (let i = 0; i < kk; i += 1) {
    c = (c * (n - i)) / (i + 1);
  }
  return c;
}

export function binomialPmf(n: number, k: number, p: number): number {
  return binomialCoefficient(n, k) * p ** k * (1 - p) ** (n - k);
}

/** P(X ≥ k) for X ~ Binomial(n, p). */
export function binomialGte(n: number, k: number, p: number): number {
  let total = 0;
  for (let i = k; i <= n; i += 1) {
    total += binomialPmf(n, i, p);
  }
  return total;
}

export const E = Math.exp(1);
export const HARMONIC_6 = 1 + 1 / 2 + 1 / 3 + 1 / 4 + 1 / 5 + 1 / 6;
export const TWO_PAIR_HANDS = 123552;
export const POKER_5_CARD_HANDS = 2_598_960;

export function parseNumericInput(raw: string): number | null {
  const trimmed = raw.trim().replace(/,/g, "");
  if (!trimmed) return null;
  const fraction = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/);
  if (fraction) {
    const num = Number(fraction[1]);
    const den = Number(fraction[2]);
    if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
    return num / den;
  }
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}
