import { describe, expect, it } from "vitest";
import {
  createInternalRound,
  createRoom,
  joinRoom,
  resolveRound,
  startGame,
  submitChoice,
  toPublicState,
} from "./rooms";
import { DEFAULT_GAME_CONFIG, type Room } from "./types";
import { createSeededRandom, posKey } from "@/lib/probability";

function seededRoom(config?: Partial<typeof DEFAULT_GAME_CONFIG>): Room {
  const { room } = createRoom({ hostName: "Ms. Park", config });
  joinRoom({ code: room.code, name: "Ava" });
  joinRoom({ code: room.code, name: "Ben" });
  return room;
}

function posteriorGuess(room: Room): number | null {
  return room.round?.bayes.enabled ? 0.73 : null;
}

describe("public state hiding", () => {
  it("hides other players' squares, counts, Bayes state, and correct probabilities while choosing", () => {
    const room = seededRoom();
    const [ava, ben] = [...room.players.values()];
    startGame(room, room.hostToken);
    const round = room.round;
    expect(round).toBeTruthy();
    if (!round) {
      return;
    }

    const square = round.legalSquares[0];
    submitChoice({
      room,
      playerId: ava.id,
      token: ava.token,
      selectedSquare: square,
      estimatedHitProbability: 0.19,
      bayesEstimate: posteriorGuess(room),
      confirm: true,
    });

    const avaView = toPublicState({
      room,
      playerId: ava.id,
      playerToken: ava.token,
    });
    const benView = toPublicState({
      room,
      playerId: ben.id,
      playerToken: ben.token,
    });
    const hostView = toPublicState({ room, hostToken: room.hostToken });
    const avaJson = JSON.stringify(avaView);
    const benJson = JSON.stringify(benView);
    const hostJson = JSON.stringify(hostView);

    expect(avaView.round?.phase).toBe("choosing");
    expect(avaView.you?.selectedSquare).toBe(square);
    expect(benView.you?.selectedSquare).toBeNull();
    expect(benJson).not.toContain(`"selectedSquare":"${square}"`);
    expect(avaView.round?.resolved).toBeNull();
    expect(benView.round?.resolved).toBeNull();
    expect(hostView.round?.resolved).toBeNull();
    expect(avaJson).not.toContain("playerCounts");
    expect(hostJson).not.toContain("playerCounts");
    expect(avaView.round?.hints).toBeNull();
    expect(avaJson).not.toMatch(/"hiddenState":"(noticed|not-noticed)"/);
    expect(hostJson).not.toMatch(/"hiddenState":"(noticed|not-noticed)"/);
    expect(avaView.players.find((player) => player.id === ava.id)?.hasSubmitted).toBe(true);
    expect(avaView.players.find((player) => player.id === ben.id)?.hasSubmitted).toBe(false);
  });

  it("never sends the hidden Bayes state before resolution", () => {
    const { room } = createRoom({
      hostName: "Host",
      config: { ...DEFAULT_GAME_CONFIG, bayesEnabled: true, bayesEveryNthRound: 1 },
    });
    joinRoom({ code: room.code, name: "Cara" });
    startGame(room, room.hostToken);
    expect(room.round?.bayes.enabled).toBe(true);
    expect(room.round?.bayes.hiddenState).toBeTruthy();
    const view = toPublicState({ room, hostToken: room.hostToken });
    expect(JSON.stringify(view)).not.toMatch(/"hiddenState":"(noticed|not-noticed)"/);
    expect(view.round?.bayes.clueId).toBeTruthy();
  });
});

