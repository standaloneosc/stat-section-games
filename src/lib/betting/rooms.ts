import { GameError } from "@/lib/game";
import { isAnswerCorrect, type PlayerAnswer } from "./grade";
import { applyPayout, clampBalance, clampBet, MAX_BET, STARTING_BALANCE } from "./payout";
import {
  formatAnswerKey,
  getQuestion,
  publicQuestionCatalog,
  QUESTIONS,
  toPublicQuestion,
} from "./questions";
import {
  DEFAULT_BETTING_CONFIG,
  type BalanceLogEntry,
  type BettingConfig,
  type BettingEvent,
  type BettingRoom,
  type InternalQuestionRound,
  type PlayerQuestionResult,
  type PlayerRecord,
  type PublicBettingState,
  type PublicQuestionListItem,
} from "./types";

const globalStore = globalThis as unknown as {
  bettingRooms?: Map<string, BettingRoom>;
  bettingPractice?: Map<string, PracticeAttempt>;
};

export const rooms: Map<string, BettingRoom> =
  globalStore.bettingRooms ?? new Map<string, BettingRoom>();
globalStore.bettingRooms = rooms;

type PracticeAttempt = {
  id: string;
  createdAt: number;
  questionId: number;
  balance: number;
  resolved: {
    correct: boolean;
    bet: number;
    delta: number;
    balanceAfter: number;
    correctKey: string;
  } | null;
};

export const practiceAttempts: Map<string, PracticeAttempt> =
  globalStore.bettingPractice ?? new Map<string, PracticeAttempt>();
globalStore.bettingPractice = practiceAttempts;

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

