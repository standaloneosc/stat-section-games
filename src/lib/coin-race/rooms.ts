import { GameError } from "@/lib/game";
import { coinTypePosterior, pickBayesObservation, roundHasBayes } from "./bayes";
import { patternWinProbabilities, pickPatternPair, simulateRace } from "./patterns";
import {
  calculateBayesBonus,
  calculateCorrectChoice,
  calculateCorrectChoicePoints,
  calculateProbabilityPoints,
  calculateRoundScore,
  calculateSpeedPoints,
} from "./scoring";
import {
  DEFAULT_COIN_RACE_CONFIG,
  FAIR_P_HEADS,
  type CoinRaceConfig,
  type CoinRaceEvent,
  type CoinRaceRoom,
  type InternalRound,
  type PatternChoice,
  type PlayerRecord,
  type PlayerRoundResult,
  type PlayerSubmission,
  type PublicCoinRaceState,
  type ScoringConfig,
} from "./types";

const globalStore = globalThis as unknown as {
  coinRaceRooms?: Map<string, CoinRaceRoom>;
  coinRacePractice?: Map<string, PracticeRound>;
};

export const rooms: Map<string, CoinRaceRoom> =
  globalStore.coinRaceRooms ?? new Map<string, CoinRaceRoom>();
globalStore.coinRaceRooms = rooms;

type PracticeRound = {
  id: string;
  createdAt: number;
  round: InternalRound;
  config: CoinRaceConfig;
};

export const practiceRounds: Map<string, PracticeRound> =
  globalStore.coinRacePractice ?? new Map<string, PracticeRound>();
globalStore.coinRacePractice = practiceRounds;

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
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)]!;
  }
  return code;
}

function remainingMs(
  deadline: string | null,
  paused: boolean,
  pauseRemaining: number | null
): number {
  if (paused && pauseRemaining !== null) {
    return Math.max(0, pauseRemaining);
  }
  if (!deadline) return 0;
  return Math.max(0, new Date(deadline).getTime() - Date.now());
}

export function emit(room: CoinRaceRoom, event: CoinRaceEvent): void {
  for (const listener of room.listeners) {
    listener(event);
  }
}

export function subscribe(
  code: string,
  listener: (event: CoinRaceEvent) => void
): () => void {
  const room = rooms.get(code.toUpperCase());
  if (!room) return () => undefined;
  room.listeners.add(listener);
  return () => {
    room.listeners.delete(listener);
  };
}

function broadcastState(room: CoinRaceRoom): void {
  emit(room, { type: "round:state", payload: null });
}

