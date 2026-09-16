"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRoomState } from "@/hooks/use-room";
import { loadPlayerSession, savePlayerSession } from "@/lib/session";
import { LeaderboardCard } from "./panels";
import { ResultsScreen } from "./results-screen";
import { RoundScreen } from "./round-screen";

export function PlayerApp(props: { code: string }) {
  const code = props.code.toUpperCase();
  const [session, setSession] = useState(() =>
    typeof window === "undefined" ? null : loadPlayerSession(code)
  );
  const [name, setName] = useState(session?.name ?? "");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { state, error, loading, connected, refresh, setState } = useRoomState({
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
      const response = await fetch(`/api/rooms/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          playerId: session?.playerId,
          token: session?.token,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Could not join that room.");
      }
      const next = { playerId: data.playerId, token: data.token, name: data.name };
      savePlayerSession(code, next);
      setSession(next);
      setState(data.state);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Could not join.");
    } finally {
      setJoining(false);
    }
  }

  async function submit(input: {
    selectedSquare: string;
    estimatedHitPercent: number;
    bayesPercent: number | null;
    confirm: boolean;
  }) {
    if (!session) return;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/rooms/${code}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: session.playerId,
          token: session.token,
          selectedSquare: input.selectedSquare,
          estimatedHitPercent: input.estimatedHitPercent,
          bayesPercent: input.bayesPercent,
          confirm: input.confirm,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Submission failed.");
      }
      setState(data);
      await refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (!session) {
    return (
      <div className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-4 p-4">
        <Card>
          <CardHeader>
            <CardTitle>Join room {code}</CardTitle>
            <CardDescription>Enter the name your classmates will see. No account needed.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={(event) => void join(event)}>
              <div className="grid gap-2">
                <Label htmlFor="name">Display name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Jordan"
                  autoFocus
                />
              </div>
              {joinError ? <p className="text-sm text-destructive">{joinError}</p> : null}
              <Button
                type="submit"
                className="w-full"
                disabled={joining || name.trim().length < 1}
                onClick={(event) => void join(event)}
              >
                {joining ? "Joining…" : "Join the game"}
              </Button>
            </form>
          </CardContent>
        </Card>
        <Link href="/" className="text-center text-sm text-muted-foreground underline">
          Back to home
        </Link>
      </div>
    );
  }

  if (loading && !state) {
    return <p className="p-6 text-muted-foreground">Loading the round…</p>;
  }

  if (error || !state) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-6">
        <Alert variant="destructive">
          <AlertTitle>Could not load room {code}</AlertTitle>
          <AlertDescription>{error ?? "That room code does not exist on this server."}</AlertDescription>
        </Alert>
        <Link href="/">
          <Button>Home</Button>
        </Link>
      </div>
    );
  }

  const waiting = state.status === "lobby" || !state.round;
  const finished = state.status === "finished";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 pb-16">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs tracking-wide text-amber-200/80 uppercase">Hiding as {session.name}</p>
          <h1 className="text-3xl font-semibold tracking-tight">Room {code}</h1>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <p>Your score: <span className="font-mono text-foreground">{state.you?.score ?? 0}</span></p>
          {!connected ? <p className="text-amber-200">Reconnecting…</p> : null}
        </div>
      </header>

      {waiting ? (
        <Alert>
          <AlertTitle>Waiting for the host to start</AlertTitle>
          <AlertDescription>
            {state.players.length === 1
              ? "You are the first player here. Share the room code so others can join from another tab or device."
              : `${state.players.length} players are in the lobby. The board appears when the host starts the game.`}
          </AlertDescription>
        </Alert>
      ) : null}

      {finished ? (
        <div className="space-y-4">
          <Alert>
            <AlertTitle>Game over</AlertTitle>
            <AlertDescription>Final scores are below. Stay on this page if the host wants to talk through the last round.</AlertDescription>
          </Alert>
          {state.round?.phase === "results" ? <ResultsScreen state={state} /> : null}
          <LeaderboardCard rows={state.leaderboard} youId={state.you?.id} title="Final standings" />
        </div>
      ) : state.round?.phase === "results" || state.round?.phase === "resolving" ? (
        <ResultsScreen state={state} />
      ) : (
        <RoundScreen
          key={state.round?.roundNumber}
          state={state}
          submitting={submitting}
          onSubmit={submit}
        />
      )}
    </div>
  );
}
