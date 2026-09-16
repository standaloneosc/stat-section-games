import {
  bayesLikelihoodsAreUsable,
  buildTraitMovementModes,
  calculateProbabilityBonus,
  calculateSurvivalReward,
  calculationError,
  clueText,
  defaultExplanationSquare,
  explanationForRound,
  getCorrectHitProbabilities,
  getLegalSquares,
  posKey,
  posteriorForRound,
  sampleCategoricalDistribution,
  sampleMonsterDestination,
  TRAIT_DESCRIPTIONS,
  TRAIT_MODE_CATALOG,
  validateRoundConfig,
  type MonsterTrait,
  type Position,
  type RoundConfig,
} from "@/lib/probability";
import {
  parseUnitInterval,
  UNUSABLE_BAYES_MESSAGE,
} from "./bayes-percents";
import {
  DEFAULT_GAME_CONFIG,
  type GameConfig,
  type InternalRound,
  type PlayerRecord,
  type PlayerRoundResult,
  type PlayerSubmission,
  type PublicRoomState,
  type PublicRound,
  type Room,
  type RoomEvent,
} from "./types";

const globalStore = globalThis as unknown as {
  hideSeekRooms?: Map<string, Room>;
  hideSeekPractice?: Map<string, PracticeRound>;
};

export const rooms: Map<string, Room> =
  globalStore.hideSeekRooms ?? new Map<string, Room>();
globalStore.hideSeekRooms = rooms;

type PracticeRound = {
  id: string;
  createdAt: number;
  round: InternalRound;
  config: GameConfig;
  roundConfig: RoundConfig;
};

export const practiceRounds: Map<string, PracticeRound> =
  globalStore.hideSeekPractice ?? new Map<string, PracticeRound>();
globalStore.hideSeekPractice = practiceRounds;

const ROOM_CODE_CHARS = "ACDEGHJKLMNPQRTUVWXY3479";

function nowIso(date = new Date()): string {
  return date.toISOString();
}

function randomId(): string {
  return crypto.randomUUID();
}

function randomCode(): string {
  let code = "";
  for (let i = 0; i < 4; i += 1) {
    const index = Math.floor(Math.random() * ROOM_CODE_CHARS.length);
    code += ROOM_CODE_CHARS[index];
  }
  return code;
}

function remainingMs(deadline: string | null, paused: boolean, pauseRemaining: number | null): number {
  if (paused && pauseRemaining !== null) {
    return Math.max(0, pauseRemaining);
  }
  if (!deadline) {
    return 0;
  }
  return Math.max(0, new Date(deadline).getTime() - Date.now());
}

export function emit(room: Room, event: RoomEvent): void {
  for (const listener of room.listeners) {
    listener(event);
  }
}

export function subscribe(code: string, listener: (event: RoomEvent) => void): () => void {
  const room = rooms.get(code.toUpperCase());
  if (!room) {
    return () => undefined;
  }
  room.listeners.add(listener);
  return () => {
    room.listeners.delete(listener);
  };
}

function broadcastState(room: Room): void {
  emit(room, { type: "round:state", payload: null });
}

export function createRoom(options: {
  hostName: string;
  config?: Partial<GameConfig>;
}): { room: Room; hostId: string; hostToken: string } {
  let code = randomCode();
  while (rooms.has(code)) {
    code = randomCode();
  }
  const hostId = randomId();
  const hostToken = randomId();
  const room: Room = {
    code,
    hostId,
    hostToken,
    createdAt: nowIso(),
    config: normalizeConfig({ ...DEFAULT_GAME_CONFIG, ...options.config }),
    status: "lobby",
    players: new Map(),
    round: null,
    history: [],
    pauseRemainingMs: null,
    listeners: new Set(),
  };
  rooms.set(code, room);
  ensureTicker();
  return { room, hostId, hostToken };
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code.toUpperCase());
}

