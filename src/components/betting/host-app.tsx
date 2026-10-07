"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimerBar } from "@/components/game/panels";
import { useBettingState, useCountdown } from "@/hooks/use-betting";
import type { BettingConfig, PublicBettingState } from "@/lib/betting";
import {
  loadBettingHostSession,
  loadBettingPlayerSession,
  saveBettingHostSession,
  saveBettingPlayerSession,
} from "@/lib/session";
import { BettingLeaderboard, formatMoney } from "./leaderboard";
import { QuestionGrid } from "./question-grid";

export function BettingHostApp(props: {
  code: string;
  cookieToken?: string | null;
  initialState?: PublicBettingState | null;
}) {
  const code = props.code.toUpperCase();
  const [hostToken, setHostToken] = useState<string | null>(props.cookieToken ?? null);
  const [storageChecked, setStorageChecked] = useState(() => Boolean(props.cookieToken));

  useEffect(() => {
    if (hostToken) {
      saveBettingHostSession(code, hostToken);
      setStorageChecked(true);
      return;
    }
    const stored = loadBettingHostSession(code);
    if (stored) setHostToken(stored);
    setStorageChecked(true);
  }, [code, hostToken]);

  const { state, error, loading, connected, refresh } = useBettingState({
    code,
    hostToken: hostToken ?? undefined,
    enabled: Boolean(hostToken),
    initialState: props.initialState ?? null,
  });

  if (!hostToken) {
    if (!storageChecked) {
      return <p className="p-6 text-muted-foreground">Loading the host desk…</p>;
    }
    return (
      <div className="mx-auto max-w-lg space-y-4 p-6">
        <Alert>
          <AlertTitle>This browser is not the host</AlertTitle>
          <AlertDescription>Host controls stay on the device that created the room.</AlertDescription>
        </Alert>
        <Link href={`/betting/room/${code}`}>
          <Button>Join as a group</Button>
        </Link>
      </div>
    );
  }

  if (loading && !state) {
    return <p className="p-6 text-muted-foreground">Loading the host desk…</p>;
  }
  if (error || !state) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertTitle>Host view unavailable</AlertTitle>
        <AlertDescription>{error ?? "This room does not exist."}</AlertDescription>
      </Alert>
    );
  }

  return (
    <HostDesk
      code={code}
      hostToken={hostToken}
      state={state}
      connected={connected}
      refresh={refresh}
    />
  );
}

