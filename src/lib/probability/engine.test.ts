import { describe, expect, it } from "vitest";
import {
  buildLotpWorksheet,
  buildMovementModes,
  calculateHitProbabilityForSquare,
  calculateBayesPosterior,
  calculateProbabilityBonus,
  calculateSurvivalReward,
  createSeededRandom,
  destinationWeightsForMode,
  explanationForRound,
  formatPercent,
  getLegalSquares,
  getMovementDistribution,
  getNeighborPositions,
  posKey,
  sampleCategoricalDistribution,
  validateRoundConfig,
  type RoundConfig,
} from "./index";

const walkerTop: RoundConfig = {
  gridSize: 3,
  monster: {
    trait: "walker",
    currentPosition: { x: 1, y: 0 },
    movementModes: [
      { id: "stay", probability: 0.1 },
      { id: "horizontal", probability: 0.3 },
      { id: "vertical", probability: 0.4 },
      { id: "randomLocal", probability: 0.2 },
    ],
  },
  bayes: {
    enabled: false,
    priorNoticed: 0.25,
    clueLikelihoodIfNoticed: 0.9,
    clueLikelihoodIfNotNoticed: 0.1,
  },
};

const walkerCenter: RoundConfig = {
  gridSize: 3,
  monster: {
    trait: "walker",
    currentPosition: { x: 1, y: 1 },
    movementModes: [
      { id: "stay", probability: 0.1 },
      { id: "horizontal", probability: 0.3 },
      { id: "vertical", probability: 0.4 },
      { id: "randomLocal", probability: 0.2 },
    ],
  },
  bayes: {
    enabled: false,
    priorNoticed: 0.25,
    clueLikelihoodIfNoticed: 0.9,
    clueLikelihoodIfNotNoticed: 0.1,
  },
};

describe("neighbor generation", () => {
  it("returns four orthogonal neighbors from the center for a Walker", () => {
    const neighbors = getNeighborPositions({ x: 1, y: 1 }, "walker", 3);
    expect(neighbors).toEqual(
      expect.arrayContaining([
        { x: 1, y: 0 },
        { x: 1, y: 2 },
        { x: 0, y: 1 },
        { x: 2, y: 1 },
      ])
    );
    expect(neighbors).toHaveLength(4);
  });

  it("returns two neighbors from a corner for a Walker", () => {
    const neighbors = getNeighborPositions({ x: 0, y: 0 }, "walker", 3);
    expect(neighbors).toEqual(
      expect.arrayContaining([
        { x: 1, y: 0 },
        { x: 0, y: 1 },
      ])
    );
    expect(neighbors).toHaveLength(2);
  });

  it("returns three neighbors from an edge for a Walker", () => {
    const neighbors = getNeighborPositions({ x: 1, y: 0 }, "walker", 3);
    expect(neighbors).toHaveLength(3);
  });

  it("gives the Spider extra diagonal reach compared with the Walker", () => {
    const walker = getNeighborPositions({ x: 1, y: 1 }, "walker", 3);
    const spider = getNeighborPositions({ x: 1, y: 1 }, "spider", 3);
    expect(walker).toHaveLength(4);
    expect(spider).toHaveLength(8);
  });
});

describe("LOTP walker example", () => {
  it("gives four legal squares with distinct hit probabilities from the top edge", () => {
    const legal = getLegalSquares(walkerTop);
    expect(legal.sort()).toEqual(["0,0", "1,0", "1,1", "2,0"].sort());
    expect(calculateHitProbabilityForSquare("1,1", walkerTop)).toBeCloseTo(0.45, 10);
    expect(calculateHitProbabilityForSquare("0,0", walkerTop)).toBeCloseTo(0.2, 10);
    expect(calculateHitProbabilityForSquare("2,0", walkerTop)).toBeCloseTo(0.2, 10);
    expect(calculateHitProbabilityForSquare("1,0", walkerTop)).toBeCloseTo(0.15, 10);
  });

  it("writes a fill-in LOTP line that does not leak the 45% answer", () => {
    const text = buildLotpWorksheet({
      square: "1,1",
      modes: buildMovementModes(walkerTop),
    });
    expect(text).toContain("(100%)(40%)");
    expect(text).toContain("(25%)(20%)");
    expect(text).toContain("= ?");
    expect(text).not.toContain("45%");
  });

  it("is not a uniform 20% split", () => {
    const values = Object.values(getMovementDistribution(walkerTop));
    expect(values.some((value) => Math.abs(value - 0.2) < 1e-9)).toBe(true);
    expect(values.every((value) => Math.abs(value - 0.2) < 1e-9)).toBe(false);
  });

  it("makes every movement distribution sum to 1", () => {
    const distribution = getMovementDistribution(walkerTop);
    const sum = Object.values(distribution).reduce((total, value) => total + value, 0);
    expect(sum).toBeCloseTo(1, 10);
  });
});

describe("edge renormalization", () => {
  it("renormalizes Walker randomLocal in the top-left corner to 1/3 each", () => {
    const weights = destinationWeightsForMode({ x: 0, y: 0 }, "walker", "randomLocal", 3);
    expect(weights["0,0"]).toBeCloseTo(1 / 3, 10);
    expect(weights["1,0"]).toBeCloseTo(1 / 3, 10);
    expect(weights["0,1"]).toBeCloseTo(1 / 3, 10);
    expect(weights["0,-1"]).toBeUndefined();
    expect(Object.values(weights).reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 10);
  });

  it("keeps only stay, right, and down as legal squares from the corner", () => {
    const config: RoundConfig = {
      ...walkerCenter,
      monster: {
        ...walkerCenter.monster,
        currentPosition: { x: 0, y: 0 },
      },
    };
    expect(getLegalSquares(config).sort()).toEqual(["0,0", "0,1", "1,0"].sort());
    validateRoundConfig(config);
  });
});

