"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PublicCoinRaceState, RoundScore } from "@/lib/coin-race";
import { asPercent, PatternTiles } from "./round-screen";

function ScoreRow(props: { label: string; earned: number; max: number }) {
  return (
    <div className="flex items-center justify-between gap-3 font-mono text-sm">
      <span className="text-muted-foreground">{props.label}</span>
      <span>
        {props.earned} / {props.max}
      </span>
    </div>
  );
}

function categoryMax(state: PublicCoinRaceState, key: keyof RoundScore): number {
  const config = state.config;
  if (key === "correctChoicePoints") return config.correctChoicePoints;
  if (key === "probabilityPoints") return config.probabilityPoints;
  if (key === "speedPoints") return config.speedPoints;
  if (key === "bayesBonus") return state.round?.resolved?.correctBayesPosterior != null ? config.bayesBonusPoints : 0;
  return 0;
}

export function CoinRaceResultsScreen(props: { state: PublicCoinRaceState }) {
  const round = props.state.round;
  const resolved = round?.resolved;
  if (!round || !resolved) return null;
  const youId = props.state.you?.id;
  const yours = resolved.results.find((row) => row.playerId === youId) ?? resolved.results[0];
  const fairWinner = resolved.correctChoice === "tie" ? "either (tie)" : resolved.correctChoice === "A" ? round.patternA : round.patternB;
  const actual = resolved.winner === "A" ? round.patternA : round.patternB;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>The race resolved</CardTitle>
          <CardDescription>
            Sequence {resolved.sequence}. {actual} appeared first — that outcome is random and is
            not what we grade. The better theoretical choice was {fairWinner}.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <PatternTiles pattern={round.patternA} label={`A · ${asPercent(resolved.patternAProbability)} to appear first`} />
          <PatternTiles pattern={round.patternB} label={`B · ${asPercent(resolved.patternBProbability)} to appear first`} />
        </CardContent>
      </Card>

      {yours ? (
        <Card>
          <CardHeader>
            <CardTitle>{youId ? "Your score" : "Sample score"}</CardTitle>
            <CardDescription>Each category is shown separately.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <ScoreRow
              label="Correct choice"
              earned={yours.score.correctChoicePoints}
              max={categoryMax(props.state, "correctChoicePoints")}
            />
            <ScoreRow
              label="Probability accuracy"
              earned={yours.score.probabilityPoints}
              max={categoryMax(props.state, "probabilityPoints")}
            />
            <ScoreRow
              label="Speed"
              earned={yours.score.speedPoints}
              max={categoryMax(props.state, "speedPoints")}
            />
            <ScoreRow
              label="Bayes bonus"
              earned={yours.score.bayesBonus}
              max={categoryMax(props.state, "bayesBonus")}
            />
            <div className="flex items-center justify-between border-t border-border pt-2 font-semibold">
              <span>Total</span>
              <span>{yours.score.total} points</span>
            </div>
            {resolved.correctBayesPosterior != null ? (
              <p className="text-sm text-muted-foreground">
                True {round.bayesPrompt} = {asPercent(resolved.correctBayesPosterior)}
                {resolved.hiddenCoinType ? ` · hidden type was ${resolved.hiddenCoinType === "B" ? "biased" : "fair"}` : ""}.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Class results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {resolved.results.map((row) => (
            <div key={row.playerId} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
              <span>
                {row.name}
                {row.missedSubmission ? " · missed" : row.chosenPattern ? ` · ${row.chosenPattern}` : ""}
              </span>
              <span className="font-mono">
                {row.score.correctChoicePoints}/{row.score.probabilityPoints}/{row.score.speedPoints}/{row.score.bayesBonus} · {row.score.total}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Leaderboard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {props.state.leaderboard.map((row, index) => (
            <div key={row.id} className="flex items-center justify-between text-sm">
              <span>
                {index + 1}. {row.name}
              </span>
              <span className="font-mono">{row.score}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
