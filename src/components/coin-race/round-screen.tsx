"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { PatternChoice, PublicCoinRaceState } from "@/lib/coin-race";
import { TimerBar } from "@/components/game/panels";

export function asPercent(probability: number): string {
  const tenths = Math.round(probability * 1000) / 10;
  return Number.isInteger(tenths) ? `${tenths}%` : `${tenths.toFixed(1)}%`;
}

export function PatternTiles(props: { pattern: string; label: string; selected?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        props.selected ? "border-amber-300 bg-amber-300/10" : "border-border"
      }`}
    >
      <p className="text-xs tracking-wide text-muted-foreground uppercase">{props.label}</p>
      <div className="mt-2 flex gap-2">
        {[...props.pattern].map((face, i) => (
          <span
            key={`${face}-${i}`}
            className={`flex size-12 items-center justify-center rounded-lg font-mono text-2xl font-semibold ${
              face === "H" ? "bg-amber-400/20 text-amber-100" : "bg-sky-400/20 text-sky-100"
            }`}
          >
            {face}
          </span>
        ))}
      </div>
    </div>
  );
}

export function CoinRaceRoundScreen(props: {
  state: PublicCoinRaceState;
  practice?: boolean;
  submitting?: boolean;
  onSubmit: (input: {
    chosenPattern: PatternChoice;
    estimatedWinPercent: number;
    bayesPercent: number | null;
    confirm: boolean;
  }) => Promise<void> | void;
}) {
  const round = props.state.round;
  const you = props.state.you;
  const [choice, setChoice] = useState<PatternChoice | null>(you?.chosenPattern ?? null);
  const [winPercent, setWinPercent] = useState(
    you?.estimatedWinProbability != null ? Math.round(you.estimatedWinProbability * 100) : ""
  );
  const [bayesPercent, setBayesPercent] = useState(
    you?.bayesEstimate != null ? Math.round(you.bayesEstimate * 100) : ""
  );
  const [error, setError] = useState<string | null>(null);
  if (!round) return null;
  const current = round;

  const locked = Boolean(you?.confirmed);
  const remaining = current.remainingMs;
  const totalMs = props.state.config.decisionTimeSeconds * 1000;

  async function lockIn() {
    if (!choice) {
      setError("Choose Pattern A or Pattern B.");
      return;
    }
    const estimate = Number(winPercent);
    if (!Number.isFinite(estimate) || estimate < 0 || estimate > 100) {
      setError("Enter a win probability from 0 to 100.");
      return;
    }
    let bayes: number | null = null;
    if (current.bayesEnabled) {
      const value = Number(bayesPercent);
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        setError("Enter P(biased coin | flips) from 0 to 100.");
        return;
      }
      bayes = value;
    }
    setError(null);
    await props.onSubmit({
      chosenPattern: choice,
      estimatedWinPercent: estimate,
      bayesPercent: bayes,
      confirm: true,
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <div className="space-y-4">
        <TimerBar
          remainingMs={remaining}
          totalMs={totalMs}
          paused={round.paused}
          label={`Round ${round.roundNumber} · choose which pattern appears first`}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <PatternTiles pattern={round.patternA} label="Pattern A" selected={choice === "A"} />
          <PatternTiles pattern={round.patternB} label="Pattern B" selected={choice === "B"} />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Flips so far</CardTitle>
            <CardDescription>
              Work from this suffix. The next calculation is P(A appears before B | this history),
              not P(the next three flips equal A).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {round.suffix ? (
              <div className="flex gap-2">
                {[...round.suffix].map((face, i) => (
                  <span
                    key={`${face}-${i}`}
                    className="flex size-10 items-center justify-center rounded-lg bg-muted font-mono text-xl"
                  >
                    {face}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No flips yet. Start from the empty suffix.</p>
            )}
          </CardContent>
        </Card>
        {round.bayesEnabled ? (
          <Card className="border-amber-300/30">
            <CardHeader>
              <CardTitle>Bayes clue</CardTitle>
              <CardDescription>
                The coin might be fair (P(H)=50%) or heads-biased (P(H)=75%). Prior for each type is
                50%. Observed flips: {round.bayesObservation}. Submit {round.bayesPrompt}.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}
        <Card>
          <CardHeader>
            <CardTitle>What you are scoring</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm leading-6 text-muted-foreground">
            <p>Correct choice: the pattern with the larger theoretical win probability — not whoever happens to win the random race.</p>
            <p>Probability accuracy: how close your estimate is to the true P(your pattern first).</p>
            <p>Speed: awarded only after both the pattern and the probability are locked in.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your submission</CardTitle>
          <CardDescription>
            Enter percents (75 means 75%). Win probabilities stay hidden until the timer ends.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={choice === "A" ? "default" : "outline"}
              disabled={locked || props.submitting}
              onClick={() => setChoice("A")}
            >
              Choose A · {round.patternA}
            </Button>
            <Button
              variant={choice === "B" ? "default" : "outline"}
              disabled={locked || props.submitting}
              onClick={() => setChoice("B")}
            >
              Choose B · {round.patternB}
            </Button>
          </div>
          <label className="grid gap-2 text-sm">
            P(your pattern appears first)
            <Input
              type="number"
              min={0}
              max={100}
              disabled={locked || props.submitting}
              value={winPercent}
              onChange={(event) => setWinPercent(event.target.value)}
            />
          </label>
          {round.bayesEnabled ? (
            <label className="grid gap-2 text-sm">
              {round.bayesPrompt}
              <Input
                type="number"
                min={0}
                max={100}
                disabled={locked || props.submitting}
                value={bayesPercent}
                onChange={(event) => setBayesPercent(event.target.value)}
              />
            </label>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {locked ? (
            <p className="text-sm text-muted-foreground">Locked in. Waiting for the race to resolve.</p>
          ) : (
            <Button disabled={props.submitting} onClick={() => void lockIn()}>
              Lock in
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