export function joinRoom(options: {
  code: string;
  name: string;
  playerId?: string;
  token?: string;
}): { room: Room; player: PlayerRecord } {
  const room = getRoom(options.code);
  if (!room) {
    throw new GameError("Room not found. Check the code and try again.", 404);
  }
  const name = options.name.trim().slice(0, 24);
  if (name.length < 1) {
    throw new GameError("Enter a display name to join.", 400);
  }

  if (options.playerId && options.token) {
    const existing = room.players.get(options.playerId);
    if (existing && existing.token === options.token) {
      existing.connected = true;
      existing.lastSeenAt = nowIso();
      if (existing.name !== name) {
        existing.name = name;
      }
      broadcastState(room);
      return { room, player: existing };
    }
  }

  if (room.status === "finished") {
    throw new GameError("This game has already finished.", 409);
  }

  const player: PlayerRecord = {
    id: randomId(),
    token: randomId(),
    name,
    connected: true,
    joinedAt: nowIso(),
    lastSeenAt: nowIso(),
    score: 0,
  };
  room.players.set(player.id, player);
  broadcastState(room);
  return { room, player };
}

export function assertHost(room: Room, hostToken: string): void {
  if (room.hostToken !== hostToken) {
    throw new GameError("Only the host can do that.", 403);
  }
}

export function assertPlayer(room: Room, playerId: string, token: string): PlayerRecord {
  const player = room.players.get(playerId);
  if (!player || player.token !== token) {
    throw new GameError("We could not match that player to this room.", 403);
  }
  player.connected = true;
  player.lastSeenAt = nowIso();
  return player;
}

export function updateConfig(room: Room, hostToken: string, patch: Partial<GameConfig>): GameConfig {
  assertHost(room, hostToken);
  const next = normalizeConfig({ ...room.config, ...patch });
  if (room.status === "playing" || room.status === "paused") {
    if (JSON.stringify(configWithoutBayes(next)) !== JSON.stringify(configWithoutBayes(room.config))) {
      throw new GameError(
        "Pause and return to the lobby before changing other rules. You can still change Alert/Bayes percents for this round.",
        409
      );
    }
    room.config = next;
    applyBayesPercentsToCurrentRound(room);
    broadcastState(room);
    return room.config;
  }
  room.config = next;
  broadcastState(room);
  return room.config;
}

export function normalizeConfig(config: GameConfig): GameConfig {
  const priorNoticed = requireUnitInterval(config.priorNoticed, "P(Alert)");
  const warningLikelihoodIfNoticed = requireUnitInterval(
    config.warningLikelihoodIfNoticed,
    "P(warning | Alert)"
  );
  const warningLikelihoodIfNotNoticed = requireUnitInterval(
    config.warningLikelihoodIfNotNoticed,
    "P(warning | Calm)"
  );
  if (
    !bayesLikelihoodsAreUsable(
      priorNoticed,
      warningLikelihoodIfNoticed,
      warningLikelihoodIfNotNoticed
    )
  ) {
    throw new GameError(UNUSABLE_BAYES_MESSAGE, 400);
  }
  return {
    ...config,
    gridSize: 3,
    roundCount: clampInt(config.roundCount, 1, 12),
    roundDurationSeconds: clampInt(config.roundDurationSeconds, 15, 600),
    resultsDurationSeconds: clampInt(config.resultsDurationSeconds, 10, 180),
    baseReward: clampInt(config.baseReward, 10, 1000),
    bayesEveryNthRound: clampInt(config.bayesEveryNthRound, 1, 12),
    priorNoticed,
    warningLikelihoodIfNoticed,
    warningLikelihoodIfNotNoticed,
  };
}

function requireUnitInterval(value: number, label: string): number {
  try {
    return parseUnitInterval(value, label);
  } catch (error) {
    throw new GameError(
      error instanceof Error ? error.message : `${label} must be between 0 and 100.`,
      400
    );
  }
}

function configWithoutBayes(config: GameConfig) {
  const {
    priorNoticed,
    warningLikelihoodIfNoticed,
    warningLikelihoodIfNotNoticed,
    ...rest
  } = config;
  void priorNoticed;
  void warningLikelihoodIfNoticed;
  void warningLikelihoodIfNotNoticed;
  return rest;
}

