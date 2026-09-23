"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCoinRaceState } from "@/hooks/use-coin-race";
import type { PatternChoice } from "@/lib/coin-race";
import { loadCoinRacePlayerSession, saveCoinRacePlayerSession } from "@/lib/session";
import { CoinRaceResultsScreen } from "./results-screen";
import { CoinRaceRoundScreen } from "./round-screen";

export function CoinRacePlayerApp(props: { code: string }) {
  const code = props.code.toUpperCase();
  const [session, setSession] = useState(() =>
    typeof window === "undefined" ? null : loadCoinRacePlayerSession(code)
  );
  const [name, setName] = useState(session?.name ?? "");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { state, error, loading, connected, refresh, setState } = useCoinRaceState({
    code,
    playerId: session?.playerId,
    token: session?.token,
    enabled: Boolean(session),
  });

  async function join(event?: React.FormEvent | React.MouseEvent) {
    event?.preventDefault();
    if (joining) return;
    setJoining(true);
    setJoinError(null);
    try {
      const response = await fetch(`/api/coin-race/rooms/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          playerId: session?.playerId,
          token: session?.token,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not join that room.");
      const next = { playerId: data.playerId, token: data.token, name: data.name };
      saveCoinRacePlayerSession(code, next);
      setSession(next);
      setState(data.state);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Could not join.");
    } finally {
      setJoining(false);
    }
  }

  async function submit(input: {
    chosenPattern: PatternChoice;
    estimatedWinPercent: number;
    bayesPercent: number | null;
    confirm: boolean;
  }) {
    if (!session) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const response = await fetch(`/api/coin-race/rooms/${code}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: session.playerId,
          token: session.token,
          chosenPattern: input.chosenPattern,
          estimatedWinPercent: input.estimatedWinPercent,
          bayesPercent: input.bayesPercent,
          confirm: input.confirm,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not submit.");
      setState(data);
      await refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not submit.");
      throw err;
    } finally {
      setSubmitting(false);
    }
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-6">
        <p className="text-xs tracking-wide text-amber-200/80 uppercase">Coin Pattern Race · Room {code}</p>
        <h1 className="text-2xl font-semibold">Join this race</h1>
        <form className="space-y-3" onSubmit={(event) => void join(event)}>
          <div className="grid gap-2">
            <Label htmlFor="player-name">Display name</Label>
            <Input id="player-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          {joinError ? <p className="text-sm text-destructive">{joinError}</p> : null}
          <Button type="submit" disabled={joining || name.trim().length < 1}>
            {joining ? "Joining…" : "Join"}
          </Button>
        </form>
        <Link href="/coin-race" className="text-sm text-muted-foreground hover:underline">
          Back to coin race
        </Link>
      </div>
    );
  }

  if (loading && !state) {
    return <p className="p-6 text-muted-foreground">Joining the room…</p>;
  }
  if (error || !state) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertTitle>Room unavailable</AlertTitle>
        <AlertDescription>{error ?? "This room does not exist."}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 pb-16">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs tracking-wide text-amber-200/80 uppercase">
            Coin Pattern Race · {state.you?.name} · Room {code}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Pick the pattern that is more likely first</h1>
          {!connected ? <p className="text-sm text-muted-foreground">Reconnecting…</p> : null}
          {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}
        </div>
        <Link href="/coin-race">
          <Button variant="ghost">Home</Button>
        </Link>
      </header>

      {state.status === "lobby" || !state.round ? (
        <Card>
          <CardHeader>
            <CardTitle>Waiting for the host</CardTitle>
            <CardDescription>The teacher starts the first round from the host desk.</CardDescription>
          </CardHeader>
        </Card>
      ) : state.round.phase === "results" ? (
        <CoinRaceResultsScreen state={state} />
      ) : (
        <CoinRaceRoundScreen
          key={state.round.roundNumber}
          state={state}
          submitting={submitting}
          onSubmit={submit}
        />
      )}
    </div>
  );
}
