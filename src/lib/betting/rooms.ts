import { GameError } from "@/lib/game";
import { isAnswerCorrect, type PlayerAnswer } from "./grade";
import { applyPayout, clampBalance, clampBet, MAX_BET, STARTING_BALANCE } from "./payout";
import { formatAnswerKey, getQuestion, publicQuestionCatalog } from "./questions";
import {
  DEFAULT_BETTING_CONFIG,
  type BalanceLogEntry,
  type BettingConfig,
  type BettingEvent,
  type BettingRoom,
  type GradedSubmission,
  type PlayerRecord,
  type PublicBettingState,
  type PublicYourResult,
} from "./types";

const globalStore = globalThis as unknown as {
  bettingRooms?: Map<string, BettingRoom>;
  bettingPractice?: Map<string, PracticeSession>;
};

export const rooms: Map<string, BettingRoom> =
  globalStore.bettingRooms ?? new Map<string, BettingRoom>();
globalStore.bettingRooms = rooms;

type PracticeResult = PublicYourResult & { balanceAfter: number };

type PracticeSession = {
  id: string;
  createdAt: number;
  balance: number;
  results: Map<number, PracticeResult>;
};

export const practiceSessions: Map<string, PracticeSession> =
  globalStore.bettingPractice ?? new Map<string, PracticeSession>();
globalStore.bettingPractice = practiceSessions;

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

function submissionKey(playerId: string, questionId: number): string {
  return `${playerId}:${questionId}`;
}

export function emit(room: BettingRoom, event: BettingEvent): void {
  for (const listener of room.listeners) {
    listener(event);
  }
}

export function subscribe(code: string, listener: (event: BettingEvent) => void): () => void {
  const room = rooms.get(code.toUpperCase());
  if (!room) return () => undefined;
  room.listeners.add(listener);
  return () => {
    room.listeners.delete(listener);
  };
}

function broadcastState(room: BettingRoom): void {
  emit(room, { type: "round:state", payload: null });
}