function applyBayesPercentsToCurrentRound(room: Room): void {
  const round = room.round;
  if (!round || !round.bayes.enabled || round.phase !== "choosing") {
    return;
  }
  round.bayes.priorNoticed = room.config.priorNoticed;
  round.bayes.clueLikelihoodIfNoticed = room.config.warningLikelihoodIfNoticed;
  round.bayes.clueLikelihoodIfNotNoticed = room.config.warningLikelihoodIfNotNoticed;
  round.correctHitProbabilities = getCorrectHitProbabilities(toRoundConfig(round));
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function startGame(room: Room, hostToken: string): void {
  assertHost(room, hostToken);
  if (room.players.size < 1) {
    throw new GameError("Wait for at least one player to join before starting.", 400);
  }
  room.status = "playing";
  room.pauseRemainingMs = null;
  room.history = [];
  for (const player of room.players.values()) {
    player.score = 0;
  }
  room.round = createInternalRound(room.config, 1);
  broadcastState(room);
}

export function pauseGame(room: Room, hostToken: string): void {
  assertHost(room, hostToken);
  if (room.status !== "playing" || !room.round || room.round.phase !== "choosing") {
    throw new GameError("Nothing is in play to pause.", 409);
  }
  room.status = "paused";
  room.pauseRemainingMs = remainingMs(room.round.deadline, false, null);
  broadcastState(room);
}

export function resumeGame(room: Room, hostToken: string): void {
  assertHost(room, hostToken);
  if (room.status !== "paused" || !room.round) {
    throw new GameError("The game is not paused.", 409);
  }
  room.status = "playing";
  const remain = room.pauseRemainingMs ?? 0;
  room.round.deadline = new Date(Date.now() + remain).toISOString();
  room.pauseRemainingMs = null;
  broadcastState(room);
}

export function endRoundNow(room: Room, hostToken: string): void {
  assertHost(room, hostToken);
  if (!room.round || room.round.phase !== "choosing") {
    throw new GameError("There is no open round to end.", 409);
  }
  resolveRound(room);
}

export function nextRound(room: Room, hostToken: string): void {
  assertHost(room, hostToken);
  advanceFromResults(room);
}

export function endGame(room: Room, hostToken: string): void {
  assertHost(room, hostToken);
  room.status = "finished";
  if (room.round && room.round.phase === "choosing") {
    resolveRound(room);
  }
  room.status = "finished";
  emit(room, { type: "game:leaderboard", payload: leaderboard(room) });
  broadcastState(room);
}

export class GameError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "GameError";
    this.status = status;
  }
}

function pickTrait(config: GameConfig, roundNumber: number): MonsterTrait {
  if (config.monsterTrait !== "auto") {
    return config.monsterTrait;
  }
  const cycle: MonsterTrait[] = ["walker", "spider", "hunter"];
  return cycle[(roundNumber - 1) % cycle.length];
}

function pickStartPosition(trait: MonsterTrait, rng: () => number): Position {
  if (trait === "walker") {
    return { x: 1, y: 1 };
  }
  if (trait === "spider") {
    const corners: Position[] = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 2 },
      { x: 2, y: 2 },
    ];
    return corners[Math.floor(rng() * corners.length)]!;
  }
  return { x: 1, y: 1 };
}

