import { describe, expect, it } from "vitest";
import { patternWinProbabilities, stepState } from "./patterns";

describe("pattern-before-pattern win probabilities", () => {
  it("gives HHT vs THT → 0.75/0.25 from suffix H (state chain, not next-3-flips)", () => {
    const naiveNextThree = 1 / 8;
    const { pA, pB, startState } = patternWinProbabilities("HHT", "THT", {
      suffix: "H",
    });
    expect(startState).toBe("H");
    expect(pA).toBeCloseTo(0.75, 10);
    expect(pB).toBeCloseTo(0.25, 10);
    expect(pA).not.toBeCloseTo(naiveNextThree, 2);
    expect(pB).not.toBeCloseTo(naiveNextThree, 2);
  });

  it("uses the suffix/state chain from empty as well (5/8, not 1/8)", () => {
    const { pA, pB } = patternWinProbabilities("HHT", "THT");
    expect(pA).toBeCloseTo(0.625, 10);
    expect(pB).toBeCloseTo(0.375, 10);
  });

  it("computes P(HHT wins | suffix HT) from the HT state, not from a fresh three flips", () => {
    const { pA, startState } = patternWinProbabilities("HHT", "THT", { suffix: "HT" });
    expect(startState).toBe("T");
    expect(pA).toBeCloseTo(0.5, 10);
    expect(stepState("H", "T", "HHT", "THT")).toBe("T");
    expect(stepState("HH", "T", "HHT", "THT")).toBe("A");
    expect(stepState("TH", "T", "HHT", "THT")).toBe("B");
  });
});
