import { describe, expect, it } from "vitest";
import {
  bayesPercentError,
  parseUnitInterval,
  percentFromProbability,
  UNUSABLE_BAYES_MESSAGE,
} from "./bayes-percents";
import { bayesLikelihoodsAreUsable } from "@/lib/probability";

describe("Bayes percent parsing", () => {
  it("accepts 0–1 probabilities and 0–100 percents", () => {
    expect(parseUnitInterval(0.4, "P(Alert)")).toBe(0.4);
    expect(parseUnitInterval(40, "P(Alert)")).toBe(0.4);
    expect(parseUnitInterval(0, "P(Alert)")).toBe(0);
    expect(parseUnitInterval(100, "P(Alert)")).toBe(1);
    expect(parseUnitInterval(1, "P(Alert)")).toBe(1);
    expect(percentFromProbability(0.4)).toBe(40);
  });

  it("rejects values outside 0–100", () => {
    expect(() => parseUnitInterval(-1, "P(Alert)")).toThrow(/0 and 100/);
    expect(() => parseUnitInterval(101, "P(Alert)")).toThrow(/0 and 100/);
    expect(() => parseUnitInterval(Number.NaN, "P(Alert)")).toThrow(/0 to 100/);
  });

  it("keeps the default 40/80/20 model usable and rejects zero-evidence likelihoods", () => {
    expect(bayesLikelihoodsAreUsable(0.4, 0.8, 0.2)).toBe(true);
    expect(bayesLikelihoodsAreUsable(0, 0, 0)).toBe(false);
    expect(bayesLikelihoodsAreUsable(1, 1, 1)).toBe(false);
    expect(bayesLikelihoodsAreUsable(0.4, 0, 0)).toBe(false);
    expect(bayesLikelihoodsAreUsable(0.4, 1, 1)).toBe(false);
    expect(bayesPercentError(40, 80, 20)).toBeNull();
    expect(bayesPercentError(-5, 80, 20)).toMatch(/0 and 100/);
    expect(bayesPercentError(40, 0, 0)).toBe(UNUSABLE_BAYES_MESSAGE);
    expect(bayesPercentError(40, 100, 100)).toBe(UNUSABLE_BAYES_MESSAGE);
  });
});
