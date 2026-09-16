import { describe, expect, it } from "vitest";
import {
  buildMovementModes,
  buildTraitMovementModes,
  calculateHitProbabilityForSquare,
  calculateBayesPosterior,
  calculateProbabilityBonus,
  calculateSurvivalReward,
  createSeededRandom,
  destinationWeightsForMode,
  directionLabel,
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

const walkerCenter: RoundConfig = {
  gridSize: 3,
  monster: {
    trait: "walker",
    currentPosition: { x: 1, y: 1 },
    movementModes: [
      { id: "stay", probability: 0.2 },
      { id: "horizontal", probability: 0.3 },
      { id: "vertical", probability: 0.3 },
      { id: "randomLocal", probability: 0.2 },
    ],
  },
  bayes: {
    enabled: false,
    priorNoticed: 0.4,
    clueLikelihoodIfNoticed: 0.8,
    clueLikelihoodIfNotNoticed: 0.2,
  },
};

describe("board direction labels", () => {
  it("names stay and the four orthogonal sides from the center", () => {
    const start = { x: 1, y: 1 };
    expect(directionLabel(start, start)).toBe("Stay");
    expect(directionLabel(start, { x: 0, y: 1 })).toBe("Left");
    expect(directionLabel(start, { x: 2, y: 1 })).toBe("Right");
    expect(directionLabel(start, { x: 1, y: 0 })).toBe("Up");
    expect(directionLabel(start, { x: 1, y: 2 })).toBe("Down");
  });
});

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

describe("LOTP walker-in-the-center example", () => {
  it("gives five legal squares, corners off, P(left)=0.19 and P(center)=0.24", () => {
    const legal = getLegalSquares(walkerCenter);
    expect(legal.sort()).toEqual(["0,1", "1,0", "1,1", "1,2", "2,1"].sort());
    expect(legal).not.toContain("0,0");
    expect(legal).not.toContain("2,0");
    expect(calculateHitProbabilityForSquare("0,1", walkerCenter)).toBeCloseTo(0.19, 10);
    expect(calculateHitProbabilityForSquare("2,1", walkerCenter)).toBeCloseTo(0.19, 10);
    expect(calculateHitProbabilityForSquare("1,1", walkerCenter)).toBeCloseTo(0.24, 10);
    expect(calculateHitProbabilityForSquare("1,0", walkerCenter)).toBeCloseTo(0.19, 10);
    expect(calculateHitProbabilityForSquare("0,0", walkerCenter)).toBe(0);
  });

  it("is not a uniform 20% split", () => {
    const values = Object.values(getMovementDistribution(walkerCenter));
    expect(values.every((value) => Math.abs(value - 0.2) < 1e-9)).toBe(false);
  });

  it("makes every movement distribution sum to 1", () => {
    const distribution = getMovementDistribution(walkerCenter);
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
  it("gives P(noticed | warning) ≈ 0.7273 with the spec prior", () => {
    expect(calculateBayesPosterior(0.4, 0.8, 0.2, true)).toBeCloseTo(0.7272727272, 8);
  });

  it("puts 60% of noticed movement on the center for a Walker in the middle", () => {
    const weights = destinationWeightsForMode({ x: 1, y: 1 }, "walker", "targetSeeking", 3);
    expect(weights["1,1"]).toBeCloseTo(0.6, 10);
    expect(weights["0,1"]).toBeCloseTo(0.1, 10);
    expect(weights["0,0"]).toBeUndefined();
  });

  it("keeps five Walker squares when a notice hint is on, and the warning raises P(center)", () => {
    const config: RoundConfig = {
      ...walkerCenter,
      bayes: {
        enabled: true,
        priorNoticed: 0.4,
        clueId: "warning",
        clueLikelihoodIfNoticed: 0.8,
        clueLikelihoodIfNotNoticed: 0.2,
      },
    };
    expect(getLegalSquares(config).sort()).toEqual(["0,1", "1,0", "1,1", "1,2", "2,1"].sort());
    const center = calculateHitProbabilityForSquare("1,1", config);
    expect(center).toBeGreaterThan(0.24);
    expect(center).toBeLessThan(0.7);
    expect(calculateHitProbabilityForSquare("0,1", config)).toBeLessThan(0.19);
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
    const legal = new Set(getLegalSquares(walkerCenter));
    for (const x of [0, 1, 2]) {
      for (const y of [0, 1, 2]) {
        const key = `${x},${y}`;
        const probability = calculateHitProbabilityForSquare(key, walkerCenter);
        if (legal.has(key)) {
          expect(probability).toBeGreaterThan(0);
        } else {
          expect(probability).toBe(0);
        }
      }
    }
  });

  it("writes an explanation that matches the 0.19 LOTP example", () => {
    const left = "0,1";
    const text = explanationForRound({
      roundConfig: walkerCenter,
      modes: buildTraitMovementModes(walkerCenter),
      square: left,
      monsterStart: { x: 1, y: 1 },
    });
    expect(text).toMatch(/0\.19/);
    expect(text.toLowerCase()).toContain("law of total probability");
  });

  it("prints percents students can add by hand", () => {
    expect(formatPercent(0.19)).toBe("19%");
    expect(formatPercent(0.24)).toBe("24%");
    expect(formatPercent(0.2)).toBe("20%");
  });

  it("shows trait modes to students, not the hidden noticed mix", () => {
    const bayesOn: RoundConfig = {
      ...walkerCenter,
      bayes: { ...walkerCenter.bayes, enabled: true, clueId: "warning" },
    };
    expect(buildTraitMovementModes(bayesOn).map((mode) => mode.id)).toEqual([
      "stay",
      "horizontal",
      "vertical",
      "randomLocal",
    ]);
    expect(buildMovementModes(bayesOn).map((mode) => mode.id)).toEqual(["noticed", "not-noticed"]);
  });
});