describe("Bayes example", () => {
  it("gives P(noticed | warning) = 0.75 with the classroom prior", () => {
    expect(calculateBayesPosterior(0.25, 0.9, 0.1, true)).toBeCloseTo(0.75, 10);
  });

  it("makes the warning a real update: center goes from 25% to 75%", () => {
    const config: RoundConfig = {
      gridSize: 3,
      monster: {
        trait: "hunter",
        currentPosition: { x: 0, y: 0 },
      },
      bayes: {
        enabled: true,
        priorNoticed: 0.25,
        clueId: "warning",
        clueLikelihoodIfNoticed: 0.9,
        clueLikelihoodIfNotNoticed: 0.1,
      },
    };
    expect(getLegalSquares(config).sort()).toEqual(["0,0", "0,1", "1,0", "1,1"].sort());
    expect(calculateHitProbabilityForSquare("1,1", config)).toBeCloseTo(0.75, 10);
    expect(calculateHitProbabilityForSquare("0,0", config)).toBeCloseTo(0.125, 10);
    expect(calculateHitProbabilityForSquare("1,0", config)).toBeCloseTo(0.0625, 10);
    expect(calculateHitProbabilityForSquare("0,1", config)).toBeCloseTo(0.0625, 10);
    expect(
      calculateHitProbabilityForSquare("1,1", {
        ...config,
        bayes: { ...config.bayes, clueId: null },
      })
    ).toBeCloseTo(0.25, 10);
  });
});

describe("spider from a corner", () => {
  it("gives four legal squares with 15/15/20/50 percents", () => {
    const spiderCorner: RoundConfig = {
      gridSize: 3,
      monster: {
        trait: "spider",
        currentPosition: { x: 0, y: 0 },
      },
      bayes: {
        enabled: false,
        priorNoticed: 0.25,
        clueLikelihoodIfNoticed: 0.9,
        clueLikelihoodIfNotNoticed: 0.1,
      },
    };
    expect(getLegalSquares(spiderCorner).sort()).toEqual(["0,0", "0,1", "1,0", "1,1"].sort());
    expect(calculateHitProbabilityForSquare("1,1", spiderCorner)).toBeCloseTo(0.5, 10);
    expect(calculateHitProbabilityForSquare("0,0", spiderCorner)).toBeCloseTo(0.2, 10);
    expect(calculateHitProbabilityForSquare("1,0", spiderCorner)).toBeCloseTo(0.15, 10);
    expect(calculateHitProbabilityForSquare("0,1", spiderCorner)).toBeCloseTo(0.15, 10);
  });
});

describe("scoring", () => {
  it("gives 20 points for an exact probability estimate", () => {
    expect(calculateProbabilityBonus(0.19, 0.19)).toBe(20);
  });

  it("gives a partial bonus for a close estimate", () => {
    expect(calculateProbabilityBonus(0.24, 0.19)).toBe(16);
  });

  it("gives 0 for estimates at least 0.25 away", () => {
    expect(calculateProbabilityBonus(0.5, 0.19)).toBe(0);
    expect(calculateProbabilityBonus(0.0, 0.3)).toBe(0);
  });

  it("awards survival 100 / 50 / 20 for 0, 1, and 4 co-occupants", () => {
    expect(calculateSurvivalReward(100, 0, true)).toBe(100);
    expect(calculateSurvivalReward(100, 1, true)).toBe(50);
    expect(calculateSurvivalReward(100, 4, true)).toBe(20);
  });

  it("awards zero survival points when the player is caught", () => {
    expect(calculateSurvivalReward(100, 0, false)).toBe(0);
  });
});

describe("deterministic sampling", () => {
  it("selects the first category for a low random value", () => {
    expect(sampleCategoricalDistribution({ a: 0.2, b: 0.8 }, 0.1)).toBe("a");
    expect(sampleCategoricalDistribution({ a: 0.2, b: 0.8 }, 0.2)).toBe("b");
    expect(sampleCategoricalDistribution({ a: 0.2, b: 0.8 }, 0.99)).toBe("b");
  });

  it("repeats the same sequence from a seeded source", () => {
    const first = createSeededRandom(42);
    const second = createSeededRandom(42);
    const a = Array.from({ length: 8 }, () => first());
    const b = Array.from({ length: 8 }, () => second());
    expect(a).toEqual(b);
  });
});

describe("educational correctness", () => {
  it("gives every legal square a positive hit probability and zeros the rest", () => {
    const legal = new Set(getLegalSquares(walkerTop));
    for (const x of [0, 1, 2]) {
      for (const y of [0, 1, 2]) {
        const key = `${x},${y}`;
        const probability = calculateHitProbabilityForSquare(key, walkerTop);
        if (legal.has(key)) {
          expect(probability).toBeGreaterThan(0);
        } else {
          expect(probability).toBe(0);
        }
      }
    }
  });

  it("writes an explanation that matches the 0.45 LOTP example", () => {
    const center = "1,1";
    const text = explanationForRound({
      roundConfig: walkerTop,
      modes: buildMovementModes(walkerTop),
      square: center,
      monsterStart: { x: 1, y: 0 },
    });
    expect(text).toMatch(/0\.45/);
    expect(text.toLowerCase()).toContain("law of total probability");
  });

  it("prints percents students can add by hand", () => {
    expect(formatPercent(0.45)).toBe("45%");
    expect(formatPercent(0.2)).toBe("20%");
    expect(formatPercent(0.075)).toBe("7.5%");
    expect(formatPercent(0.125)).toBe("12.5%");
  });
});
