"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import type { PublicRoomState } from "@/lib/game";
import type { MonsterTrait } from "@/lib/probability";
import { ResultsScreen } from "./results-screen";
import { RoundScreen } from "./round-screen";

export function PracticeApp() {
  const [hints, setHints] = useState(false);
  const [bayes, setBayes] = useState(true);
  const [trait, setTrait] = useState<MonsterTrait | "auto">("walker");
  const [practiceId, setPracticeId] = useState<string | null>(null);
  const [state, setState] = useState<PublicRoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function startRound() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "new", hintsEnabled: hints, bayes, trait }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Could not start practice.");
      }
      setPracticeId(data.practiceId);
      setState(data.state);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start practice.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(input: {
    selectedSquare: string;
    estimatedHitPercent: number;
    bayesPercent: number | null;
    confirm: boolean;
  }) {
    if (!practiceId) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resolve",
          practiceId,
          selectedSquare: input.selectedSquare,
          estimatedHitPercent: input.estimatedHitPercent,
          bayesPercent: input.bayesPercent,
          confirm: input.confirm,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Could not score this round.");
      }
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
          <p className="text-xs tracking-wide text-amber-200/80 uppercase">Practice</p>
          <h1 className="text-3xl font-semibold tracking-tight">One player, same math</h1>
        </div>
        <Link href="/">
          <Button variant="ghost">Home</Button>
        </Link>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Round setup</CardTitle>
          <CardDescription>
            True hit percents are a spoiler — leave them off to work by hand. Leave the notice
            hint on to practice Bayes every round, then mix movement.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="grid gap-2 text-sm">
            Trait
            <select
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
              value={trait}
              onChange={(event) => setTrait(event.target.value as MonsterTrait | "auto")}
            >
              <option value="walker">Walker</option>
              <option value="spider">Spider</option>
              <option value="hunter">Hunter</option>
            </select>
          </label>
          <label className="flex items-center gap-3 text-sm">
            <Switch checked={hints} onCheckedChange={(checked) => setHints(Boolean(checked))} />
            Show true hit percents
          </label>
          <label className="flex items-center gap-3 text-sm">
            <Switch checked={bayes} onCheckedChange={(checked) => setBayes(Boolean(checked))} />
            Bayes challenge
          </label>
          <Button disabled={busy} onClick={() => void startRound()}>
            {state ? "New round" : "Start a round"}
          </Button>
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {!state ? (
        <p className="text-sm text-muted-foreground">
          Start a round to see the 3×3 board, the movement table, and a probability submission.
        </p>
      ) : state.round?.phase === "results" ? (
        <div className="space-y-4">
          <ResultsScreen state={state} />
          <Button onClick={() => void startRound()}>Try another round</Button>
        </div>
      ) : (
        <RoundScreen
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