export function normalizeConfig(config: CoinRaceConfig): CoinRaceConfig {
  const bayesMode = (
    ["off", "everyRound", "everyThirdRound", "finalRoundOnly"] as const
  ).includes(config.bayesMode)
    ? config.bayesMode
    : "off";
  return {
    decisionTimeSeconds: clampInt(config.decisionTimeSeconds, 15, 600),
    correctChoicePoints: clampInt(config.correctChoicePoints, 0, 500),
    probabilityPoints: clampInt(config.probabilityPoints, 0, 500),
    speedPoints: clampInt(config.speedPoints, 0, 200),
    bayesBonusPoints: clampInt(config.bayesBonusPoints, 0, 200),
    choiceTieTolerance: clampTolerance(config.choiceTieTolerance),
    bayesMode,
    roundCount: clampInt(config.roundCount, 1, 12),
    resultsDurationSeconds: clampInt(config.resultsDurationSeconds, 10, 180),
  };
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function clampTolerance(value: number): number {
  if (!Number.isFinite(value)) return 0.01;
  return Math.min(0.5, Math.max(0, value));
}

export function createRoom(options: {
  hostName: string;
  config?: Partial<CoinRaceConfig>;
}): { room: CoinRaceRoom; hostId: string; hostToken: string } {
  let code = randomCode();
  while (rooms.has(code)) {
    code = randomCode();
  }
  const hostId = randomId();
  const hostToken = randomId();
  const room: CoinRaceRoom = {
    code,
    hostId,
    hostToken,
    createdAt: nowIso(),
    config: normalizeConfig({ ...DEFAULT_COIN_RACE_CONFIG, ...options.config }),
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

export function getRoom(code: string): CoinRaceRoom | undefined {
  return rooms.get(code.toUpperCase());
}

export function assertHost(room: CoinRaceRoom, hostToken: string): void {
  if (!hostToken || hostToken !== room.hostToken) {
    throw new GameError("This browser is not the host for this room.", 403);
  }
}

export function assertPlayer(
  room: CoinRaceRoom,
  playerId: string,
  token: string
): PlayerRecord {
  const player = room.players.get(playerId);
  if (!player || player.token !== token) {
    throw new GameError("We could not match that player to this room.", 403);
  }
  player.connected = true;
  player.lastSeenAt = nowIso();
  return player;
}

export function joinRoom(options: {
  code: string;
  name: string;
  playerId?: string;
  token?: string;
}): { room: CoinRaceRoom; player: PlayerRecord; token: string } {
  const room = getRoom(options.code);
  if (!room) {
    throw new GameError("Room not found. Check the code and try again.", 404);
  }
  const name = options.name.trim();
  if (name.length < 1 || name.length > 24) {
    throw new GameError("Enter a display name up to 24 characters.", 400);
  }
  if (options.playerId && options.token) {
    const existing = room.players.get(options.playerId);
    if (existing && existing.token === options.token) {
      existing.name = name;
      existing.connected = true;
      existing.lastSeenAt = nowIso();
      broadcastState(room);
      return { room, player: existing, token: existing.token };
    }
  }
  if (room.status === "finished") {
    throw new GameError("That game has already finished.", 409);
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
  return { room, player, token: player.token };
}

export function updateConfig(
  room: CoinRaceRoom,
  hostToken: string,
  patch: Partial<CoinRaceConfig>
): CoinRaceConfig {
  assertHost(room, hostToken);
  if (room.status === "playing" || room.status === "paused") {
    const next = normalizeConfig({ ...room.config, ...patch });
    const timingOnly =
      next.roundCount === room.config.roundCount &&
      next.correctChoicePoints === room.config.correctChoicePoints &&
      next.probabilityPoints === room.config.probabilityPoints &&
      next.speedPoints === room.config.speedPoints &&
      next.bayesBonusPoints === room.config.bayesBonusPoints &&
      next.choiceTieTolerance === room.config.choiceTieTolerance &&
      next.bayesMode === room.config.bayesMode &&
      next.resultsDurationSeconds === room.config.resultsDurationSeconds;
    if (!timingOnly) {
      throw new GameError("Pause and return to the lobby before changing scoring rules.", 409);
    }
    room.config = next;
    broadcastState(room);
    return room.config;
  }
  room.config = normalizeConfig({ ...room.config, ...patch });
  broadcastState(room);
  return room.config;
}

export function createInternalRound(
  config: CoinRaceConfig,
  roundNumber: number,
  rng: () => number = Math.random
): InternalRound {
  const pair = pickPatternPair(roundNumber);
  const { pA, pB } = patternWinProbabilities(pair.patternA, pair.patternB, {
    pHeads: FAIR_P_HEADS,
    suffix: pair.suffix,
  });
  const bayesEnabled = roundHasBayes(config.bayesMode, roundNumber, config.roundCount);
  const bayesObservation = bayesEnabled ? pickBayesObservation(roundNumber) : null;
  const correctBayesPosterior = bayesObservation
    ? coinTypePosterior(bayesObservation, { target: "B" })
    : null;
  const startedAt = nowIso();
  const deadline = new Date(Date.now() + config.decisionTimeSeconds * 1000).toISOString();
  return {
    roundNumber,
    patternA: pair.patternA,
    patternB: pair.patternB,
    suffix: pair.suffix,
    pHeads: FAIR_P_HEADS,
    patternAProbability: pA,
    patternBProbability: pB,
    bayesEnabled,
    bayesObservation,
    correctBayesPosterior,
    hiddenCoinType: bayesEnabled ? (rng() < 0.5 ? "B" : "F") : null,
    phase: "choosing",
    startedAt,
    deadline,
    resultsUntil: null,
    submissions: new Map(),
    resolved: null,
  };
}

export function startGame(room: CoinRaceRoom, hostToken: string): void {
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

export function pauseGame(room: CoinRaceRoom, hostToken: string): void {
  assertHost(room, hostToken);
  if (room.status !== "playing" || !room.round || room.round.phase !== "choosing") {
    throw new GameError("Nothing is in play to pause.", 409);
  }
  room.status = "paused";
  room.pauseRemainingMs = remainingMs(room.round.deadline, false, null);
  broadcastState(room);
}

export function resumeGame(room: CoinRaceRoom, hostToken: string): void {
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

export function endRoundNow(room: CoinRaceRoom, hostToken: string): void {
  assertHost(room, hostToken);
  if (!room.round || room.round.phase !== "choosing") {
    throw new GameError("No open round to end.", 409);
  }
  resolveRound(room);
}

export function nextRound(room: CoinRaceRoom, hostToken: string): void {
  assertHost(room, hostToken);
  advanceFromResults(room, true);
}

export function endGame(room: CoinRaceRoom, hostToken: string): void {
  assertHost(room, hostToken);
  if (room.round?.phase === "choosing") {
    resolveRound(room);
  }
  room.status = "finished";
  emit(room, { type: "game:leaderboard", payload: leaderboard(room) });
  broadcastState(room);
}

export function submitChoice(options: {
  room: CoinRaceRoom;
  playerId: string;
  token: string;
  chosenPattern: PatternChoice;
  estimatedWinProbability: number;
  bayesEstimate: number | null;
  confirm: boolean;
  now?: Date;
}): PlayerSubmission {
  const { room } = options;
  const player = assertPlayer(room, options.playerId, options.token);
  const round = room.round;
  if (!round || round.phase !== "choosing" || room.status === "finished") {
    throw new GameError("Submissions are closed for this round.", 409);
  }
  if (room.status !== "paused") {
    if ((options.now ?? new Date()).getTime() >= new Date(round.deadline).getTime()) {
      throw new GameError("Time is up. Late submissions are locked.", 409);
    }
  }
  if (!options.confirm) {
    throw new GameError("Confirm your pattern and probability before locking in.", 400);
  }
  if (options.chosenPattern !== "A" && options.chosenPattern !== "B") {
    throw new GameError("Choose Pattern A or Pattern B.", 400);
  }
  if (
    !Number.isFinite(options.estimatedWinProbability) ||
    options.estimatedWinProbability < 0 ||
    options.estimatedWinProbability > 1
  ) {
    throw new GameError("Enter a probability between 0 and 100.", 400);
  }
  if (round.bayesEnabled) {
    if (
      options.bayesEstimate === null ||
      !Number.isFinite(options.bayesEstimate) ||
      options.bayesEstimate < 0 ||
      options.bayesEstimate > 1
    ) {
      throw new GameError("Enter P(biased coin | the observed flips) between 0 and 100.", 400);
    }
  }
  const existing = round.submissions.get(player.id);
  if (existing?.confirmed) {
    throw new GameError("Your answer is already locked for this round.", 409);
  }
  const submission: PlayerSubmission = {
    playerId: player.id,
    chosenPattern: options.chosenPattern,
    estimatedWinProbability: options.estimatedWinProbability,
    bayesEstimate: round.bayesEnabled ? options.bayesEstimate : null,
    submittedAt: nowIso(options.now),
    confirmed: true,
    missedSubmission: false,
  };
  round.submissions.set(player.id, submission);
  emit(room, { type: "round:locked", payload: null });
  broadcastState(room);
  return submission;
}

function emptyScore(): ReturnType<typeof calculateRoundScore> {
  return calculateRoundScore({
    correctChoicePoints: 0,
    probabilityPoints: 0,
    speedPoints: 0,
    bayesBonus: 0,
  });
}

function scoreSubmission(
  round: InternalRound,
  config: ScoringConfig,
  player: PlayerRecord,
  submission: PlayerSubmission | undefined
): PlayerRoundResult {
  if (!submission || !submission.confirmed || submission.missedSubmission) {
    return {
      playerId: player.id,
      name: player.name,
      chosenPattern: submission?.chosenPattern ?? null,
      estimatedWinProbability: submission?.estimatedWinProbability ?? null,
      bayesEstimate: submission?.bayesEstimate ?? null,
      missedSubmission: true,
      score: emptyScore(),
      cumulativeScore: player.score,
    };
  }
  const selectedProbability =
    submission.chosenPattern === "A" ? round.patternAProbability : round.patternBProbability;
  const score = calculateRoundScore({
    correctChoicePoints: calculateCorrectChoicePoints(
      round.patternAProbability,
      round.patternBProbability,
      submission.chosenPattern,
      config
    ),
    probabilityPoints: calculateProbabilityPoints(
      submission.estimatedWinProbability,
      selectedProbability,
      config.probabilityPoints
    ),
    speedPoints: calculateSpeedPoints(
      submission.submittedAt,
      round.startedAt,
      config.decisionTimeSeconds,
      config.speedPoints
    ),
    bayesBonus: calculateBayesBonus(
      submission.bayesEstimate,
      round.correctBayesPosterior,
      config.bayesBonusPoints
    ),
  });
  return {
    playerId: player.id,
    name: player.name,
    chosenPattern: submission.chosenPattern,
    estimatedWinProbability: submission.estimatedWinProbability,
    bayesEstimate: submission.bayesEstimate,
    missedSubmission: false,
    score,
    cumulativeScore: player.score + score.total,
  };
}

export function resolveRound(room: CoinRaceRoom, rng: () => number = Math.random): void {
  const round = room.round;
  if (!round || round.phase !== "choosing") {
    throw new GameError("This round is not open to resolve.", 409);
  }
  const simulated = simulateRace(round.patternA, round.patternB, {
    suffix: round.suffix,
    pHeads: round.pHeads,
    rng,
  });
  const correctChoice = calculateCorrectChoice(
    round.patternAProbability,
    round.patternBProbability,
    room.config.choiceTieTolerance
  );
  const results: PlayerRoundResult[] = [];
  for (const player of room.players.values()) {
    const result = scoreSubmission(
      round,
      room.config,
      player,
      round.submissions.get(player.id)
    );
    player.score = result.cumulativeScore;
    results.push(result);
  }
  round.resolved = {
    winner: simulated.winner,
    flips: simulated.flips,
    sequence: simulated.sequence,
    patternAProbability: round.patternAProbability,
    patternBProbability: round.patternBProbability,
    correctChoice,
    correctBayesPosterior: round.correctBayesPosterior,
    hiddenCoinType: round.hiddenCoinType,
    results,
  };
  round.phase = "results";
  round.resultsUntil = new Date(
    Date.now() + room.config.resultsDurationSeconds * 1000
  ).toISOString();
  room.history.push({
    roundNumber: round.roundNumber,
    patternA: round.patternA,
    patternB: round.patternB,
    winner: simulated.winner,
    results,
  });
  emit(room, { type: "round:resolved", payload: null });
  broadcastState(room);
}

function advanceFromResults(room: CoinRaceRoom, force = false): void {
  if (room.status === "finished") return;
  const round = room.round;
  if (!round || round.phase !== "results") {
    if (!force) return;
    throw new GameError("Results are not ready for the next round.", 409);
  }
  if (round.roundNumber >= room.config.roundCount) {
    room.status = "finished";
    room.round = null;
    emit(room, { type: "game:leaderboard", payload: leaderboard(room) });
    broadcastState(room);
    return;
  }
  room.round = createInternalRound(room.config, round.roundNumber + 1);
  broadcastState(room);
}

function leaderboard(room: CoinRaceRoom) {
  return [...room.players.values()]
    .map((player) => ({ id: player.id, name: player.name, score: player.score }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

export function toPublicState(options: {
  room: CoinRaceRoom;
  playerId?: string;
  playerToken?: string;
  hostToken?: string;
}): PublicCoinRaceState {
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
  let publicRound = null;
  if (round) {
    const youSubmission = youPlayer ? round.submissions.get(youPlayer.id) : undefined;
    publicRound = {
      roundNumber: round.roundNumber,
      patternA: round.patternA,
      patternB: round.patternB,
      suffix: round.suffix,
      bayesEnabled: round.bayesEnabled,
      bayesObservation: round.bayesObservation,
      bayesPrompt: round.bayesEnabled
        ? `P(biased coin | ${round.bayesObservation ?? "flips"})`
        : null,
      phase: round.phase,
      deadline: paused ? null : round.phase === "results" ? round.resultsUntil : round.deadline,
      remainingMs:
        round.phase === "results"
          ? remainingMs(round.resultsUntil, false, null)
          : remainingMs(round.deadline, paused, room.pauseRemainingMs),
      paused,
      resolved: showSecrets
        ? {
            winner: round.resolved!.winner,
            flips: round.resolved!.flips,
            sequence: round.resolved!.sequence,
            patternAProbability: round.resolved!.patternAProbability,
            patternBProbability: round.resolved!.patternBProbability,
            correctChoice: round.resolved!.correctChoice,
            correctBayesPosterior: round.resolved!.correctBayesPosterior,
            hiddenCoinType: round.resolved!.hiddenCoinType,
            results: round.resolved!.results,
          }
        : null,
    };
    void youSubmission;
  }
  const youSubmission =
    youPlayer && round ? round.submissions.get(youPlayer.id) : undefined;
  return {
    code: room.code,
    status: room.status,
    config: room.config,
    roundCountPlayed: room.history.length,
    players: [...room.players.values()].map((player) => ({
      id: player.id,
      name: player.name,
      connected: player.connected,
      hasSubmitted: Boolean(round?.submissions.get(player.id)?.confirmed),
      score: player.score,
    })),
    you: youPlayer
      ? {
          id: youPlayer.id,
          name: youPlayer.name,
          score: youPlayer.score,
          chosenPattern: youSubmission?.chosenPattern ?? null,
          estimatedWinProbability: youSubmission?.estimatedWinProbability ?? null,
          bayesEstimate: youSubmission?.bayesEstimate ?? null,
          confirmed: youSubmission?.confirmed ?? false,
          missedSubmission: youSubmission?.missedSubmission ?? false,
        }
      : null,
    isHost,
    round: publicRound,
    leaderboard: leaderboard(room),
    error: null,
  };
}

export function tickRoom(room: CoinRaceRoom): void {
  if (room.status === "paused" || room.status === "lobby" || room.status === "finished") {
    return;
  }
  const round = room.round;
  if (!round) return;
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

let tickerStarted = false;
function ensureTicker(): void {
  if (tickerStarted) return;
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

export function createPracticeRound(options: {
  bayesMode?: ScoringConfig["bayesMode"];
  decisionTimeSeconds?: number;
  roundNumber?: number;
}): { practiceId: string; state: PublicCoinRaceState } {
  const config = normalizeConfig({
    ...DEFAULT_COIN_RACE_CONFIG,
    roundCount: 1,
    bayesMode: options.bayesMode ?? "off",
    decisionTimeSeconds: options.decisionTimeSeconds ?? 180,
  });
  const round = createInternalRound(config, options.roundNumber ?? 1);
  const practiceId = randomId();
  practiceRounds.set(practiceId, {
    id: practiceId,
    createdAt: Date.now(),
    round,
    config,
  });
  const fakeRoom = practiceRoom(practiceId, round, config);
  return {
    practiceId,
    state: toPublicState({
      room: fakeRoom,
      playerId: "practice-player",
      playerToken: "practice",
    }),
  };
}

function practiceRoom(
  _practiceId: string,
  round: InternalRound,
  config: CoinRaceConfig
): CoinRaceRoom {
  return {
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
}

export function resolvePractice(options: {
  practiceId: string;
  chosenPattern: PatternChoice;
  estimatedWinProbability: number;
  bayesEstimate: number | null;
  confirm?: boolean;
}): PublicCoinRaceState {
  const practice = practiceRounds.get(options.practiceId);
  if (!practice) {
    throw new GameError("That practice round expired. Start a new one.", 404);
  }
  const room = practiceRoom(practice.id, practice.round, practice.config);
  submitChoice({
    room,
    playerId: "practice-player",
    token: "practice",
    chosenPattern: options.chosenPattern,
    estimatedWinProbability: options.estimatedWinProbability,
    bayesEstimate: options.bayesEstimate,
    confirm: options.confirm ?? true,
  });
  resolveRound(room);
  practice.round = room.round!;
  return toPublicState({
    room,
    playerId: "practice-player",
    playerToken: "practice",
  });
}