function HostDesk(props: {
  code: string;
  hostToken: string;
  state: PublicBettingState;
  connected: boolean;
  refresh: () => Promise<void>;
}) {
  const { code, hostToken, state, connected, refresh } = props;
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [joinName, setJoinName] = useState("Teacher");
  const minutes = Math.max(0.5, state.config.timeLimitSeconds / 60);
  const [limitMinutes, setLimitMinutes] = useState(String(minutes));
  const [adjustId, setAdjustId] = useState(state.players[0]?.id ?? "");
  const [adjustAmount, setAdjustAmount] = useState("500");
  const [adjustNote, setAdjustNote] = useState("");
  const remaining = useCountdown(state.deadline, state.remainingMs, state.paused);

  async function hostAction(
    action: string,
    extra?: {
      playerId?: string;
      amount?: number;
      note?: string;
      config?: Partial<BettingConfig>;
    }
  ) {
    setBusy(action);
    setMessage(null);
    try {
      const response = await fetch(`/api/betting/rooms/${code}/host`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostToken, action, ...extra }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Host action failed.");
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Host action failed.");
    } finally {
      setBusy(null);
    }
  }

  async function joinAsPlayer() {
    setBusy("join");
    try {
      const response = await fetch(`/api/betting/rooms/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: joinName }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not join.");
      saveBettingPlayerSession(code, {
        playerId: data.playerId,
        token: data.token,
        name: data.name,
      });
      window.open(`/betting/room/${code}`, "_blank");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not join.");
    } finally {
      setBusy(null);
    }
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const inLobby = state.status === "lobby";
  const canTime = inLobby || state.status === "paused";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 pb-16">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs tracking-wide text-amber-200/80 uppercase">Teacher desk · Question betting</p>
          <h1 className="text-3xl font-semibold tracking-tight">Room {code}</h1>
          <p className="text-sm text-muted-foreground">
            Groups join at{" "}
            <span className="font-mono text-foreground">
              {origin}/betting/room/{code}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => void navigator.clipboard.writeText(`${origin}/betting/room/${code}`)}
          >
            Copy player link
          </Button>
          <Link href="/betting" className="inline-flex">
            <Button variant="ghost">Betting home</Button>
          </Link>
        </div>
      </header>

      {!connected ? (
        <Alert>
          <AlertTitle>Reconnecting</AlertTitle>
          <AlertDescription>Live updates paused briefly.</AlertDescription>
        </Alert>
      ) : null}
      {message ? (
        <Alert variant="destructive">
          <AlertTitle>Host action</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Round clock</CardTitle>
          <CardDescription>
            Set the time limit, then start. Groups may bet on any question until the clock hits zero.
            Final score is their balance at freeze.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-2">
              <Label htmlFor="time-limit">Time limit (minutes)</Label>
              <Input
                id="time-limit"
                className="w-32"
                value={limitMinutes}
                disabled={!canTime}
                onChange={(event) => setLimitMinutes(event.target.value)}
              />
            </div>
            <Button
              variant="outline"
              disabled={busy !== null || !canTime}
              onClick={() =>
                void hostAction("update-config", {
                  config: { timeLimitSeconds: Math.round(Number(limitMinutes) * 60) || 900 },
                })
              }
            >
              Save time limit
            </Button>
            <Button
              variant="secondary"
              disabled={busy !== null || !canTime}
              onClick={() => {
                setLimitMinutes("2");
                void hostAction("update-config", { config: { timeLimitSeconds: 120 } });
              }}
            >
              Demo 2 min
            </Button>
            <Button
              variant="secondary"
              disabled={busy !== null || !canTime}
              onClick={() => {
                setLimitMinutes("15");
                void hostAction("update-config", { config: { timeLimitSeconds: 900 } });
              }}
            >
              Class 15 min
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Current limit: {Math.round(state.config.timeLimitSeconds / 60)} min (
            {state.config.timeLimitSeconds}s).
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy !== null || state.players.length < 1 || state.status !== "lobby"}
              onClick={() => void hostAction("start")}
            >
              Start clock
            </Button>
            <Button
              variant="secondary"
              disabled={busy !== null || state.status !== "playing"}
              onClick={() => void hostAction("pause")}
            >
              Pause
            </Button>
            <Button
              variant="secondary"
              disabled={busy !== null || state.status !== "paused"}
              onClick={() => void hostAction("resume")}
            >
              Resume
            </Button>
            <Button
              variant="destructive"
              disabled={busy !== null || inLobby}
              onClick={() => void hostAction("end-game")}
            >
              End now / freeze
            </Button>
          </div>
          {state.status !== "lobby" ? (
            <TimerBar
              remainingMs={remaining}
              totalMs={state.config.timeLimitSeconds * 1000}
              paused={state.paused}
              label={state.frozen ? "Frozen — final leaderboard" : "Round clock"}
            />
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Question grid</CardTitle>
            <CardDescription>
              Every cell shows its multiplier. Counts are how many groups have locked that item.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <QuestionGrid items={state.grid} showHostCounts />
          </CardContent>
        </Card>
        <div className="space-y-4">
          <BettingLeaderboard
            rows={state.leaderboard}
            title={state.frozen ? "Final leaderboard" : "Live leaderboard"}
          />
          <Card>
            <CardHeader>
              <CardTitle>Give or take points</CardTitle>
              <CardDescription>Signed amount: +500 gives, −500 takes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2">
                <Label htmlFor="adjust-group">Group</Label>
                <select
                  id="adjust-group"
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  value={adjustId}
                  onChange={(event) => setAdjustId(event.target.value)}
                >
                  <option value="">Choose a group</option>
                  {state.players.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name} ({formatMoney(player.balance)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="adjust-amount">Amount</Label>
                <Input
                  id="adjust-amount"
                  value={adjustAmount}
                  onChange={(event) => setAdjustAmount(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="adjust-note">Note (optional)</Label>
                <Input
                  id="adjust-note"
                  value={adjustNote}
                  onChange={(event) => setAdjustNote(event.target.value)}
                />
              </div>
              <Button
                disabled={busy !== null || !adjustId}
                onClick={() =>
                  void hostAction("adjust-balance", {
                    playerId: adjustId,
                    amount: Number(adjustAmount),
                    note: adjustNote,
                  })
                }
              >
                Apply
              </Button>
              {state.balanceLog.length > 0 ? (
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {state.balanceLog.slice(0, 8).map((entry) => (
                    <li key={`${entry.at}-${entry.playerId}`}>
                      {entry.name}: {entry.amount > 0 ? "+" : ""}
                      {formatMoney(entry.amount)} → {formatMoney(entry.balanceAfter)}
                      {entry.note ? ` (${entry.note})` : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Groups</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="grid gap-2">
            <Label htmlFor="host-join-name">Open a player tab</Label>
            <Input
              id="host-join-name"
              value={joinName}
              onChange={(event) => setJoinName(event.target.value)}
            />
          </div>
          <Button variant="secondary" disabled={busy !== null} onClick={() => void joinAsPlayer()}>
            Open player tab
          </Button>
          <p className="text-sm text-muted-foreground">
            {state.players.length === 0
              ? "No groups yet."
              : state.players.map((player) => `${player.name} (${player.answeredCount}/15)`).join(", ")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