export function normalizeConfig(config: BettingConfig): BettingConfig {
  return {
    decisionTimeSeconds: clampInt(config.decisionTimeSeconds, 15, 900),
    startingBalance: STARTING_BALANCE,
    maxBet: MAX_BET,
    resultsDurationSeconds: clampInt(config.resultsDurationSeconds, 10, 180),
  };
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function createRoom(options: {
  hostName: string;
  config?: Partial<BettingConfig>;
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
    current: null,
    answeredQuestionIds: [],
    pauseRemainingMs: null,
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
  patch: Partial<BettingConfig>
): BettingConfig {
  assertHost(room, hostToken);
  const next = normalizeConfig({ ...room.config, ...patch });
  if ((room.status === "playing" || room.status === "paused") && room.current?.phase === "choosing") {
    room.config = next;
    const remaining = remainingMs(room.current.deadline, room.status === "paused", room.pauseRemainingMs);
    room.current.deadline = new Date(Date.now() + remaining).toISOString();
    broadcastState(room);
    return room.config;
  }
  room.config = next;
  broadcastState(room);
  return room.config;
}

function openQuestion(room: BettingRoom, questionId: number): InternalQuestionRound {
  getQuestion(questionId);
  const startedAt = nowIso();
  const deadline = new Date(Date.now() + room.config.decisionTimeSeconds * 1000).toISOString();
  return {
    questionId,
    phase: "choosing",
    startedAt,
    deadline,
    resultsUntil: null,
    submissions: new Map(),
    revealed: null,
  };
}

function nextUnansweredId(room: BettingRoom): number | null {
  const answered = new Set(room.answeredQuestionIds);
  if (room.current && room.current.phase === "revealed") {
    answered.add(room.current.questionId);
  }
  const found = QUESTIONS.find((question) => !answered.has(question.id));
  return found?.id ?? null;
}

export function startGame(room: BettingRoom, hostToken: string, questionId?: number): void {
  assertHost(room, hostToken);
  if (room.players.size < 1) {
    throw new GameError("Wait for at least one group to join before starting.", 400);
  }
  const id = questionId ?? 1;
  room.status = "playing";
  room.pauseRemainingMs = null;
  room.current = openQuestion(room, id);
  broadcastState(room);
}

export function pauseGame(room: BettingRoom, hostToken: string): void {
  assertHost(room, hostToken);
  if (room.status !== "playing" || !room.current || room.current.phase !== "choosing") {
    throw new GameError("Nothing is in play to pause.", 409);
  }
  room.status = "paused";
  room.pauseRemainingMs = remainingMs(room.current.deadline, false, null);
  broadcastState(room);
}

export function resumeGame(room: BettingRoom, hostToken: string): void {
  assertHost(room, hostToken);
  if (room.status !== "paused" || !room.current) {
    throw new GameError("The game is not paused.", 409);
  }
  room.status = "playing";
  const leftover = room.pauseRemainingMs ?? remainingMs(room.current.deadline, true, room.pauseRemainingMs);
  room.current.deadline = new Date(Date.now() + leftover).toISOString();
  room.pauseRemainingMs = null;
  broadcastState(room);
}

function alreadyAnswered(room: BettingRoom, playerId: string, questionId: number): boolean {
  if (room.answeredQuestionIds.includes(questionId) && room.current?.questionId !== questionId) {
    return true;
  }
  const current = room.current;
  if (!current || current.questionId !== questionId) return false;
  if (current.phase === "revealed") {
    return current.revealed?.results.some((row) => row.playerId === playerId && !row.missed) ?? false;
  }
  return Boolean(current.submissions.get(playerId)?.confirmed);
}

export function submitAnswer(options: {
  room: BettingRoom;
  playerId: string;
  token: string;
  bet: number;
  answer: PlayerAnswer;
  confirm?: boolean;
}): void {
  const { room } = options;
  const player = assertPlayer(room, options.playerId, options.token);
  const current = room.current;
  if (!current || current.phase !== "choosing" || room.status === "paused") {
    throw new GameError("Submissions are locked right now.", 409);
  }
  if (alreadyAnswered(room, player.id, current.questionId)) {
    throw new GameError("This group already locked in on this question.", 409);
  }
  let bet: number;
  try {
    bet = clampBet(options.bet, Math.min(player.balance, room.config.maxBet));
  } catch (error) {
    throw new GameError(error instanceof Error ? error.message : "Invalid bet.", 400);
  }
  current.submissions.set(player.id, {
    playerId: player.id,
    bet,
    answer: options.answer,
    submittedAt: nowIso(),
    confirmed: options.confirm !== false,
  });
  broadcastState(room);
}

function settleCurrent(room: BettingRoom): void {
  const current = room.current;
  if (!current || current.phase === "revealed") return;
  const question = getQuestion(current.questionId);
  const results: PlayerQuestionResult[] = [];
  for (const player of room.players.values()) {
    const submission = current.submissions.get(player.id);
    if (!submission?.confirmed) {
      results.push({
        playerId: player.id,
        name: player.name,
        bet: 0,
        correct: false,
        delta: 0,
        balanceAfter: player.balance,
        missed: true,
      });
      continue;
    }
    const correct = isAnswerCorrect(question, submission.answer);
    const payout = applyPayout(player.balance, submission.bet, question.multiplier, correct);
    player.balance = clampBalance(payout.nextBalance);
    results.push({
      playerId: player.id,
      name: player.name,
      bet: submission.bet,
      correct,
      delta: payout.delta,
      balanceAfter: player.balance,
      missed: false,
    });
  }
  current.phase = "revealed";
  current.revealed = {
    correctKey: formatAnswerKey(question),
    results,
  };
  current.resultsUntil = new Date(Date.now() + room.config.resultsDurationSeconds * 1000).toISOString();
  if (!room.answeredQuestionIds.includes(current.questionId)) {
    room.answeredQuestionIds.push(current.questionId);
  }
}

export function revealQuestion(room: BettingRoom, hostToken?: string): void {
  if (hostToken) assertHost(room, hostToken);
  if (!room.current || room.current.phase !== "choosing") {
    throw new GameError("There is no open question to reveal.", 409);
  }
  settleCurrent(room);
  room.status = "playing";
  room.pauseRemainingMs = null;
  emit(room, { type: "round:resolved", payload: null });
  broadcastState(room);
}

export function nextQuestion(room: BettingRoom, hostToken: string, questionId?: number): void {
  assertHost(room, hostToken);
  if (room.current?.phase === "choosing") {
    settleCurrent(room);
  }
  const id = questionId ?? nextUnansweredId(room);
  if (id === null) {
    room.status = "finished";
    room.current = null;
    broadcastState(room);
    return;
  }
  room.status = "playing";
  room.pauseRemainingMs = null;
  room.current = openQuestion(room, id);
  broadcastState(room);
}

export function endGame(room: BettingRoom, hostToken: string): void {
  assertHost(room, hostToken);
  if (room.current?.phase === "choosing") {
    settleCurrent(room);
  }
  room.status = "finished";
  room.pauseRemainingMs = null;
  broadcastState(room);
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

function catalogFor(room: BettingRoom): PublicQuestionListItem[] {
  const currentId = room.current?.questionId ?? null;
  const revealed = new Set(room.answeredQuestionIds);
  return publicQuestionCatalog().map((item) => {
    let status: PublicQuestionListItem["status"] = "upcoming";
    if (currentId === item.id && room.current?.phase === "choosing") status = "current";
    else if (currentId === item.id && room.current?.phase === "revealed") status = "revealed";
    else if (revealed.has(item.id)) status = "revealed";
    return { ...item, status };
  });
}

function leaderboard(room: BettingRoom) {
  return [...room.players.values()]
    .map((player) => ({ id: player.id, name: player.name, balance: player.balance }))
    .sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name));
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
  const current = room.current;
  const paused = room.status === "paused";
  const showReveal = current?.phase === "revealed" && current.revealed !== null;
  const publicCurrent = current
    ? {
        ...toPublicQuestion(getQuestion(current.questionId)),
        phase: current.phase,
        deadline: paused ? null : current.phase === "revealed" ? current.resultsUntil : current.deadline,
        remainingMs:
          current.phase === "revealed"
            ? remainingMs(current.resultsUntil, false, null)
            : remainingMs(current.deadline, paused, room.pauseRemainingMs),
        paused,
        submittedCount: [...current.submissions.values()].filter((row) => row.confirmed).length,
        revealed: showReveal ? current.revealed : null,
      }
    : null;

  const youSubmission = youPlayer && current ? current.submissions.get(youPlayer.id) : undefined;
  return {
    code: room.code,
    status: room.status,
    config: room.config,
    players: [...room.players.values()].map((player) => ({
      id: player.id,
      name: player.name,
      connected: player.connected,
      hasSubmitted: Boolean(current?.submissions.get(player.id)?.confirmed),
      alreadyAnswered: alreadyAnswered(room, player.id, current?.questionId ?? -1),
      balance: player.balance,
    })),
    you: youPlayer
      ? {
          id: youPlayer.id,
          name: youPlayer.name,
          balance: youPlayer.balance,
          bet: youSubmission?.bet ?? null,
          confirmed: youSubmission?.confirmed ?? false,
          alreadyAnswered: alreadyAnswered(room, youPlayer.id, current?.questionId ?? -1),
        }
      : null,
    isHost,
    current: publicCurrent,
    catalog: catalogFor(room),
    leaderboard: leaderboard(room),
    balanceLog: isHost ? room.balanceLog.slice(0, 20) : [],
    error: null,
  };
}

export function tickRoom(room: BettingRoom): void {
  if (room.status === "paused" || room.status === "lobby" || room.status === "finished") {
    return;
  }
  const current = room.current;
  if (!current) return;
  if (current.phase === "choosing" && Date.now() >= new Date(current.deadline).getTime()) {
    settleCurrent(room);
    emit(room, { type: "round:resolved", payload: null });
    broadcastState(room);
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
    for (const [id, attempt] of practiceAttempts) {
      if (attempt.createdAt < cutoff) practiceAttempts.delete(id);
    }
  }, 250);
}

