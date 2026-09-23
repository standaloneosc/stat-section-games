import { describe, expect, it } from "vitest";
import { coinTypePosterior } from "./bayes";
import {
  calculateBayesBonus,
  calculateCorrectChoice,
  calculateCorrectChoicePoints,
  calculateProbabilityPoints,
  calculateRoundScore,
  calculateSpeedPoints,
} from "./scoring";

describe("coin pattern race scoring", () => {
  it("matches the spec example total of 205 for HHT vs THT", () => {
    const pA = 0.75;
    const pB = 0.25;
    const started = new Date("2026-09-23T18:00:00.000Z");
    const submitted = new Date(started.getTime() + 90_000);
    const score = calculateRoundScore({
      correctChoicePoints: calculateCorrectChoicePoints(pA, pB, "A"),
      probabilityPoints: calculateProbabilityPoints(0.7, pA),
      speedPoints: calculateSpeedPoints(submitted, started, 180),
      bayesBonus: calculateBayesBonus(null, null),
    });
    expect(score).toEqual({
      correctChoicePoints: 100,
      probabilityPoints: 80,
      speedPoints: 25,
      bayesBonus: 0,
      total: 205,
    });
  });

  it("awards the same 205 if THT happens to appear first", () => {
    const actualWinner = "B";
    const score = calculateRoundScore({
      correctChoicePoints: calculateCorrectChoicePoints(0.75, 0.25, "A"),
      probabilityPoints: calculateProbabilityPoints(0.7, 0.75),
      speedPoints: 25,
      bayesBonus: 0,
    });
    expect(actualWinner).toBe("B");
    expect(score.total).toBe(205);
  });

  it("uses the probability points table from the spec", () => {
    expect(calculateProbabilityPoints(0.75, 0.75)).toBe(100);
    expect(calculateProbabilityPoints(0.7, 0.75)).toBe(80);
    expect(calculateProbabilityPoints(0.65, 0.75)).toBe(60);
    expect(calculateProbabilityPoints(0.55, 0.75)).toBe(20);
    expect(calculateProbabilityPoints(0.5, 0.75)).toBe(0);
    expect(calculateProbabilityPoints(0.4, 0.75)).toBe(0);
  });

  it("gives 25 speed points at 90s of a 180s window", () => {
    const started = new Date("2026-09-23T18:00:00.000Z");
    expect(calculateSpeedPoints(started, started, 180)).toBe(50);
    expect(
      calculateSpeedPoints(new Date(started.getTime() + 90_000), started, 180)
    ).toBe(25);
    expect(
      calculateSpeedPoints(new Date(started.getTime() + 150_000), started, 180)
    ).toBe(8);
    expect(
      calculateSpeedPoints(new Date(started.getTime() + 180_000), started, 180)
    ).toBe(0);
  });

  it("treats near-even matchups as ties so both choices get correct-choice points", () => {
    expect(calculateCorrectChoice(0.504, 0.496, 0.01)).toBe("tie");
    expect(calculateCorrectChoicePoints(0.504, 0.496, "A")).toBe(100);
    expect(calculateCorrectChoicePoints(0.504, 0.496, "B")).toBe(100);
    expect(calculateCorrectChoice(0.75, 0.25, 0.01)).toBe("A");
    expect(calculateCorrectChoicePoints(0.75, 0.25, "B")).toBe(0);
  });

  it("computes Bayes P(B|HT) = 3/7 and nearly full bonus at 0.43", () => {
    const posterior = coinTypePosterior("HT", { target: "B" });
    expect(posterior).toBeCloseTo(3 / 7, 10);
    expect(calculateBayesBonus(0.43, posterior)).toBe(50);
    expect(calculateBayesBonus(0.43, 3 / 7)).toBe(50);
  });
});
