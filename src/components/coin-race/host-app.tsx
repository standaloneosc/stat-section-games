"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimerBar } from "@/components/game/panels";
import { useCoinRaceState, useCountdown } from "@/hooks/use-coin-race";
import type { CoinRaceConfig, PublicCoinRaceState } from "@/lib/coin-race";
import {
  loadCoinRaceHostSession,
  loadCoinRacePlayerSession,
  saveCoinRaceHostSession,
  saveCoinRacePlayerSession,
} from "@/lib/session";
import { CoinRaceResultsScreen } from "./results-screen";
import { PatternTiles } from "./round-screen";

export function CoinRaceHostApp(props: {
  code: string;
  cookieToken?: string | null;
  initialState?: PublicCoinRaceState | null;
}) {
  const code = props.code.toUpperCase();
  const [hostToken, setHostToken] = useState<string | null>(props.cookieToken ?? null);
  const [storageChecked, setStorageChecked] = useState(() => Boolean(props.cookieToken));

  useEffect(() => {
    if (hostToken) {
      saveCoinRaceHostSession(code, hostToken);
      setStorageChecked(true);
      return;
    }
    const stored = loadCoinRaceHostSession(code);
    if (stored) setHostToken(stored);
    setStorageChecked(true);
  }, [code, hostToken]);

  const { state, error, loading, connected, refresh } = useCoinRaceState({
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
          <AlertDescription>
            Host controls stay on the device that created the room.
          </AlertDescription>
        </Alert>
        <Link href={`/coin-race/room/${code}`}>
          <Button>Join as a player</Button>
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
  state: PublicCoinRaceState;
  connected: boolean;
  refresh: () => Promise<void>;
}) {
  const { code, hostToken, state, connected, refresh } = props;
  const [busy, setBusy] = useState<string | null>(null);
  const [joinName, setJoinName] = useState("Teacher");
  const [message, setMessage] = useState<string | null>(null);
  const round = state.round;
  const remaining = useCountdown(round?.deadline, round?.remainingMs, round?.paused);
  const inPlay = state.status === "playing" || state.status === "paused";

  async function hostAction(action: string, config?: Partial<CoinRaceConfig>) {
    setBusy(action);
    setMessage(null);
    try {
      const response = await fetch(`/api/coin-race/rooms/${code}/host`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostToken, action, config }),
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
      const response = await fetch(`/api/coin-race/rooms/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: joinName }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not join.");
      saveCoinRacePlayerSession(code, {
        playerId: data.playerId,
        token: data.token,
        name: data.name,
      });
      window.open(`/coin-race/room/${code}`, "_blank");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not join.");
    } finally {
      setBusy(null);
    }
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 pb-16">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs tracking-wide text-amber-200/80 uppercase">Teacher desk · Coin Pattern Race</p>
          <h1 className="text-3xl font-semibold tracking-tight">Room {code}</h1>
          <p className="text-sm text-muted-foreground">
            Players join at <span className="font-mono text-foreground">{origin}/coin-race/room/{code}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => void navigator.clipboard.writeText(`${origin}/coin-race/room/${code}`)}
          >
            Copy player link
          </Button>
          <Link href="/coin-race" className="inline-flex">
            <Button variant="ghost">Coin race home</Button>
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
          <AlertTitle>Could not complete that action</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Round controls</CardTitle>
            <CardDescription>
              Start after at least one player joins. True win probabilities stay hidden until the
              round resolves.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {round && inPlay ? (
              <TimerBar
                remainingMs={remaining}
                totalMs={
                  (round.phase === "results"
                    ? state.config.resultsDurationSeconds
                    : state.config.decisionTimeSeconds) * 1000
                }
                paused={round.paused}
                label={`Round ${round.roundNumber} · ${round.phase}`}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {state.status === "finished"
                  ? "Game finished."
                  : "No round is running. Set scoring, then start."}
              </p>
            )}
            {round ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <PatternTiles pattern={round.patternA} label="Pattern A" />
                <PatternTiles pattern={round.patternB} label="Pattern B" />
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button disabled={Boolean(busy) || inPlay} onClick={() => void hostAction("start")}>
                Start game
              </Button>
              <Button
                variant="outline"
                disabled={Boolean(busy) || state.status !== "playing" || round?.phase !== "choosing"}
                onClick={() => void hostAction("pause")}
              >
                Pause
              </Button>
              <Button
                variant="outline"
                disabled={Boolean(busy) || state.status !== "paused"}
                onClick={() => void hostAction("resume")}
              >
                Resume
              </Button>
              <Button
                variant="outline"
                disabled={Boolean(busy) || round?.phase !== "choosing"}
                onClick={() => void hostAction("end-round")}
              >
                End round now
              </Button>
              <Button
                variant="outline"
                disabled={Boolean(busy) || round?.phase !== "results"}
                onClick={() => void hostAction("next-round")}
              >
                Next round
              </Button>
              <Button
                variant="destructive"
                disabled={Boolean(busy) || state.status === "lobby"}
                onClick={() => void hostAction("end-game")}
              >
                End game
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                variant="secondary"
                disabled={Boolean(busy)}
                onClick={() => void hostAction("update-config", { decisionTimeSeconds: 45 })}
              >
                Demo timing (45s)
              </Button>
              <Button
                variant="secondary"
                disabled={Boolean(busy)}
                onClick={() => void hostAction("update-config", { decisionTimeSeconds: 180 })}
              >
                Class timing (3 min)
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Players ({state.players.length})</CardTitle>
            <CardDescription>You can see who locked in, not which pattern they picked.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {state.players.length === 0 ? (
              <p className="text-sm text-muted-foreground">No one has joined yet. Share {state.code}.</p>
            ) : (
              state.players.map((player) => (
                <div key={player.id} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
                  <span>{player.name}</span>
                  <span className="text-muted-foreground">
                    {player.hasSubmitted ? "Submitted" : "Thinking"}
                    {round?.phase === "results" ? ` · ${player.score}` : ""}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <HostConfig
        key={JSON.stringify(state.config)}
        config={state.config}
        locked={inPlay}
        busy={Boolean(busy)}
        onSave={(config) => void hostAction("update-config", config)}
      />

      <Card>
        <CardHeader>
          <CardTitle>Join as a player in another tab</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="grid flex-1 gap-2">
            <Label htmlFor="cpr-join-name">Display name</Label>
            <Input id="cpr-join-name" value={joinName} onChange={(event) => setJoinName(event.target.value)} />
          </div>
          <Button disabled={Boolean(busy)} onClick={() => void joinAsPlayer()}>
            Open player tab
          </Button>
        </CardContent>
      </Card>

      {round?.phase === "results" ? <CoinRaceResultsScreen state={state} /> : null}
    </div>
  );
}

function HostConfig(props: {
  config: CoinRaceConfig;
  locked: boolean;
  busy: boolean;
  onSave: (config: Partial<CoinRaceConfig>) => void;
}) {
  const [form, setForm] = useState(props.config);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Scoring config</CardTitle>
        <CardDescription>
          Defaults: 180s decision window, 100/100/50, Bayes off, ties within 0.01. Rules lock while
          a round is running except the timing presets above.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Number of rounds">
          <Input
            type="number"
            min={1}
            max={12}
            disabled={props.locked}
            value={form.roundCount}
            onChange={(event) => setForm({ ...form, roundCount: Number(event.target.value) })}
          />
        </Field>
        <Field label="Decision time (seconds)">
          <Input
            type="number"
            min={15}
            max={600}
            disabled={props.locked}
            value={form.decisionTimeSeconds}
            onChange={(event) => setForm({ ...form, decisionTimeSeconds: Number(event.target.value) })}
          />
        </Field>
        <Field label="Correct-choice points">
          <Input
            type="number"
            min={0}
            max={500}
            disabled={props.locked}
            value={form.correctChoicePoints}
            onChange={(event) => setForm({ ...form, correctChoicePoints: Number(event.target.value) })}
          />
        </Field>
        <Field label="Probability points">
          <Input
            type="number"
            min={0}
            max={500}
            disabled={props.locked}
            value={form.probabilityPoints}
            onChange={(event) => setForm({ ...form, probabilityPoints: Number(event.target.value) })}
          />
        </Field>
        <Field label="Speed points">
          <Input
            type="number"
            min={0}
            max={200}
            disabled={props.locked}
            value={form.speedPoints}
            onChange={(event) => setForm({ ...form, speedPoints: Number(event.target.value) })}
          />
        </Field>
        <Field label="Bayes bonus points">
          <Input
            type="number"
            min={0}
            max={200}
            disabled={props.locked}
            value={form.bayesBonusPoints}
            onChange={(event) => setForm({ ...form, bayesBonusPoints: Number(event.target.value) })}
          />
        </Field>
        <Field label="Choice-tie tolerance">
          <Input
            type="number"
            min={0}
            max={0.5}
            step={0.01}
            disabled={props.locked}
            value={form.choiceTieTolerance}
            onChange={(event) => setForm({ ...form, choiceTieTolerance: Number(event.target.value) })}
          />
        </Field>
        <Field label="Bayes mode">
          <select
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
            disabled={props.locked}
            value={form.bayesMode}
            onChange={(event) =>
              setForm({ ...form, bayesMode: event.target.value as CoinRaceConfig["bayesMode"] })
            }
          >
            <option value="off">Off</option>
            <option value="everyRound">Every round</option>
            <option value="everyThirdRound">Every third round</option>
            <option value="finalRoundOnly">Final round only</option>
          </select>
        </Field>
        <div className="sm:col-span-2 lg:col-span-3">
          <Button disabled={props.locked || props.busy} onClick={() => props.onSave(form)}>
            Save scoring
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Field(props: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-sm">
      <span>{props.label}</span>
      {props.children}
    </label>
  );
}