export function normalizeConfig(config: BettingConfig & { decisionTimeSeconds?: number }): BettingConfig {
  const seconds = config.timeLimitSeconds ?? config.decisionTimeSeconds ?? DEFAULT_BETTING_CONFIG.timeLimitSeconds;
  return {
    timeLimitSeconds: clampInt(seconds, 30, 3600),
    startingBalance: STARTING_BALANCE,
    maxBet: MAX_BET,
  };
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function createRoom(options: {
  hostName: string;
  config?: Partial<BettingConfig> & { decisionTimeSeconds?: number };
}): { room: BettingRoom; hostId: string; hostToken: string } {
  let code = randomCode();
  while (rooms.has(code)) {
    code = randomCode();
  }
  const hostId = randomId();
  const hostToken = randomId();
  const room: BettingRoom = {
    code,
    hostId,
    hostToken,
    createdAt: nowIso(),
    config: normalizeConfig({ ...DEFAULT_BETTING_CONFIG, ...options.config }),
    status: "lobby",
    players: new Map(),
    startedAt: null,
    deadline: null,
    pauseRemainingMs: null,
    submissions: new Map(),
    balanceLog: [],
    listeners: new Set(),
  };
  rooms.set(code, room);
  ensureTicker();
  return { room, hostId, hostToken };
}

export function getRoom(code: string): BettingRoom | undefined {
  return rooms.get(code.toUpperCase());
}

export function assertHost(room: BettingRoom, hostToken: string): void {
  if (!hostToken || hostToken !== room.hostToken) {
    throw new GameError("This browser is not the host for this room.", 403);
  }
}

export function assertPlayer(room: BettingRoom, playerId: string, token: string): PlayerRecord {
  const player = room.players.get(playerId);
  if (!player || player.token !== token) {
    throw new GameError("We could not match that group to this room.", 403);
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
}): { room: BettingRoom; player: PlayerRecord; token: string } {
  const room = getRoom(options.code);
  if (!room) {
    throw new GameError("Room not found. Check the code and try again.", 404);
  }
  const name = options.name.trim();
  if (name.length < 1 || name.length > 32) {
    throw new GameError("Enter a group name up to 32 characters.", 400);
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
    balance: room.config.startingBalance,
  };
  room.players.set(player.id, player);
  broadcastState(room);
  return { room, player, token: player.token };
}

export function updateConfig(
  room: BettingRoom,
  hostToken: string,
  patch: Partial<BettingConfig> & { decisionTimeSeconds?: number }
): BettingConfig {
  assertHost(room, hostToken);
  const next = normalizeConfig({ ...room.config, ...patch });
  if (room.status === "lobby") {
    room.config = next;
    broadcastState(room);
    return room.config;
  }
  if (room.status === "paused") {
    room.config = next;
    room.pauseRemainingMs = next.timeLimitSeconds * 1000;
    broadcastState(room);
    return room.config;
  }
  throw new GameError("Pause or return to the lobby before changing the time limit.", 409);
}

function answeredCount(room: BettingRoom, playerId: string): number {
  let count = 0;
  for (const submission of room.submissions.values()) {
    if (submission.playerId === playerId) count += 1;
  }
  return count;
}

export function startGame(room: BettingRoom, hostToken: string): void {
  assertHost(room, hostToken);
  if (room.players.size < 1) {
    throw new GameError("Wait for at least one group to join before starting.", 400);
  }
  if (room.status === "finished") {
    throw new GameError("This round already ended.", 409);
  }
  if (room.status === "playing") {
    return;
  }
  room.status = "playing";
  room.pauseRemainingMs = null;
  room.startedAt = nowIso();
  room.deadline = new Date(Date.now() + room.config.timeLimitSeconds * 1000).toISOString();
  broadcastState(room);
}

export function pauseGame(room: BettingRoom, hostToken: string): void {
  assertHost(room, hostToken);
  if (room.status !== "playing") {
    throw new GameError("Nothing is in play to pause.", 409);
  }
  room.status = "paused";
  room.pauseRemainingMs = remainingMs(room.deadline, false, null);
  broadcastState(room);
}

export function resumeGame(room: BettingRoom, hostToken: string): void {
  assertHost(room, hostToken);
  if (room.status !== "paused") {
    throw new GameError("The clock is not paused.", 409);
  }
  const leftover = room.pauseRemainingMs ?? remainingMs(room.deadline, true, room.pauseRemainingMs);
  room.status = "playing";
  room.deadline = new Date(Date.now() + leftover).toISOString();
  room.pauseRemainingMs = null;
  broadcastState(room);
}

function freezeRoom(room: BettingRoom): void {
  if (room.status === "finished") return;
  room.status = "finished";
  room.pauseRemainingMs = 0;
  room.deadline = nowIso();
  emit(room, { type: "round:locked", payload: null });
  broadcastState(room);
}

export function endGame(room: BettingRoom, hostToken: string): void {
  assertHost(room, hostToken);
  freezeRoom(room);
}

export function submitAnswer(options: {
  room: BettingRoom;
  playerId: string;
  token: string;
  questionId: number;
  bet: number;
  answer: PlayerAnswer;
}): GradedSubmission {
  const { room } = options;
  const player = assertPlayer(room, options.playerId, options.token);
  if (room.status === "paused") {
    throw new GameError("The host paused the clock. Wait for resume.", 409);
  }
  if (room.status !== "playing") {
    throw new GameError("The round is not open for bets.", 409);
  }
  if (remainingMs(room.deadline, false, null) <= 0) {
    freezeRoom(room);
    throw new GameError("Time is up. Balances are frozen.", 409);
  }
  const question = getQuestion(options.questionId);
  const key = submissionKey(player.id, question.id);
  if (room.submissions.has(key)) {
    throw new GameError("This group already locked in on that question.", 409);
  }
  let bet: number;
  try {
    bet = clampBet(options.bet, Math.min(player.balance, room.config.maxBet));
  } catch (error) {
    throw new GameError(error instanceof Error ? error.message : "Invalid bet.", 400);
  }
  const correct = isAnswerCorrect(question, options.answer);
  const payout = applyPayout(player.balance, bet, question.multiplier, correct);
  player.balance = clampBalance(payout.nextBalance);
  const graded: GradedSubmission = {
    playerId: player.id,
    questionId: question.id,
    bet,
    answer: options.answer,
    correct,
    delta: payout.delta,
    balanceAfter: player.balance,
    submittedAt: nowIso(),
    correctKey: formatAnswerKey(question),
  };
  room.submissions.set(key, graded);
  emit(room, { type: "game:leaderboard", payload: null });
  broadcastState(room);
  return graded;
}

export function adjustBalance(options: {
  room: BettingRoom;
  hostToken: string;
  playerId: string;
  amount: number;
  note?: string;
}): BalanceLogEntry {
  const { room } = options;
  assertHost(room, options.hostToken);
  if (!Number.isFinite(options.amount) || options.amount === 0) {
    throw new GameError("Enter a nonzero amount to give or take.", 400);
  }
  const player = room.players.get(options.playerId);
  if (!player) {
    throw new GameError("That group is not in this room.", 404);
  }
  player.balance = clampBalance(player.balance + options.amount);
  const entry: BalanceLogEntry = {
    at: nowIso(),
    playerId: player.id,
    name: player.name,
    amount: options.amount,
    balanceAfter: player.balance,
    note: options.note?.trim() || (options.amount > 0 ? "Host granted points" : "Host took points"),
  };
  room.balanceLog.unshift(entry);
  emit(room, { type: "game:leaderboard", payload: null });
  broadcastState(room);
  return entry;
}

function leaderboard(room: BettingRoom) {
  return [...room.players.values()]
    .map((player) => ({
      id: player.id,
      name: player.name,
      balance: player.balance,
      answeredCount: answeredCount(room, player.id),
    }))
    .sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name));
}

