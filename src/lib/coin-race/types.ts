export type Face = "H" | "T";
export type PatternChoice = "A" | "B";
export type CorrectChoice = "A" | "B" | "tie";
export type BayesMode = "off" | "everyRound" | "everyThirdRound" | "finalRoundOnly";
export type HiddenCoinType = "F" | "B";
export type GameStatus = "lobby" | "playing" | "paused" | "finished";
export type RoundPhase = "choosing" | "results";

export type ScoringConfig = {
  decisionTimeSeconds: number;
  correctChoicePoints: number;
  probabilityPoints: number;
  speedPoints: number;
  bayesBonusPoints: number;
  choiceTieTolerance: number;
  bayesMode: BayesMode;
};

export type CoinRaceConfig = ScoringConfig & {
  roundCount: number;
  resultsDurationSeconds: number;
};

export type RoundScore = {
  correctChoicePoints: number;
  probabilityPoints: number;
  speedPoints: number;
  bayesBonus: number;
  total: number;
};

export type PlayerRecord = {
  id: string;
  token: string;
  name: string;
  connected: boolean;
  joinedAt: string;
  lastSeenAt: string;
  score: number;
};

export type PlayerSubmission = {
  playerId: string;
  chosenPattern: PatternChoice;
  estimatedWinProbability: number;
  bayesEstimate: number | null;
  submittedAt: string;
  confirmed: boolean;
  missedSubmission: boolean;
};

export type PlayerRoundResult = {
  playerId: string;
  name: string;
  chosenPattern: PatternChoice | null;
  estimatedWinProbability: number | null;
  bayesEstimate: number | null;
  missedSubmission: boolean;
  score: RoundScore;
  cumulativeScore: number;
};

export type ResolvedRound = {
  winner: PatternChoice;
  flips: Face[];
  sequence: string;
  patternAProbability: number;
  patternBProbability: number;
  correctChoice: CorrectChoice;
  correctBayesPosterior: number | null;
  hiddenCoinType: HiddenCoinType | null;
  results: PlayerRoundResult[];
};

export type InternalRound = {
  roundNumber: number;
  patternA: string;
  patternB: string;
  suffix: string;
  pHeads: number;
  patternAProbability: number;
  patternBProbability: number;
  bayesEnabled: boolean;
  bayesObservation: string | null;
  correctBayesPosterior: number | null;
  hiddenCoinType: HiddenCoinType | null;
  phase: RoundPhase;
  startedAt: string;
  deadline: string;
  resultsUntil: string | null;
  submissions: Map<string, PlayerSubmission>;
  resolved: ResolvedRound | null;
};

export type CoinRaceEvent = {
  type: "round:state" | "round:locked" | "round:resolved" | "game:leaderboard" | "heartbeat";
  payload: unknown;
};

export type CoinRaceRoom = {
  code: string;
  hostId: string;
  hostToken: string;
  createdAt: string;
  config: CoinRaceConfig;
  status: GameStatus;
  players: Map<string, PlayerRecord>;
  round: InternalRound | null;
  history: Array<{
    roundNumber: number;
    patternA: string;
    patternB: string;
    winner: PatternChoice;
    results: PlayerRoundResult[];
  }>;
  pauseRemainingMs: number | null;
  listeners: Set<(event: CoinRaceEvent) => void>;
};

export type PublicPlayer = {
  id: string;
  name: string;
  connected: boolean;
  hasSubmitted: boolean;
  score: number;
};

export type PublicYou = {
  id: string;
  name: string;
  score: number;
  chosenPattern: PatternChoice | null;
  estimatedWinProbability: number | null;
  bayesEstimate: number | null;
  confirmed: boolean;
  missedSubmission: boolean;
};

export type PublicRound = {
  roundNumber: number;
  patternA: string;
  patternB: string;
  suffix: string;
  bayesEnabled: boolean;
  bayesObservation: string | null;
  bayesPrompt: string | null;
  phase: RoundPhase;
  deadline: string | null;
  remainingMs: number;
  paused: boolean;
  resolved: {
    winner: PatternChoice;
    flips: Face[];
    sequence: string;
    patternAProbability: number;
    patternBProbability: number;
    correctChoice: CorrectChoice;
    correctBayesPosterior: number | null;
    hiddenCoinType: HiddenCoinType | null;
    results: PlayerRoundResult[];
  } | null;
};

export type PublicCoinRaceState = {
  code: string;
  status: GameStatus;
  config: CoinRaceConfig;
  roundCountPlayed: number;
  players: PublicPlayer[];
  you: PublicYou | null;
  isHost: boolean;
  round: PublicRound | null;
  leaderboard: Array<{ id: string; name: string; score: number }>;
  error: string | null;
};

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  decisionTimeSeconds: 180,
  correctChoicePoints: 100,
  probabilityPoints: 100,
  speedPoints: 50,
  bayesBonusPoints: 50,
  choiceTieTolerance: 0.01,
  bayesMode: "off",
};

export const DEFAULT_COIN_RACE_CONFIG: CoinRaceConfig = {
  ...DEFAULT_SCORING_CONFIG,
  roundCount: 6,
  resultsDurationSeconds: 60,
};

export const FAIR_P_HEADS = 0.5;
export const BIASED_P_HEADS = 0.75;
export const COIN_TYPE_PRIOR_BIASED = 0.5;
