"use client";

import { HelpCircle } from "lucide-react";
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
import { formatPercent, formatProbability, type MovementMode } from "@/lib/probability";
import { squareLabel } from "./board";

export function TimerBar(props: {
  remainingMs: number;
  totalMs: number;
  paused?: boolean;
  label: string;
}) {
  const seconds = Math.max(0, Math.ceil(props.remainingMs / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  const ratio = props.totalMs > 0 ? Math.min(1, props.remainingMs / props.totalMs) : 0;
  const warning = seconds <= 20 && !props.paused;

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-wide text-muted-foreground uppercase">{props.label}</p>
          <p className={`font-mono text-3xl font-semibold ${warning ? "text-rose-300" : "text-amber-200"}`}>
            {String(minutes).padStart(2, "0")}:{String(rest).padStart(2, "0")}
          </p>
        </div>
        {props.paused ? <Badge variant="secondary">Paused</Badge> : null}
        {warning ? <Badge variant="destructive">Final seconds</Badge> : null}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full ${warning ? "bg-rose-400" : "bg-amber-300"}`}
          style={{ width: `${Math.max(2, ratio * 100)}%` }}
        />
      </div>
    </div>
  );
}

export function MovementTable(props: {
  modes: MovementMode[];
  legalSquares: string[];
  bayes?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{props.bayes ? "Movement if noticed vs not" : "Movement-mode table"}</CardTitle>
        <CardDescription>
          {props.bayes
            ? "These are the two conditional distributions. Update the hidden-state probability with Bayes, then mix them."
            : "Each mode is mutually exclusive. The hit probability of a square is the law of total probability over these modes."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mode</TableHead>
              <TableHead>P(mode)</TableHead>
              {props.legalSquares.map((square) => (
                <TableHead key={square}>{squareLabel(square)}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.modes.map((mode) => (
              <TableRow key={mode.id}>
                <TableCell className="font-medium">{mode.label}</TableCell>
                <TableCell className="font-mono">{formatProbability(mode.probability, 2)}</TableCell>
                {props.legalSquares.map((square) => (
                  <TableCell key={square} className="font-mono">
                    {formatProbability(mode.destinationWeights[square] ?? 0, 2)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function HelpPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HelpCircle className="size-4" />
          How to calculate
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">Law of total probability.</span>{" "}
          P(monster hits square s) = Σ<sub>m</sub> P(s | mode m) × P(mode m).
        </p>
        <p>
          <span className="font-medium text-foreground">Survival payoff.</span> If you live, you
          earn 100 / (1 + other players on your square). A safer square that everyone picks can
          pay less than a slightly riskier empty square.
        </p>
        <p>
          <span className="font-medium text-foreground">Probability bonus.</span> After you pick a
          square, estimate its hit probability. You can earn up to 20 points for being close to
          the true value, even if the monster catches you.
        </p>
        <p>
          <span className="font-medium text-foreground">Bayes rounds.</span> A clue updates
          P(noticed | clue). Then mix the noticed and not-noticed movement tables with that
          posterior to get P(hit | clue).
        </p>
      </CardContent>
    </Card>
  );
}

export function LeaderboardCard(props: {
  rows: Array<{ id: string; name: string; score: number }>;
  youId?: string | null;
  title?: string;
}) {
  if (props.rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{props.title ?? "Leaderboard"}</CardTitle>
          <CardDescription>Scores appear after the first round resolves.</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{props.title ?? "Leaderboard"}</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-2">
          {props.rows.map((row, index) => (
            <li
              key={row.id}
              className={`flex items-center justify-between rounded-lg px-3 py-2 ${row.id === props.youId ? "bg-amber-500/15" : "bg-muted/40"}`}
            >
              <span>
                <span className="mr-2 font-mono text-muted-foreground">{index + 1}.</span>
                {row.name}
              </span>
              <span className="font-mono">{row.score}</span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

export function formatClock(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export { formatPercent };
