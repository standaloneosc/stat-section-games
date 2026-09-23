import { FAIR_P_HEADS, type Face, type PatternChoice } from "./types";

const FACES: Face[] = ["H", "T"];

export function isPattern(value: string): boolean {
  return value.length > 0 && /^[HT]+$/.test(value);
}

export function longestRelevantSuffix(sequence: string, patternA: string, patternB: string): string {
  for (let n = sequence.length; n >= 0; n -= 1) {
    const suffix = sequence.slice(sequence.length - n);
    if (patternA.startsWith(suffix) || patternB.startsWith(suffix)) {
      return suffix;
    }
  }
  return "";
}

export function stepState(
  state: string,
  flip: Face,
  patternA: string,
  patternB: string
): "A" | "B" | string {
  const next = state + flip;
  const hitsA = next.endsWith(patternA);
  const hitsB = next.endsWith(patternB);
  if (hitsA && hitsB) {
    throw new Error("Patterns completed on the same flip; choose distinct patterns of equal length.");
  }
  if (hitsA) return "A";
  if (hitsB) return "B";
  return longestRelevantSuffix(next, patternA, patternB);
}

function collectStates(patternA: string, patternB: string, suffix: string): string[] {
  const states = new Set<string>([""]);
  for (let i = 1; i < patternA.length; i += 1) {
    states.add(patternA.slice(0, i));
  }
  for (let i = 1; i < patternB.length; i += 1) {
    states.add(patternB.slice(0, i));
  }
  states.add(longestRelevantSuffix(suffix, patternA, patternB));
  return [...states];
}

function solveLinear(matrix: number[][], rhs: number[]): number[] {
  const n = rhs.length;
  const a = matrix.map((row, i) => [...row, rhs[i]]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) {
        pivot = row;
      }
    }
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const diag = a[col][col];
    if (Math.abs(diag) < 1e-12) {
      throw new Error("Pattern race linear system is singular");
    }
    for (let j = col; j <= n; j += 1) {
      a[col][j] /= diag;
    }
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = a[row][col];
      for (let j = col; j <= n; j += 1) {
        a[row][j] -= factor * a[col][j];
      }
    }
  }
  return a.map((row) => row[n]);
}

export function patternWinProbabilities(
  patternA: string,
  patternB: string,
  options: { pHeads?: number; suffix?: string } = {}
): { pA: number; pB: number; startState: string } {
  if (!isPattern(patternA) || !isPattern(patternB)) {
    throw new Error("Patterns must be strings of H and T.");
  }
  if (patternA.length !== patternB.length) {
    throw new Error("Patterns must be the same length.");
  }
  if (patternA === patternB) {
    throw new Error("Patterns must be different.");
  }
  const pHeads = options.pHeads ?? FAIR_P_HEADS;
  const suffix = options.suffix ?? "";
  const startState = longestRelevantSuffix(suffix, patternA, patternB);
  if (startState.endsWith(patternA) || startState.endsWith(patternB)) {
    throw new Error("Starting suffix already completes a pattern.");
  }

  const states = collectStates(patternA, patternB, startState);
  const index = new Map(states.map((state, i) => [state, i]));
  const n = states.length;
  const matrix = Array.from({ length: n }, (_, i) => {
    const row = Array.from({ length: n }, () => 0);
    row[i] = 1;
    return row;
  });
  const rhs = Array.from({ length: n }, () => 0);

  for (let i = 0; i < n; i += 1) {
    const state = states[i];
    for (const flip of FACES) {
      const p = flip === "H" ? pHeads : 1 - pHeads;
      const next = stepState(state, flip, patternA, patternB);
      if (next === "A") {
        rhs[i] += p;
      } else if (next === "B") {
        // contributes 0 toward P(A wins)
      } else {
        const j = index.get(next);
        if (j === undefined) {
          throw new Error(`Unknown suffix state ${next}`);
        }
        matrix[i][j] -= p;
      }
    }
  }

  const values = solveLinear(matrix, rhs);
  const startIndex = index.get(startState);
  if (startIndex === undefined) {
    throw new Error("Start suffix is not a tracked state");
  }
  const pA = values[startIndex];
  return { pA, pB: 1 - pA, startState };
}

export function simulateRace(
  patternA: string,
  patternB: string,
  options: { suffix?: string; pHeads?: number; rng?: () => number; maxFlips?: number } = {}
): { winner: PatternChoice; flips: Face[]; sequence: string } {
  const pHeads = options.pHeads ?? FAIR_P_HEADS;
  const rng = options.rng ?? Math.random;
  const maxFlips = options.maxFlips ?? 10_000;
  let state = longestRelevantSuffix(options.suffix ?? "", patternA, patternB);
  const flips: Face[] = [];
  let sequence = state;
  for (let i = 0; i < maxFlips; i += 1) {
    const flip: Face = rng() < pHeads ? "H" : "T";
    flips.push(flip);
    const next = stepState(state, flip, patternA, patternB);
    sequence += flip;
    if (next === "A" || next === "B") {
      return { winner: next, flips, sequence };
    }
    state = next;
  }
  throw new Error("Coin race did not finish.");
}

export function allPatternsOfLength(length: 2 | 3): string[] {
  if (length === 2) {
    return ["HH", "HT", "TH", "TT"];
  }
  return ["HHH", "HHT", "HTH", "HTT", "THH", "THT", "TTH", "TTT"];
}

export type SampledRound = {
  patternA: string;
  patternB: string;
  suffix: string;
};

function pickIndex(rng: () => number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(count - 1, Math.floor(rng() * count));
}

function pickDistinctPair(length: 2 | 3, rng: () => number): { patternA: string; patternB: string } {
  const patterns = allPatternsOfLength(length);
  const i = pickIndex(rng, patterns.length);
  let j = pickIndex(rng, patterns.length - 1);
  if (j >= i) j += 1;
  return { patternA: patterns[i]!, patternB: patterns[j]! };
}

/** True if this start is usable: both patterns still have a chance. */
export function roundIsPlayable(patternA: string, patternB: string, suffix: string): boolean {
  try {
    const { pA, pB } = patternWinProbabilities(patternA, patternB, { suffix });
    return pA > 1e-9 && pB > 1e-9;
  } catch {
    return false;
  }
}

/**
 * Sample a classroom round:
 * - length 2 or 3 (about one third are two-letter pairs);
 * - empty suffix, or a single random first flip H/T.
 * Rejects starts that already finish a pattern or make one side impossible.
 */
export function sampleRound(rng: () => number = Math.random): SampledRound {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const length: 2 | 3 = rng() < 1 / 3 ? 2 : 3;
    const { patternA, patternB } = pickDistinctPair(length, rng);
    const suffix = rng() < 0.5 ? "" : rng() < 0.5 ? "H" : "T";
    if (roundIsPlayable(patternA, patternB, suffix)) {
      return { patternA, patternB, suffix };
    }
  }
  return { patternA: "HHT", patternB: "THT", suffix: "" };
}

/** @deprecated Use sampleRound. Kept as documented examples. */
export const DEFAULT_PATTERN_PAIRS: SampledRound[] = [
  { patternA: "HHT", patternB: "THT", suffix: "" },
  { patternA: "HHT", patternB: "THT", suffix: "H" },
  { patternA: "HT", patternB: "TH", suffix: "" },
];

export function pickPatternPair(roundNumber: number): SampledRound {
  return DEFAULT_PATTERN_PAIRS[(roundNumber - 1) % DEFAULT_PATTERN_PAIRS.length]!;
}
