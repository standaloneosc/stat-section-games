"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import type { PatternChoice, PublicCoinRaceState } from "@/lib/coin-race";
import { CoinRaceResultsScreen } from "./results-screen";
import { CoinRaceRoundScreen } from "./round-screen";

export function CoinRacePracticeApp() {
  const [bayes, setBayes] = useState(false);
  const [practiceId, setPracticeId] = useState<string | null>(null);
  const [state, setState] = useState<PublicCoinRaceState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function startRound() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/coin-race/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "new",
          bayesMode: bayes ? "everyRound" : "off",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not start practice.");
      setPracticeId(data.practiceId);
      setState(data.state);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start practice.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(input: {
    chosenPattern: PatternChoice;
    estimatedWinPercent: number;
    bayesPercent: number | null;
    confirm: boolean;
  }) {
    if (!practiceId) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/coin-race/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resolve",
          practiceId,
          chosenPattern: input.chosenPattern,
          estimatedWinPercent: input.estimatedWinPercent,
          bayesPercent: input.bayesPercent,
          confirm: input.confirm,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not score this round.");
      setState(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not score this round.");
      throw err;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 pb-16">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs tracking-wide text-amber-200/80 uppercase">Practice · Coin Pattern Race</p>
          <h1 className="text-3xl font-semibold tracking-tight">One player, same math</h1>
        </div>
        <Link href="/coin-race">
          <Button variant="ghost">Home</Button>
        </Link>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Round setup</CardTitle>
          <CardDescription>
            Each round picks two distinct patterns of length 2 or 3, then either a blank history or
            a single leading H/T. Win probabilities are P(A before B | that suffix), not the next
            few flips. Leave Bayes off unless you want P(biased coin | observed flips).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <label className="flex items-center gap-3 text-sm">
            <Switch checked={bayes} onCheckedChange={(checked) => setBayes(Boolean(checked))} />
            Bayes question
          </label>
          <Button disabled={busy} onClick={() => void startRound()}>
            {state ? "New round" : "Start a round"}
          </Button>
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {!state ? (
        <p className="text-sm text-muted-foreground">
          Start a round to see two patterns, the current suffix, and a probability submission.
        </p>
      ) : state.round?.phase === "results" ? (
        <div className="space-y-4">
          <CoinRaceResultsScreen state={state} />
          <Button onClick={() => void startRound()}>Try another round</Button>
        </div>
      ) : (
        <CoinRaceRoundScreen
          key={state.round?.roundNumber}
          state={state}
          practice
          submitting={busy}
          onSubmit={submit}
        />
      )}
    </div>
  );
}
