import { binomialGte, E, HARMONIC_6, POKER_5_CARD_HANDS, TWO_PAIR_HANDS } from "./math";
import { formatMultiplier, type Multiplier } from "./payout";

export const DISTRIBUTION_FAMILIES = [
  "bernoulli",
  "binomial",
  "geometric",
  "poisson",
  "hypergeometric",
  "uniform-discrete",
  "normal",
  "exponential",
] as const;

export type DistributionFamily = (typeof DISTRIBUTION_FAMILIES)[number];

export type ParamKind = "number" | "n-or-number";

export type ParamField = {
  key: string;
  label: string;
  kind: ParamKind;
};

export const FAMILY_FIELDS: Record<DistributionFamily, ParamField[]> = {
  bernoulli: [{ key: "p", label: "p (success probability)", kind: "number" }],
  binomial: [
    { key: "n", label: "n (trials)", kind: "n-or-number" },
    { key: "p", label: "p (success probability)", kind: "number" },
  ],
  geometric: [{ key: "p", label: "p (success probability, trials until first success)", kind: "number" }],
  poisson: [{ key: "lambda", label: "λ (rate)", kind: "number" }],
  hypergeometric: [
    { key: "N", label: "N (population)", kind: "number" },
    { key: "K", label: "K (success states in the population)", kind: "number" },
    { key: "n", label: "n (draws)", kind: "number" },
  ],
  "uniform-discrete": [
    { key: "a", label: "a (low, inclusive)", kind: "number" },
    { key: "b", label: "b (high, inclusive)", kind: "number" },
  ],
  normal: [
    { key: "mu", label: "μ (mean)", kind: "number" },
    { key: "sigma", label: "σ (standard deviation)", kind: "number" },
  ],
  exponential: [{ key: "lambda", label: "λ (rate)", kind: "number" }],
};

export const FAMILY_LABELS: Record<DistributionFamily, string> = {
  bernoulli: "Bernoulli",
  binomial: "Binomial",
  geometric: "Geometric",
  poisson: "Poisson",
  hypergeometric: "Hypergeometric",
  "uniform-discrete": "Uniform (discrete)",
  normal: "Normal",
  exponential: "Exponential",
};

export type ParamValue = number | "n";

export type DistributionAnswer = {
  family: DistributionFamily;
  params: Record<string, ParamValue>;
};

export type NumericKey = {
  value: number;
  /** Extra accepted values (interview rounding, fractions already covered by parse). */
  alsoAccept?: number[];
};

export type Question = {
  id: number;
  multiplier: Multiplier;
  prompt: string;
  kind: "number" | "distribution";
  numeric?: NumericKey;
  distribution?: DistributionAnswer;
};

/** P(at least five 6s in 30 fair d6 rolls). */
export const BINOM_30_SIXES_GTE_5 = binomialGte(30, 5, 1 / 6);

