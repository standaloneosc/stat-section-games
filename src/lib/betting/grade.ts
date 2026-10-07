import { parseNumericInput } from "./math";
import {
  FAMILY_FIELDS,
  getQuestion,
  type DistributionAnswer,
  type DistributionFamily,
  type ParamValue,
  type Question,
} from "./questions";

export type PlayerAnswer = {
  numericText?: string;
  family?: DistributionFamily | "";
  params?: Record<string, string>;
};

function almostEqual(a: number, b: number, absTol: number): boolean {
  return Math.abs(a - b) <= absTol;
}

function matchesNumeric(guess: number, truth: number, extras: number[]): boolean {
  const candidates = [truth, ...extras];
  for (const target of candidates) {
    if (almostEqual(guess, target, 1e-9)) return true;
    if (almostEqual(guess, target, 0.0005)) return true;
    const g3 = Math.round(guess * 1000) / 1000;
    const t3 = Math.round(target * 1000) / 1000;
    if (almostEqual(g3, t3, 1e-9)) return true;
    const scale = Math.max(1, Math.abs(target));
    if (almostEqual(guess, target, 0.001 * scale) && Math.abs(target) >= 1) return true;
  }
  return false;
}

function parseParamValue(raw: string, kind: "number" | "n-or-number"): ParamValue | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (kind === "n-or-number") {
    const symbolic = trimmed.toLowerCase();
    if (symbolic === "n" || symbolic === "given n" || symbolic === "the given n") {
      return "n";
    }
  }
  return parseNumericInput(trimmed);
}

function paramMatches(guess: ParamValue, truth: ParamValue): boolean {
  if (guess === "n" || truth === "n") {
    return guess === truth;
  }
  const absTol = Number.isInteger(truth) ? 1e-6 : 0.0005;
  if (almostEqual(guess, truth, absTol)) return true;
  const g3 = Math.round(guess * 1000) / 1000;
  const t3 = Math.round(truth * 1000) / 1000;
  return almostEqual(g3, t3, 1e-9);
}

export function gradeDistribution(
  guess: DistributionAnswer,
  truth: DistributionAnswer
): boolean {
  if (guess.family !== truth.family) return false;
  const fields = FAMILY_FIELDS[truth.family];
  for (const field of fields) {
    const expected = truth.params[field.key];
    const actual = guess.params[field.key];
    if (expected === undefined || actual === undefined) return false;
    if (!paramMatches(actual, expected)) return false;
  }
  return true;
}

export function parsePlayerAnswer(question: Question, input: PlayerAnswer): {
  ok: boolean;
  numeric?: number;
  distribution?: DistributionAnswer;
} {
  if (question.kind === "number") {
    const numeric = parseNumericInput(input.numericText ?? "");
    if (numeric === null) return { ok: false };
    return { ok: true, numeric };
  }
  const family = input.family;
  if (!family) return { ok: false };
  const fields = FAMILY_FIELDS[family];
  const params: Record<string, ParamValue> = {};
  for (const field of fields) {
    const parsed = parseParamValue(input.params?.[field.key] ?? "", field.kind);
    if (parsed === null) return { ok: false };
    params[field.key] = parsed;
  }
  return { ok: true, distribution: { family, params } };
}

export function isAnswerCorrect(question: Question, input: PlayerAnswer): boolean {
  const parsed = parsePlayerAnswer(question, input);
  if (!parsed.ok) return false;
  if (question.kind === "number" && question.numeric && parsed.numeric !== undefined) {
    return matchesNumeric(parsed.numeric, question.numeric.value, question.numeric.alsoAccept ?? []);
  }
  if (question.kind === "distribution" && question.distribution && parsed.distribution) {
    return gradeDistribution(parsed.distribution, question.distribution);
  }
  return false;
}

export function gradeQuestion(questionId: number, input: PlayerAnswer): boolean {
  return isAnswerCorrect(getQuestion(questionId), input);
}
