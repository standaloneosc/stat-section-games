"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PublicRoomState } from "@/lib/game";
import { formatPercent, formatPosition, formatProbability } from "@/lib/probability";
import { GameBoard, squareLabel } from "./board";
import { LeaderboardCard } from "./panels";

export function ResultsScreen(props: { state: PublicRoomState }) {
  const round = props.state.round;
  const resolved = round?.resolved;
  const you = props.state.you;
  if (!round || !resolved) {
    return (
      <Alert>
        <AlertTitle>Resolving the monster&apos;s move</AlertTitle>
        <AlertDescription>The server is sampling the destination and scoring the round.</AlertDescription>
      </Alert>
    );
  }

  const yours = resolved.results.find((result) => result.playerId === you?.id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Round {round.roundNumber} results</p>
          <h2 className="text-2xl font-semibold">
            The monster landed on {formatPosition(resolved.destination)}
          </h2>
        </div>
        <Badge variant="secondary">Mode sampled: {resolved.sampledModeId}</Badge>
      </div>

      {yours?.missedSubmission ? (
        <Alert>
          <AlertTitle>You missed the submission window</AlertTitle>
          <AlertDescription>
            The server assigned you a random legal square {squareLabel(yours.selectedSquare)}. You still received survival points if you lived, but no probability bonus.
          </AlertDescription>
        </Alert>
      ) : null}

      {yours ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ScoreStat label="Survived" value={yours.survived ? "Yes" : "Caught"} />
          <ScoreStat label="Survival points" value={String(yours.survivalPoints)} />
          <ScoreStat label="Probability bonus" value={String(yours.probabilityBonus)} />
          <ScoreStat label="Round total" value={String(yours.roundPoints)} />
        </div>
      ) : null}

      <GameBoard
        monsterTrait={round.monster.trait}
        currentPosition={round.monster.currentPosition}
        legalSquares={round.legalSquares}
        selectedSquare={yours?.selectedSquare ?? you?.selectedSquare ?? null}
        destination={resolved.destination}
        playerCounts={resolved.playerCounts}
        hints={resolved.correctHitProbabilities}
        resolved
        disabled
      />

      <Card>
        <CardHeader>
          <CardTitle>Why those probabilities</CardTitle>
          <CardDescription>This explanation uses the same numbers the server scored against.</CardDescription>
        </CardHeader>
        <CardContent className="whitespace-pre-wrap text-sm leading-7">
          {resolved.explanation}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Square probabilities and congestion</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Square</TableHead>
                <TableHead>True P(hit)</TableHead>
                <TableHead>Players</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {round.legalSquares.map((square) => (
                <TableRow key={square}>
                  <TableCell>{squareLabel(square)}</TableCell>
                  <TableCell className="font-mono">
                    {formatProbability(resolved.correctHitProbabilities[square] ?? 0, 4)} (
                    {formatPercent(resolved.correctHitProbabilities[square] ?? 0, 1)})
                  </TableCell>
                  <TableCell>{resolved.playerCounts[square] ?? 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {yours ? (
        <Card>
          <CardHeader>
            <CardTitle>Your calibration</CardTitle>
            <CardDescription>
              The probability bonus rewards closeness to the correct value, not whether the random move hit you.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              You estimated {formatPercent(yours.estimatedHitProbability ?? 0, 1)} versus the true{" "}
              {formatPercent(yours.correctHitProbability, 1)}. Absolute error{" "}
              {yours.calculationError === null ? "n/a" : formatProbability(yours.calculationError, 3)}.
            </p>
            {round.bayes.enabled ? (
              <p>
                Bayes posterior estimate {formatPercent(yours.bayesEstimate ?? 0, 1)} versus{" "}
                {formatPercent(yours.correctBayesPosterior ?? 0, 1)}. Bayes bonus {yours.bayesBonus}.
                Hidden state was <span className="font-medium">{resolved.hiddenState}</span>.
              </p>
            ) : null}
            <p>
              {yours.playersOnSquare} player{yours.playersOnSquare === 1 ? "" : "s"} hid on your square, so n ={" "}
              {yours.otherPlayersOnSquare} other player{yours.otherPlayersOnSquare === 1 ? "" : "s"}.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {props.state.config.showStudentCalculations ? (
        <Card>
          <CardHeader>
            <CardTitle>Everyone&apos;s round</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead>Square</TableHead>
                  <TableHead>Lived</TableHead>
                  <TableHead>Survival</TableHead>
                  <TableHead>P bonus</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resolved.results.map((result) => (
                  <TableRow key={result.playerId}>
                    <TableCell>
                      {result.name}
                      {result.missedSubmission ? (
                        <Badge className="ml-2" variant="secondary">
                          late
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>{squareLabel(result.selectedSquare)}</TableCell>
                    <TableCell>{result.survived ? "Yes" : "No"}</TableCell>
                    <TableCell>{result.survivalPoints}</TableCell>
                    <TableCell>{result.probabilityBonus + result.bayesBonus}</TableCell>
                    <TableCell className="font-mono">{result.roundPoints}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {props.state.config.showLeaderboard ? (
        <LeaderboardCard rows={props.state.leaderboard} youId={you?.id} />
      ) : null}
    </div>
  );
}

function ScoreStat(props: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{props.label}</CardDescription>
        <CardTitle className="text-2xl">{props.value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
