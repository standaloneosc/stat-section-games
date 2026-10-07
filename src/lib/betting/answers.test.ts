import { describe, expect, it } from "vitest";
import { patternWinProbabilities } from "@/lib/coin-race/patterns";
import { gradeQuestion } from "./grade";
import { binomialGte, E, HARMONIC_6 } from "./math";
import { BINOM_30_SIXES_GTE_5, QUESTIONS } from "./questions";

describe("Oscar’s question keys", () => {
  it("keeps a visible multiplier on every catalog question", () => {
    expect(QUESTIONS).toHaveLength(15);
    for (const question of QUESTIONS) {
      expect([2, 2.5, 3, 3.5, 4]).toContain(question.multiplier);
      expect(question.prompt.length).toBeGreaterThan(10);
    }
  });

  it("accepts 5/16 and 0.313 for the first-to-4 in exactly 7 games", () => {
    expect(gradeQuestion(1, { numericText: "5/16" })).toBe(true);
    expect(gradeQuestion(1, { numericText: "0.3125" })).toBe(true);
    expect(gradeQuestion(1, { numericText: "0.313" })).toBe(true);
    expect(gradeQuestion(1, { numericText: "0.5" })).toBe(false);
  });

  it("gives harmonic H6 = 2.45 for the line-of-sight expectation", () => {
    expect(HARMONIC_6).toBeCloseTo(2.45, 10);
    expect(gradeQuestion(3, { numericText: "2.45" })).toBe(true);
    expect(gradeQuestion(3, { numericText: "49/20" })).toBe(true);
  });

  it("uses e ≈ 2.718 for the record-breaking wait and for E[2^X] at λ=1", () => {
    expect(E).toBeCloseTo(2.718, 3);
    expect(gradeQuestion(4, { numericText: "2.718" })).toBe(true);
    expect(gradeQuestion(8, { numericText: "2.718" })).toBe(true);
  });

  it("uses 6 H6 = 14.7 for the d6 coupon collector", () => {
    expect(6 * HARMONIC_6).toBeCloseTo(14.7, 10);
    expect(gradeQuestion(5, { numericText: "14.7" })).toBe(true);
  });

  it("gives 16/31 for the knockout finals", () => {
    expect(gradeQuestion(6, { numericText: "16/31" })).toBe(true);
    expect(gradeQuestion(6, { numericText: "0.516" })).toBe(true);
  });

  it("computes P(Bin(30,1/6) ≥ 5) in code", () => {
    expect(BINOM_30_SIXES_GTE_5).toBeCloseTo(binomialGte(30, 5, 1 / 6), 12);
    expect(gradeQuestion(7, { numericText: String(BINOM_30_SIXES_GTE_5) })).toBe(true);
    expect(BINOM_30_SIXES_GTE_5).toBeGreaterThan(0.4);
    expect(BINOM_30_SIXES_GTE_5).toBeLessThan(0.7);
  });

  it("accepts 2/3 for HHT before HTT (Penney), matching the suffix-state solver", () => {
    const { pA } = patternWinProbabilities("HHT", "HTT");
    expect(pA).toBeCloseTo(2 / 3, 10);
    expect(gradeQuestion(12, { numericText: "2/3" })).toBe(true);
    expect(gradeQuestion(12, { numericText: "0.667" })).toBe(true);
  });

  it("accepts 7/12 for the last-red candy problem and 84 for the cart walk", () => {
    expect(gradeQuestion(13, { numericText: "7/12" })).toBe(true);
    expect(gradeQuestion(13, { numericText: "0.583" })).toBe(true);
    expect(gradeQuestion(15, { numericText: "84" })).toBe(true);
  });

  it("grades Hypergeometric(N=20, K=7, n=5)", () => {
    expect(
      gradeQuestion(11, {
        family: "hypergeometric",
        params: { N: "20", K: "7", n: "5" },
      })
    ).toBe(true);
    expect(
      gradeQuestion(11, {
        family: "binomial",
        params: { n: "5", p: "0.35" },
      })
    ).toBe(false);
  });

  it("grades Binomial(n, 1/3) for X | X+Y = n", () => {
    expect(
      gradeQuestion(14, {
        family: "binomial",
        params: { n: "n", p: "1/3" },
      })
    ).toBe(true);
    expect(
      gradeQuestion(14, {
        family: "binomial",
        params: { n: "n", p: "0.333" },
      })
    ).toBe(true);
    expect(
      gradeQuestion(14, {
        family: "poisson",
        params: { lambda: "1" },
      })
    ).toBe(false);
  });

  it("accepts 0.048 for two-pair and 0.632 for Secret Santa", () => {
    expect(gradeQuestion(10, { numericText: "0.048" })).toBe(true);
    expect(gradeQuestion(9, { numericText: "0.632" })).toBe(true);
  });
});