function resultsFor(room: BettingRoom, playerId: string): PublicYourResult[] {
  const rows: PublicYourResult[] = [];
  for (const submission of room.submissions.values()) {
    if (submission.playerId !== playerId) continue;
    rows.push({
      questionId: submission.questionId,
      bet: submission.bet,
      correct: submission.correct,
      delta: submission.delta,
      correctKey: submission.correctKey,
    });
  }
  return rows.sort((a, b) => a.questionId - b.questionId);
}

export function toPublicState(options: {
  room: BettingRoom;
  playerId?: string;
  playerToken?: string;
  hostToken?: string;
}): PublicBettingState {
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
  const paused = room.status === "paused";
  const frozen = room.status === "finished";
  const yourResults = youPlayer ? resultsFor(room, youPlayer.id) : [];
  const yoursByQuestion = new Map(yourResults.map((row) => [row.questionId, row]));
  const answeredByCount = new Map<number, number>();
  for (const submission of room.submissions.values()) {
    answeredByCount.set(submission.questionId, (answeredByCount.get(submission.questionId) ?? 0) + 1);
  }

  return {
    code: room.code,
    status: room.status,
    config: room.config,
    players: [...room.players.values()].map((player) => ({
      id: player.id,
      name: player.name,
      connected: player.connected,
      answeredCount: answeredCount(room, player.id),
      balance: player.balance,
    })),
    you: youPlayer
      ? {
          id: youPlayer.id,
          name: youPlayer.name,
          balance: youPlayer.balance,
          answeredCount: answeredCount(room, youPlayer.id),
          results: yourResults,
        }
      : null,
    isHost,
    startedAt: room.startedAt,
    deadline: paused || frozen ? null : room.deadline,
    remainingMs: frozen ? 0 : remainingMs(room.deadline, paused, room.pauseRemainingMs),
    paused,
    frozen,
    grid: publicQuestionCatalog().map((item) => ({
      ...item,
      answered: yoursByQuestion.has(item.id),
      yourResult: yoursByQuestion.get(item.id) ?? null,
      answeredByCount: answeredByCount.get(item.id) ?? 0,
    })),
    leaderboard: leaderboard(room),
    balanceLog: isHost ? room.balanceLog.slice(0, 20) : [],
    error: null,
  };
}

export function tickRoom(room: BettingRoom): void {
  if (room.status !== "playing") return;
  if (remainingMs(room.deadline, false, null) <= 0) {
    freezeRoom(room);
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
    for (const [id, session] of practiceSessions) {
      if (session.createdAt < cutoff) practiceSessions.delete(id);
    }
  }, 250);
}

export type PracticeState = {
  practiceId: string;
  balance: number;
  catalog: ReturnType<typeof publicQuestionCatalog>;
  grid: PublicBettingState["grid"];
};

function practiceGrid(session: PracticeSession): PublicBettingState["grid"] {
  return publicQuestionCatalog().map((item) => {
    const result = session.results.get(item.id) ?? null;
    return {
      ...item,
      answered: Boolean(result),
      yourResult: result
        ? {
            questionId: result.questionId,
            bet: result.bet,
            correct: result.correct,
            delta: result.delta,
            correctKey: result.correctKey,
          }
        : null,
      answeredByCount: result ? 1 : 0,
    };
  });
}

export function createPractice(): PracticeState {
  const id = randomId();
  const session: PracticeSession = {
    id,
    createdAt: Date.now(),
    balance: STARTING_BALANCE,
    results: new Map(),
  };
  practiceSessions.set(id, session);
  return {
    practiceId: id,
    balance: session.balance,
    catalog: publicQuestionCatalog(),
    grid: practiceGrid(session),
  };
}

export function resolvePractice(options: {
  practiceId: string;
  questionId: number;
  bet: number;
  answer: PlayerAnswer;
}): PracticeState {
  const session = practiceSessions.get(options.practiceId);
  if (!session) {
    throw new GameError("That practice session expired. Start a new one.", 404);
  }
  const question = getQuestion(options.questionId);
  if (session.results.has(question.id)) {
    throw new GameError("You already locked in on that question.", 409);
  }
  let bet: number;
  try {
    bet = clampBet(options.bet, Math.min(session.balance, MAX_BET));
  } catch (error) {
    throw new GameError(error instanceof Error ? error.message : "Invalid bet.", 400);
  }
  const correct = isAnswerCorrect(question, options.answer);
  const payout = applyPayout(session.balance, bet, question.multiplier, correct);
  session.balance = clampBalance(payout.nextBalance);
  session.results.set(question.id, {
    questionId: question.id,
    bet,
    correct,
    delta: payout.delta,
    correctKey: formatAnswerKey(question),
    balanceAfter: session.balance,
  });
  return {
    practiceId: session.id,
    balance: session.balance,
    catalog: publicQuestionCatalog(),
    grid: practiceGrid(session),
  };
}

