import type { PlayerAnswer } from "./grade";
import type { PublicQuestionInfo } from "./questions";

export type GameStatus = "lobby" | "playing" | "paused" | "finished";

export type BettingConfig = {
  /** Whole-round clock. Host sets this, then starts. Final score is the balance when it hits zero. */
  timeLimitSeconds: number;
  startingBalance: number;
  maxBet: number;
};

export const DEFAULT_BETTING_CONFIG: BettingConfig = {
  timeLimitSeconds: 900,
  startingBalance: 10_000,
  maxBet: 10_000,
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

export type GradedSubmission = {
  playerId: string;
  questionId: number;
  bet: number;
  answer: PlayerAnswer;
  correct: boolean;
  delta: number;
  balanceAfter: number;
  submittedAt: string;
  correctKey: string;
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
  startedAt: string | null;
  deadline: string | null;
  pauseRemainingMs: number | null;
  /** key = `${playerId}:${questionId}` */
  submissions: Map<string, GradedSubmission>;
  balanceLog: BalanceLogEntry[];
  listeners: Set<(event: BettingEvent) => void>;
};

export type PublicPlayer = {
  id: string;
  name: string;
  connected: boolean;
  answeredCount: number;
  balance: number;
};

export type PublicYourResult = {
  questionId: number;
  bet: number;
  correct: boolean;
  delta: number;
  correctKey: string;
};

export type PublicYou = {
  id: string;
  name: string;
  balance: number;
  answeredCount: number;
  results: PublicYourResult[];
};

export type PublicGridItem = PublicQuestionInfo & {
  answered: boolean;
  yourResult: PublicYourResult | null;
  answeredByCount: number;
};

export type PublicBettingState = {
  code: string;
  status: GameStatus;
  config: BettingConfig;
  players: PublicPlayer[];
  you: PublicYou | null;
  isHost: boolean;
  startedAt: string | null;
  deadline: string | null;
  remainingMs: number;
  paused: boolean;
  frozen: boolean;
  grid: PublicGridItem[];
  leaderboard: Array<{ id: string; name: string; balance: number; answeredCount: number }>;
  balanceLog: BalanceLogEntry[];
  error: string | null;
};
