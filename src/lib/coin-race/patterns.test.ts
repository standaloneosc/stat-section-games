import { describe, expect, it } from "vitest";
import { createSeededRandom } from "@/lib/probability";
import {
  patternWinProbabilities,
  sampleRound,
  stepState,
} from "./patterns";

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

  it("handles two-letter pairs such as HT vs TH from a blank history", () => {
    const { pA, pB } = patternWinProbabilities("HT", "TH");
    expect(pA).toBeCloseTo(0.5, 10);
    expect(pB).toBeCloseTo(0.5, 10);
  });

  it("samples empty-suffix 3-letter, first-flip 3-letter, and length-2 rounds", () => {
    const rng = createSeededRandom(42);
    const seen = { empty3: 0, flip3: 0, len2: 0 };
    for (let i = 0; i < 120; i += 1) {
      const round = sampleRound(rng);
      expect(round.patternA).not.toBe(round.patternB);
      expect(round.patternA.length).toBe(round.patternB.length);
      expect(round.suffix).toMatch(/^$|^[HT]$/);
      const { pA, pB } = patternWinProbabilities(round.patternA, round.patternB, {
        suffix: round.suffix,
      });
      expect(pA).toBeGreaterThan(0);
      expect(pB).toBeGreaterThan(0);
      if (round.patternA.length === 2) seen.len2 += 1;
      if (round.patternA.length === 3 && round.suffix === "") seen.empty3 += 1;
      if (round.patternA.length === 3 && round.suffix.length === 1) seen.flip3 += 1;
    }
    expect(seen.empty3).toBeGreaterThan(0);
    expect(seen.flip3).toBeGreaterThan(0);
    expect(seen.len2).toBeGreaterThan(0);
  });
});
