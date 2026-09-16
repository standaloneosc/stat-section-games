"use client";

import { HelpCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  describeModeMotion,
  formatPercent,
  type MonsterTrait,
  type MovementMode,
} from "@/lib/probability";

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
        {props.paused ? <span className="rounded-full bg-muted px-2 py-1 text-xs">Paused</span> : null}
        {warning ? <span className="rounded-full bg-rose-500/20 px-2 py-1 text-xs text-rose-200">Final seconds</span> : null}
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
  trait: MonsterTrait;
  bayes?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{props.bayes ? "If it did not notice you" : "Movement modes"}</CardTitle>
        <CardDescription>
          Labeled modes you can add. These are how often each mode happens, not the hit chance of a
          square.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mode</TableHead>
              <TableHead>How often</TableHead>
              <TableHead>Where it goes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.modes.map((mode) => (
              <TableRow key={mode.id}>
                <TableCell className="font-medium">{mode.label}</TableCell>
                <TableCell className="font-mono">{formatPercent(mode.probability)}</TableCell>
                <TableCell>{describeModeMotion(mode.id, props.trait)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function HelpPanel(props: { bayes?: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HelpCircle className="size-4" />
          How to calculate
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
        {props.bayes ? (
          <p>
            <span className="font-medium text-foreground">Hint first.</span> Use the clue to update
            P(noticed | hint). Do that before you mix movement.
          </p>
        ) : null}
        <p>
          <span className="font-medium text-foreground">Then mix.</span>{" "}
          {props.bayes
            ? "If it did not notice you, add the modes: P(hit s) = Σ P(s | mode) × P(mode). If it noticed you, use the hunt-the-center shares instead. Mix those two with your posterior."
            : "P(hit square s) = Σ P(s | mode) × P(mode). Read where each mode goes, then add."}
        </p>
        <p>
          <span className="font-medium text-foreground">Payoff.</span> If you live, you earn 100 /
          (1 + other players on your square). A safer square that everyone picks can pay less.
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
