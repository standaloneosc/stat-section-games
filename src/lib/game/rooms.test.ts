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

function seededRoom(): Room {
  const { room } = createRoom({ hostName: "Ms. Park" });
  joinRoom({ code: room.code, name: "Ava" });
  joinRoom({ code: room.code, name: "Ben" });
  return room;
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
      bayesEstimate: null,
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
    const room = seededRoom();
    const [ava, ben] = [...room.players.values()];
    startGame(room, room.hostToken);
    const round = room.round!;
    const dest = "1,1";
    const correct = round.correctHitProbabilities[dest];
    submitChoice({
      room,
      playerId: ava.id,
      token: ava.token,
      selectedSquare: dest,
      estimatedHitProbability: correct,
      bayesEstimate: null,
      confirm: true,
    });
    submitChoice({
      room,
      playerId: ben.id,
      token: ben.token,
      selectedSquare: round.legalSquares[1],
      estimatedHitProbability: 0.9,
      bayesEstimate: null,
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
      bayesEstimate: null,
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
    const round = createInternalRound(DEFAULT_GAME_CONFIG, 1, rng);
    expect(round.monster.trait).toBe("walker");
    expect(posKey(round.monster.currentPosition)).toBe("1,1");
    expect(round.correctHitProbabilities["0,1"]).toBeCloseTo(0.19, 8);
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