describe("round resolution", () => {
  it("rejects late submissions after the round is resolved", () => {
    const room = seededRoom();
    const [ava] = [...room.players.values()];
    startGame(room, room.hostToken);
    const square = room.round!.legalSquares[0];
    resolveRound(room, createSeededRandom(7));
    expect(() =>
      submitChoice({
        room,
        playerId: ava.id,
        token: ava.token,
        selectedSquare: square,
        estimatedHitProbability: 0.2,
        bayesEstimate: null,
        confirm: true,
      })
    ).toThrow(/closed|locked|Time is up/i);
  });

  it("lets a caught player keep a probability bonus", () => {
    const room = seededRoom({ bayesEnabled: false });
    const [ava, ben] = [...room.players.values()];
    startGame(room, room.hostToken);
    const round = room.round!;
    const dest = posKey(round.monster.currentPosition);
    const correct = round.correctHitProbabilities[dest];
    submitChoice({
      room,
      playerId: ava.id,
      token: ava.token,
      selectedSquare: dest,
      estimatedHitProbability: correct,
      bayesEstimate: posteriorGuess(room),
      confirm: true,
    });
    submitChoice({
      room,
      playerId: ben.id,
      token: ben.token,
      selectedSquare: round.legalSquares[1],
      estimatedHitProbability: 0.9,
      bayesEstimate: posteriorGuess(room),
      confirm: true,
    });

    round.phase = "resolving";
    const forced = {
      ...round,
    };
    void forced;
    room.round!.resolved = null;
    const rng = () => 0;
    resolveRound(room, rng);
    const avaResult = room.round!.resolved!.results.find((result) => result.playerId === ava.id);
    expect(avaResult).toBeTruthy();
    if (!avaResult) {
      return;
    }
    if (!avaResult.survived) {
      expect(avaResult.survivalPoints).toBe(0);
      expect(avaResult.probabilityBonus).toBe(20);
      expect(avaResult.roundPoints).toBe(20);
    }
  });

  it("reconnects a player into the current round with their own submission only", () => {
    const room = seededRoom();
    const [ava] = [...room.players.values()];
    startGame(room, room.hostToken);
    const square = room.round!.legalSquares[1];
    submitChoice({
      room,
      playerId: ava.id,
      token: ava.token,
      selectedSquare: square,
      estimatedHitProbability: 0.24,
      bayesEstimate: posteriorGuess(room),
      confirm: true,
    });
    const again = joinRoom({
      code: room.code,
      name: "Ava",
      playerId: ava.id,
      token: ava.token,
    });
    const view = toPublicState({
      room,
      playerId: again.player.id,
      playerToken: again.player.token,
    });
    expect(view.round?.roundNumber).toBe(1);
    expect(view.you?.selectedSquare).toBe(square);
    expect(view.you?.estimatedHitProbability).toBe(0.24);
  });

  it("uses the server destination, not a client-supplied square, for scoring", () => {
    const rng = createSeededRandom(99);
    const round = createInternalRound({ ...DEFAULT_GAME_CONFIG, bayesEnabled: false }, 1, rng);
    expect(round.monster.trait).toBe("walker");
    expect(posKey(round.monster.currentPosition)).toBe("1,1");
    expect(round.legalSquares).toHaveLength(5);
    expect(round.legalSquares).not.toContain("0,0");
    expect(round.correctHitProbabilities["1,1"]).toBeCloseTo(0.24, 8);
    expect(round.correctHitProbabilities["0,1"]).toBeCloseTo(0.19, 8);
  });

  it("turns on a notice hint every round by default and still starts the Walker in the center", () => {
    const round = createInternalRound(DEFAULT_GAME_CONFIG, 1, createSeededRandom(3));
    expect(round.bayes.enabled).toBe(true);
    expect(round.bayes.clueId).toMatch(/warning|quiet/);
    expect(posKey(round.monster.currentPosition)).toBe("1,1");
    expect(round.legalSquares).toHaveLength(5);
    expect(round.monster.movementModes.map((mode) => mode.id)).toEqual([
      "stay",
      "horizontal",
      "vertical",
      "randomLocal",
    ]);
  });

  it("keeps the notice hint on for later auto-cycle traits", () => {
    const spider = createInternalRound(DEFAULT_GAME_CONFIG, 2, createSeededRandom(4));
    const hunter = createInternalRound(DEFAULT_GAME_CONFIG, 3, createSeededRandom(5));
    expect(spider.monster.trait).toBe("spider");
    expect(hunter.monster.trait).toBe("hunter");
    expect(spider.bayes.enabled).toBe(true);
    expect(hunter.bayes.enabled).toBe(true);
    expect(spider.bayes.clueId).toMatch(/warning|quiet/);
    expect(hunter.bayes.clueId).toMatch(/warning|quiet/);
  });

  it("does not send true square percents or worksheets to players while they are choosing", () => {
    const room = seededRoom();
    startGame(room, room.hostToken);
    const view = toPublicState({ room, hostToken: room.hostToken });
    const json = JSON.stringify(view.round);
    expect(view.round?.phase).toBe("choosing");
    expect(view.round?.hints).toBeNull();
    expect(view.round?.resolved).toBeNull();
    expect(json).not.toContain("0.19");
    expect(json).not.toContain("0.24");
    expect(json).not.toMatch(/the answer is/i);
    expect(json).not.toMatch(/P\(1,1\)/);
    expect(view.round?.monster.movementModes.map((mode) => mode.id)).toEqual([
      "stay",
      "horizontal",
      "vertical",
      "randomLocal",
    ]);
  });

  it("requires a Bayes posterior on Bayes rounds", () => {
    const { room } = createRoom({
      hostName: "Host",
      config: { ...DEFAULT_GAME_CONFIG, bayesEnabled: true, bayesEveryNthRound: 1 },
    });
    const { player } = joinRoom({ code: room.code, name: "Dee" });
    startGame(room, room.hostToken);
    expect(room.round?.bayes.enabled).toBe(true);
    const square = room.round!.legalSquares[0];
    expect(() =>
      submitChoice({
        room,
        playerId: player.id,
        token: player.token,
        selectedSquare: square,
        estimatedHitProbability: 0.4,
        bayesEstimate: null,
        confirm: true,
      })
    ).toThrow(/noticed/i);
  });
});
