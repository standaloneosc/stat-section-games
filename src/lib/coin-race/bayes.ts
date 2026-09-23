import {
  BIASED_P_HEADS,
  COIN_TYPE_PRIOR_BIASED,
  FAIR_P_HEADS,
  type BayesMode,
  type HiddenCoinType,
} from "./types";

export function sequenceLikelihood(sequence: string, pHeads: number): number {
  let probability = 1;
  for (const face of sequence) {
    probability *= face === "H" ? pHeads : 1 - pHeads;
  }
  return probability;
}

export function coinTypePosterior(
  observed: string,
  options: {
    target?: HiddenCoinType;
    priorBiased?: number;
    fairPHeads?: number;
    biasedPHeads?: number;
  } = {}
): number {
  const target = options.target ?? "B";
  const priorB = options.priorBiased ?? COIN_TYPE_PRIOR_BIASED;
  const priorF = 1 - priorB;
  const pHTGivenF = sequenceLikelihood(observed, options.fairPHeads ?? FAIR_P_HEADS);
  const pHTGivenB = sequenceLikelihood(observed, options.biasedPHeads ?? BIASED_P_HEADS);
  const pObserved = pHTGivenF * priorF + pHTGivenB * priorB;
  if (pObserved <= 0) {
    throw new Error("Observed sequence has probability 0.");
  }
  const pB = (pHTGivenB * priorB) / pObserved;
  return target === "B" ? pB : 1 - pB;
}

export function roundHasBayes(
  mode: BayesMode,
  roundNumber: number,
  roundCount: number
): boolean {
  if (mode === "off") return false;
  if (mode === "everyRound") return true;
  if (mode === "everyThirdRound") return roundNumber % 3 === 0;
  return roundNumber === roundCount;
}

export function pickBayesObservation(roundNumber: number): string {
  const catalog = ["HT", "HH", "TH", "TT", "H", "T"];
  return catalog[(roundNumber - 1) % catalog.length]!;
}