export const QUESTIONS: Question[] = [
  {
    id: 1,
    multiplier: 2.5,
    prompt:
      "You and I play a game, we each have ½ chance of winning, the first person to win 4 games wins, what is the probability that the winner is decided in exactly 7 total games?",
    kind: "number",
    numeric: { value: 5 / 16, alsoAccept: [0.3125, 0.313, 0.312] },
  },
  {
    id: 2,
    multiplier: 3,
    prompt:
      "Regular deck of cards but with only 20 of them: 10s, Js, Qs, Ks, Aces. You decide to flip them over one by one until you see any Queen. It appears in the 5th position. What’s the probability that the Ace of Spades is in the 6th position?",
    kind: "number",
    numeric: { value: 1 / 20, alsoAccept: [0.05] },
  },
  {
    id: 3,
    multiplier: 2.5,
    prompt:
      "6 people are standing in a line, they chose their spots uniformly at random, they all have distinct heights, what is the expected number of people that can see to the front of the line (a person who is taller than you blocks your line of vision)",
    kind: "number",
    numeric: { value: HARMONIC_6, alsoAccept: [2.45, 49 / 20] },
  },
  {
    id: 4,
    multiplier: 3.5,
    prompt:
      "If you do uniform draws from (0,1), what is the expected number of draws until you draw something that is not the maximum so far? Round to three decimal places.",
    kind: "number",
    numeric: { value: E, alsoAccept: [2.718] },
  },
  {
    id: 5,
    multiplier: 2,
    prompt: "What is the expected number of dice rolls of a d6 until I’ve seen all 6 faces?",
    kind: "number",
    numeric: { value: 6 * HARMONIC_6, alsoAccept: [14.7] },
  },
  {
    id: 6,
    multiplier: 3,
    prompt:
      "There are 32 teams in a traditional single elimination knockout tournament, all skill levels are distinct and the more skilled player always wins against a less skilled player, what is the probability that the first and second most skilled players meet in the finals?",
    kind: "number",
    numeric: { value: 16 / 31, alsoAccept: [0.516] },
  },
  {
    id: 7,
    multiplier: 2.5,
    prompt: "You roll 30 dice, what is the probability that at least 5 of these are 6?",
    kind: "number",
    numeric: { value: BINOM_30_SIXES_GTE_5 },
  },
  {
    id: 8,
    multiplier: 3,
    prompt:
      "Let X ∼ Poisson(λ), find E[2^X], plug in 1 and round to 3 decimal places for your answer",
    kind: "number",
    numeric: { value: E, alsoAccept: [2.718] },
  },
  {
    id: 9,
    multiplier: 3,
    prompt:
      "Imagine a group of n friends who decide to hold a Secret Santa gift exchange. Everyone writes their own name on a slip of paper and drops it into a bowl. The bowl is mixed up, and each person takes turns drawing one random name from the bowl. What is the probability that at least one person draws their own name? 3 decimals",
    kind: "number",
    numeric: { value: 1 - 1 / E, alsoAccept: [0.632] },
  },
  {
    id: 10,
    multiplier: 3,
    prompt:
      "What is the probability of getting dealt a two pair in a 5 card hand in poker? A two pair is, well, two pairs. E.g 22445, AAJJK, etc. Round to 3 decimals.",
    kind: "number",
    numeric: {
      value: TWO_PAIR_HANDS / POKER_5_CARD_HANDS,
      alsoAccept: [0.048, 0.0475, TWO_PAIR_HANDS / POKER_5_CARD_HANDS],
    },
  },
  {
    id: 11,
    multiplier: 2,
    prompt:
      "A warehouse has 20 laptops, 7 of which are defective. An inspector randomly selects 5 laptops without replacement. Let X be the number of defective laptops selected. What is the distribution of X?",
    kind: "distribution",
    distribution: { family: "hypergeometric", params: { N: 20, K: 7, n: 5 } },
  },
  {
    id: 12,
    multiplier: 3.5,
    prompt:
      "You and I are playing a game, you win if you get HHT before I get HTT, what is the probability you win the game?",
    kind: "number",
    numeric: { value: 2 / 3, alsoAccept: [0.667, 0.666] },
  },
  {
    id: 13,
    multiplier: 4,
    prompt:
      "A jar holds 10 red, 20 blue and 30 green candies drawn one at a time at random. What is the probability at least one blue and one green remain when the last red is drawn?",
    kind: "number",
    numeric: { value: 7 / 12, alsoAccept: [0.583] },
  },
  {
    id: 14,
    multiplier: 3,
    prompt:
      "If X ∼ Pois(1), Y ∼ Pois(2), and X is independent of Y, then the conditional distribution of X given X+Y = n",
    kind: "distribution",
    distribution: { family: "binomial", params: { n: "n", p: 1 / 3 } },
  },
  {
    id: 15,
    multiplier: 4,
    prompt:
      "there are 6 carts in lane 1 and 7 carts in lane 2. in any given time a customer chooses a cart from random lane and returns the cart in random lane. expected number of customers until a lane is empty?",
    kind: "number",
    numeric: { value: 84 },
  },
];

export function getQuestion(id: number): Question {
  const question = QUESTIONS.find((item) => item.id === id);
  if (!question) {
    throw new Error(`Unknown question ${id}`);
  }
  return question;
}

export type PublicQuestionInfo = {
  id: number;
  multiplier: Multiplier;
  multiplierLabel: string;
  prompt: string;
  kind: Question["kind"];
};

export function toPublicQuestion(question: Question): PublicQuestionInfo {
  return {
    id: question.id,
    multiplier: question.multiplier,
    multiplierLabel: formatMultiplier(question.multiplier),
    prompt: question.prompt,
    kind: question.kind,
  };
}

export function publicQuestionCatalog(): PublicQuestionInfo[] {
  return QUESTIONS.map(toPublicQuestion);
}

export function formatAnswerKey(question: Question): string {
  if (question.kind === "distribution" && question.distribution) {
    const { family, params } = question.distribution;
    const body = Object.entries(params)
      .map(([key, value]) => `${key}=${value}`)
      .join(", ");
    return `${FAMILY_LABELS[family]}(${body})`;
  }
  const value = question.numeric?.value ?? NaN;
  if (question.id === 1) return "5/16 = 0.3125";
  if (question.id === 2) return "1/20 = 0.05";
  if (question.id === 3) return "H₆ = 49/20 = 2.45";
  if (question.id === 4 || question.id === 8) return "e ≈ 2.718";
  if (question.id === 5) return "6 H₆ = 14.7";
  if (question.id === 6) return "16/31 ≈ 0.516";
  if (question.id === 9) return "1 − 1/e ≈ 0.632";
  if (question.id === 10) return "123552 / 2598960 ≈ 0.048";
  if (question.id === 12) return "2/3 ≈ 0.667";
  if (question.id === 13) return "7/12 ≈ 0.583";
  if (question.id === 15) return "84";
  if (question.id === 7) return `${value.toFixed(6)}`;
  return String(value);
}
