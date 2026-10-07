"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimerBar } from "@/components/game/panels";
import { useBettingState, useCountdown } from "@/hooks/use-betting";
import { maxAllowedBet, type PlayerAnswer, type PublicGridItem } from "@/lib/betting";
import { loadBettingPlayerSession, saveBettingPlayerSession } from "@/lib/session";
import { AnswerFields, BetField } from "./answer-fields";
import { BettingLeaderboard, formatMoney } from "./leaderboard";
import { QuestionGrid } from "./question-grid";
import { QuestionPrompt } from "./question-prompt";

export function BettingPlayerApp(props: { code: string }) {
  const code = props.code.toUpperCase();
  const [session, setSession] = useState(() =>
    typeof window === "undefined" ? null : loadBettingPlayerSession(code)
  );
  const [name, setName] = useState(session?.name ?? "");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [answer, setAnswer] = useState<PlayerAnswer>({});
  const [bet, setBet] = useState("0");
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { state, error, loading, connected, refresh, setState } = useBettingState({
    code,
    playerId: session?.playerId,
    token: session?.token,
    enabled: Boolean(session),
  });
  const remaining = useCountdown(state?.deadline, state?.remainingMs, state?.paused);

  async function join(event?: React.FormEvent | React.MouseEvent) {
    event?.preventDefault();
    if (joining) return;
    setJoining(true);
    setJoinError(null);
    try {
      const response = await fetch(`/api/betting/rooms/${code}/join`, {
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
      saveBettingPlayerSession(code, next);
      setSession(next);
      setState(data.state);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Could not join.");
    } finally {
      setJoining(false);
    }
  }

  function pick(id: number) {
    setSelectedId(id);
    setAnswer({});
    setBet("0");
    setSubmitError(null);
  }

  async function lockIn(item: PublicGridItem) {
    if (!session) return;
    setBusy(true);
    setSubmitError(null);
    try {
      const response = await fetch(`/api/betting/rooms/${code}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: session.playerId,
          token: session.token,
          questionId: item.id,
          bet: Number(bet) || 0,
          answer,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not lock in.");
      setState(data);
      await refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not lock in.");
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-6">
        <p className="text-xs tracking-wide text-amber-200/80 uppercase">
          Question betting · Room {code}
        </p>
        <h1 className="text-2xl font-semibold">Join as a group</h1>
        <form className="space-y-3" onSubmit={(event) => void join(event)}>
          <div className="grid gap-2">
            <Label htmlFor="group-name">Group name</Label>
            <Input
              id="group-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Table 3"
            />
          </div>
          {joinError ? <p className="text-sm text-destructive">{joinError}</p> : null}
          <Button type="submit" disabled={joining || name.trim().length < 1} className="w-full">
            {joining ? "Joining…" : "Join room"}
          </Button>
        </form>
      </div>
    );
  }

  if (loading && !state) {
    return <p className="p-6 text-muted-foreground">Loading the room…</p>;
  }
  if (error || !state) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertTitle>Could not load this room</AlertTitle>
        <AlertDescription>{error ?? "Check the code and try again."}</AlertDescription>
      </Alert>
    );
  }

  const selected = state.grid.find((item) => item.id === selectedId) ?? null;
  const maxBet = maxAllowedBet(state.you?.balance ?? 0);
  const open = state.status === "playing" && !state.paused && !state.frozen;
  const totalMs = state.config.timeLimitSeconds * 1000;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 pb-16">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs tracking-wide text-amber-200/80 uppercase">
            Question betting · {state.you?.name} · Room {code}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Balance {formatMoney(state.you?.balance ?? 0)}
          </h1>
          <p className="text-sm text-muted-foreground">
            {state.you?.answeredCount ?? 0} of 15 locked in. Final score is this balance when time
            runs out.
          </p>
        </div>
        <Link href="/betting">
          <Button variant="ghost">Betting home</Button>
        </Link>
      </header>

      {!connected ? (
        <Alert>
          <AlertTitle>Reconnecting</AlertTitle>
          <AlertDescription>Live updates paused briefly.</AlertDescription>
        </Alert>
      ) : null}

      {state.status === "lobby" ? (
        <Card>
          <CardHeader>
            <CardTitle>Waiting for the host to start the clock</CardTitle>
            <CardDescription>
              You can already see the full bank. Each cell shows its multiplier. Bets open when the
              timer starts.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <TimerBar
          remainingMs={remaining}
          totalMs={totalMs}
          paused={state.paused}
          label={state.frozen ? "Time is up — balances frozen" : "Round clock"}
        />
      )}

      {state.frozen ? (
        <Alert>
          <AlertTitle>Final score: {formatMoney(state.you?.balance ?? 0)}</AlertTitle>
          <AlertDescription>
            Unanswered questions stay unanswered. The leaderboard below is the finish.
          </AlertDescription>
        </Alert>
      ) : null}

      <QuestionGrid
        items={state.grid}
        selectedId={selectedId}
        onSelect={pick}
        disabled={!open && !state.frozen && state.status !== "lobby"}
      />

      {selected ? (
        <Card>
          <CardHeader>
            <QuestionPrompt question={selected} />
          </CardHeader>
          <CardContent className="space-y-4">
            {selected.yourResult ? (
              <div className="space-y-1 text-sm">
                <p>
                  {selected.yourResult.correct ? "Correct." : "Incorrect."} This question paid{" "}
                  <span className="font-mono font-semibold">{selected.multiplierLabel}</span>. Key:{" "}
                  {selected.yourResult.correctKey}
                </p>
                <p>
                  Bet {formatMoney(selected.yourResult.bet)}, change{" "}
                  {selected.yourResult.delta >= 0 ? "+" : ""}
                  {formatMoney(selected.yourResult.delta)}.
                </p>
              </div>
            ) : open ? (
              <>
                <AnswerFields kind={selected.kind} value={answer} onChange={setAnswer} disabled={busy} />
                <BetField
                  bet={bet}
                  onChange={setBet}
                  maxBet={maxBet}
                  multiplierLabel={selected.multiplierLabel}
                  disabled={busy}
                />
                {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}
                <Button disabled={busy} onClick={() => void lockIn(selected)}>
                  {busy ? "Locking in…" : "Lock in"}
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {state.paused
                  ? "Paused — wait for the host."
                  : state.frozen
                    ? "Time is up. You did not lock this one in."
                    : "Waiting for the clock to start."}
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      <BettingLeaderboard rows={state.leaderboard} highlightId={state.you?.id} />
    </div>
  );
}