export function createInternalRound(
  config: GameConfig,
  roundNumber: number,
  rng: () => number = Math.random
): InternalRound {
  config = normalizeConfig(config);
  const bayesRound = Boolean(config.bayesEnabled);
  const trait = pickTrait(config, roundNumber);
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const currentPosition = pickStartPosition(trait, rng);
    const movementModes =
      trait === "walker"
        ? TRAIT_MODE_CATALOG.walker
        : undefined;
    let hiddenState: "noticed" | "not-noticed" | null = null;
    let clueId: string | null = null;
    if (bayesRound) {
      hiddenState = rng() < config.priorNoticed ? "noticed" : "not-noticed";
      const warningChance =
        hiddenState === "noticed"
          ? config.warningLikelihoodIfNoticed
          : config.warningLikelihoodIfNotNoticed;
      clueId = rng() < warningChance ? "warning" : "quiet";
    }

    const roundConfig: RoundConfig = {
      gridSize: config.gridSize,
      monster: {
        trait,
        currentPosition,
        movementModes,
      },
      bayes: {
        enabled: bayesRound,
        hiddenState,
        priorNoticed: config.priorNoticed,
        clueId,
        clueLikelihoodIfNoticed: config.warningLikelihoodIfNoticed,
        clueLikelihoodIfNotNoticed: config.warningLikelihoodIfNotNoticed,
      },
    };

    try {
      validateRoundConfig(roundConfig);
      const legalSquares = getLegalSquares(roundConfig);
      if (legalSquares.length < 3 && attempt < 20) {
        lastError = new Error("Need at least three legal squares");
        continue;
      }
      if (legalSquares.length < 2) {
        lastError = new Error("Need at least two legal squares");
        continue;
      }
      const modes = buildTraitMovementModes(roundConfig);
      const correctHitProbabilities = getCorrectHitProbabilities(roundConfig);
      const startedAt = nowIso();
      const deadline = new Date(
        Date.now() + config.roundDurationSeconds * 1000
      ).toISOString();
      return {
        roundNumber,
        gridSize: 3,
        monster: {
          trait,
          currentPosition,
          movementModes: modes,
        },
        bayes: {
          enabled: bayesRound,
          hiddenState,
          priorNoticed: bayesRound ? config.priorNoticed : null,
          clueId,
          clueLikelihoodIfNoticed: bayesRound
            ? config.warningLikelihoodIfNoticed
            : null,
          clueLikelihoodIfNotNoticed: bayesRound
            ? config.warningLikelihoodIfNotNoticed
            : null,
        },
        legalSquares,
        correctHitProbabilities,
        phase: "choosing",
        startedAt,
        deadline,
        resultsUntil: null,
        submissions: new Map(),
        resolved: null,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw new GameError(
    `Could not build a valid round: ${lastError instanceof Error ? lastError.message : "unknown error"}`
  );
}

function toRoundConfig(round: InternalRound): RoundConfig {
  return {
    gridSize: round.gridSize,
    monster: {
      trait: round.monster.trait,
      currentPosition: round.monster.currentPosition,
      movementModes: round.monster.movementModes
        .filter((mode) => mode.id !== "noticed" && mode.id !== "not-noticed")
        .map((mode) => ({
          id: mode.id,
          label: mode.label,
          probability: mode.probability,
        })),
    },
    bayes: {
      enabled: round.bayes.enabled,
      hiddenState: round.bayes.hiddenState,
      priorNoticed: round.bayes.priorNoticed ?? 0.4,
      clueId: round.bayes.clueId,
      clueLikelihoodIfNoticed: round.bayes.clueLikelihoodIfNoticed ?? 0.8,
      clueLikelihoodIfNotNoticed: round.bayes.clueLikelihoodIfNotNoticed ?? 0.2,
    },
  };
}

export function submitChoice(options: {
  room: Room;
  playerId: string;
  token: string;
  selectedSquare: string;
  estimatedHitProbability: number;
  bayesEstimate: number | null;
  confirm: boolean;
}): PlayerSubmission {
  const { room } = options;
  const player = assertPlayer(room, options.playerId, options.token);
  const round = room.round;
  if (!round || round.phase !== "choosing" || room.status === "finished") {
    throw new GameError("Submissions are closed for this round.", 409);
  }
  if (room.status !== "paused") {
    if (Date.now() >= new Date(round.deadline).getTime()) {
      throw new GameError("Time is up. Late submissions are locked.", 409);
    }
  }
  if (!options.confirm) {
    throw new GameError("Confirm your square and probability before locking in.", 400);
  }
  if (!round.legalSquares.includes(options.selectedSquare)) {
    throw new GameError("Choose a highlighted legal square.", 400);
  }
  if (
    !Number.isFinite(options.estimatedHitProbability) ||
    options.estimatedHitProbability < 0 ||
    options.estimatedHitProbability > 1
  ) {
    throw new GameError("Enter a hit probability between 0% and 100%.", 400);
  }
  if (round.bayes.enabled) {
    if (
      options.bayesEstimate === null ||
      !Number.isFinite(options.bayesEstimate) ||
      options.bayesEstimate < 0 ||
      options.bayesEstimate > 1
    ) {
      throw new GameError("This round also needs how likely it noticed the class, 0% to 100%.", 400);
    }
  }

  const submission: PlayerSubmission = {
    playerId: player.id,
    selectedSquare: options.selectedSquare,
    estimatedHitProbability: options.estimatedHitProbability,
    bayesEstimate: round.bayes.enabled ? options.bayesEstimate : null,
    submittedAt: nowIso(),
    missedSubmission: false,
    confirmed: true,
  };
  round.submissions.set(player.id, submission);
  broadcastState(room);
  return submission;
}

export function resolveRound(room: Room, rng: () => number = Math.random): void {
  const round = room.round;
  if (!round || round.phase === "results") {
    return;
  }
  round.phase = "resolving";
  emit(room, { type: "round:locked", payload: { roundNumber: round.roundNumber } });

  for (const player of room.players.values()) {
    if (!round.submissions.has(player.id)) {
      const selectedSquare = sampleCategoricalDistribution(
        Object.fromEntries(round.legalSquares.map((square) => [square, 1])),
        rng()
      );
      round.submissions.set(player.id, {
        playerId: player.id,
        selectedSquare,
        estimatedHitProbability: null,
        bayesEstimate: null,
        submittedAt: nowIso(),
        missedSubmission: true,
        confirmed: false,
      });
    }
  }

  const roundConfig = toRoundConfig(round);
  const sampled = sampleMonsterDestination(roundConfig, {
    modeOrState: rng(),
    destination: rng(),
  });
  const destinationKey = posKey(sampled.destination);
  const playerCounts: Record<string, number> = {};
  for (const square of round.legalSquares) {
    playerCounts[square] = 0;
  }
  for (const submission of round.submissions.values()) {
    playerCounts[submission.selectedSquare] =
      (playerCounts[submission.selectedSquare] ?? 0) + 1;
  }

  const correctBayes = posteriorForRound(roundConfig);
  const results: PlayerRoundResult[] = [];
  for (const player of room.players.values()) {
    const submission = round.submissions.get(player.id);
    if (!submission) {
      continue;
    }
    const playersOnSquare = playerCounts[submission.selectedSquare] ?? 1;
    const otherPlayersOnSquare = Math.max(0, playersOnSquare - 1);
    const survived = submission.selectedSquare !== destinationKey;
    const survivalPoints = calculateSurvivalReward(
      room.config.baseReward,
      otherPlayersOnSquare,
      survived
    );
    const correctHit = round.correctHitProbabilities[submission.selectedSquare] ?? 0;
    const probabilityBonus =
      submission.estimatedHitProbability === null
        ? 0
        : calculateProbabilityBonus(submission.estimatedHitProbability, correctHit);
    const bayesBonus =
      round.bayes.enabled &&
      submission.bayesEstimate !== null &&
      correctBayes !== null
        ? calculateProbabilityBonus(submission.bayesEstimate, correctBayes)
        : 0;
    const roundPoints = survivalPoints + probabilityBonus + bayesBonus;
    player.score += roundPoints;
    results.push({
      playerId: player.id,
      name: player.name,
      selectedSquare: submission.selectedSquare,
      estimatedHitProbability: submission.estimatedHitProbability,
      bayesEstimate: submission.bayesEstimate,
      correctHitProbability: correctHit,
      correctBayesPosterior: correctBayes,
      survived,
      otherPlayersOnSquare,
      playersOnSquare,
      survivalPoints,
      probabilityBonus,
      bayesBonus,
      roundPoints,
      cumulativeScore: player.score,
      missedSubmission: submission.missedSubmission,
      calculationError:
        submission.estimatedHitProbability === null
          ? null
          : calculationError(submission.estimatedHitProbability, correctHit),
      bayesError:
        submission.bayesEstimate === null || correctBayes === null
          ? null
          : calculationError(submission.bayesEstimate, correctBayes),
    });
  }

  results.sort((a, b) => b.cumulativeScore - a.cumulativeScore);
  const explanationSquare = defaultExplanationSquare(
    round.legalSquares,
    round.monster.currentPosition
  );
  const explanation = explanationForRound({
    roundConfig,
    modes: round.monster.movementModes,
    square: explanationSquare,
    monsterStart: round.monster.currentPosition,
  });

  round.resolved = {
    destination: sampled.destination,
    sampledModeId: sampled.modeId,
    playerCounts,
    results,
    explanation,
    explanationSquare,
    correctHitProbabilities: round.correctHitProbabilities,
    correctBayesPosterior: correctBayes,
  };
  round.phase = "results";
  round.resultsUntil = new Date(
    Date.now() + room.config.resultsDurationSeconds * 1000
  ).toISOString();
  room.history.push({
    roundNumber: round.roundNumber,
    trait: round.monster.trait,
    destination: sampled.destination,
    results,
  });
  room.status = "playing";
  room.pauseRemainingMs = null;
  emit(room, { type: "round:resolved", payload: null });
  broadcastState(room);
}

function advanceFromResults(room: Room): void {
  const round = room.round;
  if (!round || round.phase !== "results") {
    if (room.status === "lobby") {
      return;
    }
  }
  const nextNumber = (round?.roundNumber ?? 0) + 1;
  if (nextNumber > room.config.roundCount || room.status === "finished") {
    room.status = "finished";
    broadcastState(room);
    return;
  }
  room.status = "playing";
  room.round = createInternalRound(room.config, nextNumber);
  broadcastState(room);
}

function leaderboard(room: Room) {
  return [...room.players.values()]
    .map((player) => ({ id: player.id, name: player.name, score: player.score }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

export function toPublicState(options: {
  room: Room;
  playerId?: string;
  playerToken?: string;
  hostToken?: string;
}): PublicRoomState {
  const { room } = options;
  const isHost = Boolean(options.hostToken && options.hostToken === room.hostToken);
  let youPlayer: PlayerRecord | null = null;
  if (options.playerId && options.playerToken) {
    const player = room.players.get(options.playerId);
    if (player && player.token === options.playerToken) {
      youPlayer = player;
      player.lastSeenAt = nowIso();
      player.connected = true;
    }
  }

  const round = room.round;
  const paused = room.status === "paused";
  const showSecrets = round?.phase === "results" && round.resolved !== null;
  const showHints = room.config.hintsEnabled && round !== null;

  let publicRound: PublicRound | null = null;
  if (round) {
    const youSubmission = youPlayer ? round.submissions.get(youPlayer.id) : undefined;
    publicRound = {
      roundNumber: round.roundNumber,
      gridSize: 3,
      monster: {
        trait: round.monster.trait,
        currentPosition: round.monster.currentPosition,
        movementModes: round.monster.movementModes,
        description: TRAIT_DESCRIPTIONS[round.monster.trait],
      },
      bayes: {
        enabled: round.bayes.enabled,
        priorNoticed: round.bayes.priorNoticed,
        clueId: round.bayes.clueId,
        clueText: round.bayes.enabled ? clueText(round.bayes.clueId) : null,
        clueLikelihoodIfNoticed: round.bayes.clueLikelihoodIfNoticed,
        clueLikelihoodIfNotNoticed: round.bayes.clueLikelihoodIfNotNoticed,
      },
      legalSquares: round.legalSquares,
      phase: round.phase,
      deadline: paused ? null : round.phase === "results" ? round.resultsUntil : round.deadline,
      remainingMs:
        round.phase === "results"
          ? remainingMs(round.resultsUntil, false, null)
          : remainingMs(round.deadline, paused, room.pauseRemainingMs),
      paused,
      hints: showHints ? round.correctHitProbabilities : null,
      resolved: showSecrets
        ? {
            destination: round.resolved!.destination,
            sampledModeId: round.resolved!.sampledModeId,
            playerCounts: round.resolved!.playerCounts,
            results: room.config.showStudentCalculations
              ? round.resolved!.results
              : round.resolved!.results.map((result) => ({
                  ...result,
                  estimatedHitProbability: result.playerId === youPlayer?.id ? result.estimatedHitProbability : null,
                  bayesEstimate: result.playerId === youPlayer?.id ? result.bayesEstimate : null,
                  calculationError: result.playerId === youPlayer?.id ? result.calculationError : null,
                  bayesError: result.playerId === youPlayer?.id ? result.bayesError : null,
                })),
            explanation: round.resolved!.explanation,
            explanationSquare: round.resolved!.explanationSquare,
            correctHitProbabilities: round.resolved!.correctHitProbabilities,
            correctBayesPosterior: round.resolved!.correctBayesPosterior,
            hiddenState: round.bayes.hiddenState,
          }
        : null,
    };
    void youSubmission;
  }

  const players = [...room.players.values()].map((player) => ({
    id: player.id,
    name: player.name,
    connected: player.connected,
    hasSubmitted: Boolean(round?.submissions.get(player.id)?.confirmed),
    score: showSecrets || room.status === "finished" || room.status === "lobby" ? player.score : player.score,
  }));

  // During choosing, scores are cumulative from previous rounds — that's OK to show.
  // Selections and counts stay hidden.
  const youSubmission = youPlayer && round ? round.submissions.get(youPlayer.id) : undefined;

  return {
    code: room.code,
    status: room.status,
    config: room.config,
    roundCountPlayed: room.history.length,
    players,
    you: youPlayer
      ? {
          id: youPlayer.id,
          name: youPlayer.name,
          score: youPlayer.score,
          selectedSquare: youSubmission?.selectedSquare ?? null,
          estimatedHitProbability: youSubmission?.estimatedHitProbability ?? null,
          bayesEstimate: youSubmission?.bayesEstimate ?? null,
          confirmed: youSubmission?.confirmed ?? false,
          missedSubmission: youSubmission?.missedSubmission ?? false,
        }
      : null,
    isHost,
    round: publicRound,
    leaderboard:
      room.config.showLeaderboard && (showSecrets || room.status === "finished" || room.status === "lobby")
        ? leaderboard(room)
        : leaderboard(room).map((row) =>
            showSecrets || room.status === "finished" || room.status === "lobby"
              ? row
              : { ...row, score: row.id === youPlayer?.id ? row.score : row.score }
          ),
    error: null,
  };
}

export function sanitizePublicState(state: PublicRoomState): PublicRoomState {
  if (state.round && state.round.phase !== "results") {
    if (state.round.resolved) {
      throw new Error("Hidden resolution leaked before results");
    }
  }
  return state;
}

export function hiddenFieldsAbsent(state: PublicRoomState): string[] {
  const leaks: string[] = [];
  const raw = JSON.stringify(state);
  if (state.round && state.round.phase !== "results") {
    if (raw.includes("correctHitProbabilities") && !state.round.hints) {
      leaks.push("correctHitProbabilities");
    }
    if (raw.includes("hiddenState") && raw.includes('"noticed"')) {
      leaks.push("hiddenState");
    }
    if (raw.includes("playerCounts")) {
      leaks.push("playerCounts");
    }
  }
  return leaks;
}

let tickerStarted = false;
function ensureTicker(): void {
  if (tickerStarted) {
    return;
  }
  tickerStarted = true;
  setInterval(() => {
    for (const room of rooms.values()) {
      tickRoom(room);
    }
    const cutoff = Date.now() - 1000 * 60 * 30;
    for (const [id, practice] of practiceRounds) {
      if (practice.createdAt < cutoff) {
        practiceRounds.delete(id);
      }
    }
  }, 250);
}

export function tickRoom(room: Room): void {
  if (room.status === "paused" || room.status === "lobby" || room.status === "finished") {
    return;
  }
  const round = room.round;
  if (!round) {
    return;
  }
  if (round.phase === "choosing" && Date.now() >= new Date(round.deadline).getTime()) {
    resolveRound(room);
    return;
  }
  if (
    round.phase === "results" &&
    round.resultsUntil &&
    Date.now() >= new Date(round.resultsUntil).getTime()
  ) {
    advanceFromResults(room);
  }
}

export function createPracticeRound(options: {
  hintsEnabled?: boolean;
  bayes?: boolean;
  trait?: MonsterTrait | "auto";
  priorNoticed?: number;
  warningLikelihoodIfNoticed?: number;
  warningLikelihoodIfNotNoticed?: number;
}): {
  practiceId: string;
  state: PublicRoomState;
} {
  const config = normalizeConfig({
    ...DEFAULT_GAME_CONFIG,
    roundCount: 1,
    hintsEnabled: options.hintsEnabled ?? false,
    bayesEnabled: options.bayes ?? false,
    bayesEveryNthRound: 1,
    monsterTrait: options.trait ?? "walker",
    showLeaderboard: false,
    priorNoticed: options.priorNoticed ?? DEFAULT_GAME_CONFIG.priorNoticed,
    warningLikelihoodIfNoticed:
      options.warningLikelihoodIfNoticed ?? DEFAULT_GAME_CONFIG.warningLikelihoodIfNoticed,
    warningLikelihoodIfNotNoticed:
      options.warningLikelihoodIfNotNoticed ??
      DEFAULT_GAME_CONFIG.warningLikelihoodIfNotNoticed,
  });
  const roundNumber = config.bayesEnabled ? config.bayesEveryNthRound : 1;
  const round = createInternalRound(config, roundNumber);
  const practiceId = randomId();
  const roundConfig = toRoundConfig(round);
  practiceRounds.set(practiceId, {
    id: practiceId,
    createdAt: Date.now(),
    round,
    config,
    roundConfig,
  });
  const fakeRoom: Room = {
    code: "PRAC",
    hostId: "practice",
    hostToken: "practice",
    createdAt: nowIso(),
    config,
    status: "playing",
    players: new Map([
      [
        "practice-player",
        {
          id: "practice-player",
          token: "practice",
          name: "You",
          connected: true,
          joinedAt: nowIso(),
          lastSeenAt: nowIso(),
          score: 0,
        },
      ],
    ]),
    round,
    history: [],
    pauseRemainingMs: null,
    listeners: new Set(),
  };
  return {
    practiceId,
    state: toPublicState({
      room: fakeRoom,
      playerId: "practice-player",
      playerToken: "practice",
    }),
  };
}

export function resolvePractice(options: {
  practiceId: string;
  selectedSquare: string;
  estimatedHitProbability: number;
  bayesEstimate: number | null;
  confirm: boolean;
}): PublicRoomState {
  const practice = practiceRounds.get(options.practiceId);
  if (!practice) {
    throw new GameError("That practice round expired. Start a new one.", 404);
  }
  const fakeRoom: Room = {
    code: "PRAC",
    hostId: "practice",
    hostToken: "practice",
    createdAt: nowIso(),
    config: practice.config,
    status: "playing",
    players: new Map([
      [
        "practice-player",
        {
          id: "practice-player",
          token: "practice",
          name: "You",
          connected: true,
          joinedAt: nowIso(),
          lastSeenAt: nowIso(),
          score: 0,
        },
      ],
    ]),
    round: practice.round,
    history: [],
    pauseRemainingMs: null,
    listeners: new Set(),
  };
  submitChoice({
    room: fakeRoom,
    playerId: "practice-player",
    token: "practice",
    selectedSquare: options.selectedSquare,
    estimatedHitProbability: options.estimatedHitProbability,
    bayesEstimate: options.bayesEstimate,
    confirm: options.confirm,
  });
  resolveRound(fakeRoom);
  return toPublicState({
    room: fakeRoom,
    playerId: "practice-player",
    playerToken: "practice",
  });
}
