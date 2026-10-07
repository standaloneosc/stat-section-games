import type { PlayerAnswer } from "./grade";
import type { Multiplier } from "./payout";
import type { PublicQuestionInfo } from "./questions";

export type GameStatus = "lobby" | "playing" | "paused" | "finished";
export type QuestionPhase = "choosing" | "revealed";

export type BettingConfig = {
  decisionTimeSeconds: number;
  startingBalance: number;
  maxBet: number;
  resultsDurationSeconds: number;
};

export const DEFAULT_BETTING_CONFIG: BettingConfig = {
  decisionTimeSeconds: 180,
  startingBalance: 10_000,
  maxBet: 10_000,
  resultsDurationSeconds: 60,
};

export type PlayerRecord = {
  id: string;
  token: string;
  name: string;
  connected: boolean;
  joinedAt: string;
  lastSeenAt: string;
  balance: number;
};

export type PlayerSubmission = {
  playerId: string;
  bet: number;
  answer: PlayerAnswer;
  submittedAt: string;
  confirmed: boolean;
};

export type PlayerQuestionResult = {
  playerId: string;
  name: string;
  bet: number;
  correct: boolean;
  delta: number;
  balanceAfter: number;
  missed: boolean;
};

export type RevealedQuestion = {
  correctKey: string;
  results: PlayerQuestionResult[];
};

export type InternalQuestionRound = {
  questionId: number;
  phase: QuestionPhase;
  startedAt: string;
  deadline: string;
  resultsUntil: string | null;
  submissions: Map<string, PlayerSubmission>;
  revealed: RevealedQuestion | null;
};

export type BalanceLogEntry = {
  at: string;
  playerId: string;
  name: string;
  amount: number;
  balanceAfter: number;
  note: string;
};

export type BettingEvent = {
  type: "round:state" | "round:locked" | "round:resolved" | "game:leaderboard" | "heartbeat";
  payload: unknown;
};

export type BettingRoom = {
  code: string;
  hostId: string;
  hostToken: string;
  createdAt: string;
  config: BettingConfig;
  status: GameStatus;
  players: Map<string, PlayerRecord>;
  current: InternalQuestionRound | null;
  answeredQuestionIds: number[];
  pauseRemainingMs: number | null;
  balanceLog: BalanceLogEntry[];
  listeners: Set<(event: BettingEvent) => void>;
};

export type PublicPlayer = {
  id: string;
  name: string;
  connected: boolean;
  hasSubmitted: boolean;
  alreadyAnswered: boolean;
  balance: number;
};

export type PublicYou = {
  id: string;
  name: string;
  balance: number;
  bet: number | null;
  confirmed: boolean;
  alreadyAnswered: boolean;
};

export type PublicCurrentQuestion = PublicQuestionInfo & {
  phase: QuestionPhase;
  deadline: string | null;
  remainingMs: number;
  paused: boolean;
  submittedCount: number;
  revealed: RevealedQuestion | null;
};

export type PublicQuestionListItem = PublicQuestionInfo & {
  status: "upcoming" | "current" | "revealed";
};

export type PublicBettingState = {
  code: string;
  status: GameStatus;
  config: BettingConfig;
  players: PublicPlayer[];
  you: PublicYou | null;
  isHost: boolean;
  current: PublicCurrentQuestion | null;
  catalog: PublicQuestionListItem[];
  leaderboard: Array<{ id: string; name: string; balance: number }>;
  balanceLog: BalanceLogEntry[];
  error: string | null;
};
