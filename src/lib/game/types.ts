import type {
  BayesState,
  MonsterTrait,
  MovementMode,
  Position,
} from "@/lib/probability";

export type GamePhase = "waiting" | "choosing" | "resolving" | "results";
export type GameStatus = "lobby" | "playing" | "paused" | "finished";

export type GameConfig = {
  gridSize: 3;
  roundCount: number;
  roundDurationSeconds: number;
  resultsDurationSeconds: number;
  baseReward: number;
  monsterTrait: MonsterTrait | "auto";
  bayesEnabled: boolean;
  bayesEveryNthRound: number;
  hintsEnabled: boolean;
  showStudentCalculations: boolean;
  showLeaderboard: boolean;
  priorNoticed: number;
  warningLikelihoodIfNoticed: number;
  warningLikelihoodIfNotNoticed: number;
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
  selectedSquare: string;
  estimatedHitProbability: number | null;
  bayesEstimate: number | null;
  submittedAt: string;
  missedSubmission: boolean;
  confirmed: boolean;
};

export type PlayerRoundResult = {
  playerId: string;
  name: string;
  selectedSquare: string;
  estimatedHitProbability: number | null;
  bayesEstimate: number | null;
  correctHitProbability: number;
  correctBayesPosterior: number | null;
  survived: boolean;
  otherPlayersOnSquare: number;
  playersOnSquare: number;
  survivalPoints: number;
  probabilityBonus: number;
  bayesBonus: number;
  roundPoints: number;
  cumulativeScore: number;
  missedSubmission: boolean;
  calculationError: number | null;
  bayesError: number | null;
};

export type ResolvedRound = {
  destination: Position;
  sampledModeId: string;
  playerCounts: Record<string, number>;
  results: PlayerRoundResult[];
  explanation: string;
  explanationSquare: string;
  correctHitProbabilities: Record<string, number>;
  correctBayesPosterior: number | null;
};

export type InternalRound = {
  roundNumber: number;
  gridSize: 3;
  monster: {
    trait: MonsterTrait;
    currentPosition: Position;
    movementModes: MovementMode[];
  };
  bayes: BayesState;
  legalSquares: string[];
  correctHitProbabilities: Record<string, number>;
  phase: GamePhase;
  startedAt: string;
  deadline: string;
  resultsUntil: string | null;
  submissions: Map<string, PlayerSubmission>;
  resolved: ResolvedRound | null;
};

export type Room = {
  code: string;
  hostId: string;
  hostToken: string;
  createdAt: string;
  config: GameConfig;
  status: GameStatus;
  players: Map<string, PlayerRecord>;
  round: InternalRound | null;
  history: Array<{
    roundNumber: number;
    trait: MonsterTrait;
    destination: Position;
    results: PlayerRoundResult[];
  }>;
  pauseRemainingMs: number | null;
  listeners: Set<(event: RoomEvent) => void>;
};

export type RoomEvent = {
  type: "round:state" | "round:locked" | "round:resolved" | "game:leaderboard" | "heartbeat";
  payload: unknown;
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
  selectedSquare: string | null;
  estimatedHitProbability: number | null;
  bayesEstimate: number | null;
  confirmed: boolean;
  missedSubmission: boolean;
};

export type PublicRound = {
  roundNumber: number;
  gridSize: 3;
  monster: {
    trait: MonsterTrait;
    currentPosition: Position;
    movementModes: MovementMode[];
    description: string;
  };
  bayes: {
    enabled: boolean;
    priorNoticed: number | null;
    clueId: string | null;
    clueText: string | null;
    clueLikelihoodIfNoticed: number | null;
    clueLikelihoodIfNotNoticed: number | null;
  };
  legalSquares: string[];
  phase: GamePhase;
  deadline: string | null;
  remainingMs: number;
  paused: boolean;
  hints: Record<string, number> | null;
  resolved: null | {
    destination: Position;
    sampledModeId: string;
    playerCounts: Record<string, number>;
    results: PlayerRoundResult[];
    explanation: string;
    explanationSquare: string;
    correctHitProbabilities: Record<string, number>;
    correctBayesPosterior: number | null;
    hiddenState: "noticed" | "not-noticed" | null;
  };
};

export type PublicRoomState = {
  code: string;
  status: GameStatus;
  config: GameConfig;
  roundCountPlayed: number;
  players: PublicPlayer[];
  you: PublicYou | null;
  isHost: boolean;
  round: PublicRound | null;
  leaderboard: Array<{ id: string; name: string; score: number }>;
  error: string | null;
};

export const DEFAULT_GAME_CONFIG: GameConfig = {
  gridSize: 3,
  roundCount: 6,
  roundDurationSeconds: 240,
  resultsDurationSeconds: 60,
  baseReward: 100,
  monsterTrait: "auto",
  bayesEnabled: true,
  bayesEveryNthRound: 3,
  hintsEnabled: false,
  showStudentCalculations: true,
  showLeaderboard: true,
  priorNoticed: 0.25,
  warningLikelihoodIfNoticed: 0.9,
  warningLikelihoodIfNotNoticed: 0.1,
};