export type PracticeState = {
  practiceId: string;
  question: ReturnType<typeof toPublicQuestion>;
  catalog: ReturnType<typeof publicQuestionCatalog>;
  balance: number;
  resolved: PracticeAttempt["resolved"];
};

export function createPractice(questionId = 1): PracticeState {
  const question = getQuestion(questionId);
  const id = randomId();
  practiceAttempts.set(id, {
    id,
    createdAt: Date.now(),
    questionId: question.id,
    balance: STARTING_BALANCE,
    resolved: null,
  });
  return {
    practiceId: id,
    question: toPublicQuestion(question),
    catalog: publicQuestionCatalog(),
    balance: STARTING_BALANCE,
    resolved: null,
  };
}

export function resolvePractice(options: {
  practiceId: string;
  bet: number;
  answer: PlayerAnswer;
}): PracticeState {
  const attempt = practiceAttempts.get(options.practiceId);
  if (!attempt) {
    throw new GameError("That practice question expired. Start a new one.", 404);
  }
  const question = getQuestion(attempt.questionId);
  let bet: number;
  try {
    bet = clampBet(options.bet, Math.min(attempt.balance, MAX_BET));
  } catch (error) {
    throw new GameError(error instanceof Error ? error.message : "Invalid bet.", 400);
  }
  const correct = isAnswerCorrect(question, options.answer);
  const payout = applyPayout(attempt.balance, bet, question.multiplier, correct);
  attempt.balance = clampBalance(payout.nextBalance);
  attempt.resolved = {
    correct,
    bet,
    delta: payout.delta,
    balanceAfter: attempt.balance,
    correctKey: formatAnswerKey(question),
  };
  return {
    practiceId: attempt.id,
    question: toPublicQuestion(question),
    catalog: publicQuestionCatalog(),
    balance: attempt.balance,
    resolved: attempt.resolved,
  };
}
