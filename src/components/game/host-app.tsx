"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useCountdown, useRoomState } from "@/hooks/use-room";
import type { GameConfig, PublicRoomState } from "@/lib/game";
import { bayesPercentError, percentFromProbability } from "@/lib/game/bayes-percents";
import { loadHostSession, loadPlayerSession, saveHostSession, savePlayerSession } from "@/lib/session";
import { BayesPercentFields, type BayesPercentValues } from "./bayes-percent-fields";
import { GameBoard } from "./board";
import { LeaderboardCard, TimerBar } from "./panels";
import { ResultsScreen } from "./results-screen";

export function HostApp(props: { code: string; cookieToken?: string | null; initialState?: PublicRoomState | null }) {
  const code = props.code.toUpperCase();
  const [hostToken, setHostToken] = useState<string | null>(props.cookieToken ?? null);
  const [storageChecked, setStorageChecked] = useState(() => Boolean(props.cookieToken));

  useEffect(() => {
    if (hostToken) {
      saveHostSession(code, hostToken);
      setStorageChecked(true);
      return;
    }
    const stored = loadHostSession(code);
    if (stored) {
      setHostToken(stored);
    }
    setStorageChecked(true);
  }, [code, hostToken]);
  const { state, error, loading, connected, refresh } = useRoomState({
    code,
    hostToken: hostToken ?? undefined,
    enabled: Boolean(hostToken),
    initialState: props.initialState ?? null,
  });

  if (!hostToken) {
    if (!storageChecked) {
      return <p className="p-6 text-muted-foreground">Loading the host desk…</p>;
    }
    return <MissingHost code={code} />;
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
  state: PublicRoomState;
  connected: boolean;
  refresh: () => Promise<void>;
}) {
  const { code, hostToken, state, connected, refresh } = props;
  const [busy, setBusy] = useState<string | null>(null);
  const [joinName, setJoinName] = useState("Teacher");
  const [message, setMessage] = useState<string | null>(null);
  const round = state.round;
  const remaining = useCountdown(round?.deadline, round?.remainingMs, round?.paused);

  async function hostAction(action: string, config?: Partial<GameConfig>) {
    setBusy(action);
    setMessage(null);
    try {
      const response = await fetch(`/api/rooms/${code}/host`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostToken, action, config }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Host action failed.");
      }
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
      const response = await fetch(`/api/rooms/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: joinName }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Could not join.");
      }
      savePlayerSession(code, {
        playerId: data.playerId,
        token: data.token,
        name: data.name,
      });
      window.open(`/room/${code}`, "_blank");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not join.");
    } finally {
      setBusy(null);
    }
  }

  const inPlay = state.status === "playing" || state.status === "paused";
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 pb-16">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs tracking-wide text-amber-200/80 uppercase">Teacher desk</p>
          <h1 className="text-3xl font-semibold tracking-tight">Room {code}</h1>
          <p className="text-sm text-muted-foreground">
            Players join at <span className="font-mono text-foreground">{origin}/room/{code}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => void navigator.clipboard.writeText(`${origin}/room/${code}`)}
          >
            Copy player link
          </Button>
          <Link href="/" className="inline-flex">
            <Button variant="ghost">Home</Button>
          </Link>
        </div>
      </header>

      {!connected ? (
        <Alert>
          <AlertTitle>Reconnecting</AlertTitle>
          <AlertDescription>Live updates paused briefly. Polling will catch up.</AlertDescription>
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
              Start, pause, and end from here. Player counts stay hidden until a round resolves.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {round && inPlay ? (
              <TimerBar
                remainingMs={remaining}
                totalMs={
                  (round.phase === "results"
                    ? state.config.resultsDurationSeconds
                    : state.config.roundDurationSeconds) * 1000
                }
                paused={round.paused}
                label={`Round ${round.roundNumber} · ${round.phase}`}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {state.status === "finished"
                  ? "Game finished. Start again with a new room, or keep this scoreboard up."
                  : "No round is running. Configure the rules, then start."}
              </p>
            )}
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
              <Button variant="secondary" disabled={Boolean(busy)} onClick={() => void hostAction("update-config", { roundDurationSeconds: 45 })}>
                Demo timing (45s)
              </Button>
              <Button variant="secondary" disabled={Boolean(busy)} onClick={() => void hostAction("update-config", { roundDurationSeconds: 240 })}>
                Class timing (4 min)
              </Button>
            </div>
          </CardContent>
        </Card>

        <PlayerRoster state={state} />
      </div>

      <HostConfig
        key={`${state.config.roundDurationSeconds}-${state.config.roundCount}-${state.config.monsterTrait}-${String(state.config.bayesEnabled)}-${String(state.config.hintsEnabled)}-${state.config.priorNoticed}-${state.config.warningLikelihoodIfNoticed}-${state.config.warningLikelihoodIfNotNoticed}`}
        config={state.config}
        locked={inPlay}
        busy={Boolean(busy)}
        onSave={(config) => void hostAction("update-config", config)}
      />

      <Card>
        <CardHeader>
          <CardTitle>Join as a player in another tab</CardTitle>
          <CardDescription>
            Useful for testing locally. This does not reveal other players&apos; squares.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="grid flex-1 gap-2">
            <Label htmlFor="join-name">Display name</Label>
            <Input id="join-name" value={joinName} onChange={(event) => setJoinName(event.target.value)} />
          </div>
          <Button disabled={Boolean(busy)} onClick={() => void joinAsPlayer()}>
            Open player tab
          </Button>
        </CardContent>
      </Card>

      {round ? (
        round.phase === "results" ? (
          <ResultsScreen state={state} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Projector board</CardTitle>
              <CardDescription>
                Legal squares only. Hiding spots stay private until results.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <GameBoard
                monsterTrait={round.monster.trait}
                currentPosition={round.monster.currentPosition}
                legalSquares={round.legalSquares}
                selectedSquare={null}
                hints={round.hints}
                disabled
              />
            </CardContent>
          </Card>
        )
      ) : null}

      {state.status === "finished" ? (
        <LeaderboardCard rows={state.leaderboard} title="Final standings" />
      ) : null}
    </div>
  );
}

function MissingHost(props: { code: string }) {
  const existing = typeof window !== "undefined" ? loadPlayerSession(props.code) : null;
  return (
    <div className="mx-auto max-w-lg space-y-4 p-6">
      <Alert>
        <AlertTitle>This browser is not the host</AlertTitle>
        <AlertDescription>
          Host controls stay on the device that created the room. Open a player seat instead, or create a new room from the home page.
        </AlertDescription>
      </Alert>
      <div className="flex gap-2">
        <Link href={`/room/${props.code}`}>
          <Button>{existing ? "Return to player view" : "Join as a player"}</Button>
        </Link>
        <Link href="/">
          <Button variant="outline">Home</Button>
        </Link>
      </div>
    </div>
  );
}

function PlayerRoster(props: { state: PublicRoomState }) {
  if (props.state.players.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Players</CardTitle>
          <CardDescription>No one has joined yet. Share the room code {props.state.code}.</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Players ({props.state.players.length})</CardTitle>
        <CardDescription>You can see who locked a choice, but not which square they picked.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {props.state.players.map((player) => (
          <div key={player.id} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
            <span>{player.name}</span>
            <span className="text-muted-foreground">
              {player.hasSubmitted ? "Submitted" : "Thinking"}
              {props.state.round?.phase === "results" ? ` · ${player.score}` : ""}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function HostConfig(props: {
  config: GameConfig;
  locked: boolean;
  busy: boolean;
  onSave: (config: Partial<GameConfig>) => void;
}) {
  const [form, setForm] = useState(props.config);
  const [percents, setPercents] = useState<BayesPercentValues>({
    priorPercent: percentFromProbability(props.config.priorNoticed),
    warningIfAlertPercent: percentFromProbability(props.config.warningLikelihoodIfNoticed),
    warningIfCalmPercent: percentFromProbability(props.config.warningLikelihoodIfNotNoticed),
  });
  const [percentError, setPercentError] = useState<string | null>(null);

  function save() {
    const error = bayesPercentError(
      percents.priorPercent,
      percents.warningIfAlertPercent,
      percents.warningIfCalmPercent
    );
    if (error) {
      setPercentError(error);
      return;
    }
    setPercentError(null);
    props.onSave({
      ...form,
      priorNoticed: percents.priorPercent / 100,
      warningLikelihoodIfNoticed: percents.warningIfAlertPercent / 100,
      warningLikelihoodIfNotNoticed: percents.warningIfCalmPercent / 100,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Classroom rules</CardTitle>
        <CardDescription>
          Alert percents apply to the upcoming round, and to the current round if students are
          still choosing. Other rules lock while a round is running unless you use the timing
          presets above in the lobby.
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
        <Field label="Decision window (seconds)">
          <Input
            type="number"
            min={15}
            max={600}
            disabled={props.locked}
            value={form.roundDurationSeconds}
            onChange={(event) => setForm({ ...form, roundDurationSeconds: Number(event.target.value) })}
          />
        </Field>
        <Field label="Base survival reward">
          <Input
            type="number"
            min={10}
            max={1000}
            disabled={props.locked}
            value={form.baseReward}
            onChange={(event) => setForm({ ...form, baseReward: Number(event.target.value) })}
          />
        </Field>
        <Field label="Monster trait">
          <select
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
            disabled={props.locked}
            value={form.monsterTrait}
            onChange={(event) =>
              setForm({ ...form, monsterTrait: event.target.value as GameConfig["monsterTrait"] })
            }
          >
            <option value="auto">Auto (cycle)</option>
            <option value="walker">Walker</option>
            <option value="spider">Spider</option>
            <option value="hunter">Hunter</option>
          </select>
        </Field>
        <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
          Monster can notice the class (Bayes every round)
          <Switch
            checked={form.bayesEnabled}
            disabled={props.locked}
            onCheckedChange={(checked) => setForm({ ...form, bayesEnabled: Boolean(checked) })}
          />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
          Show true hit percents (spoiler)
          <Switch
            checked={form.hintsEnabled}
            disabled={props.locked}
            onCheckedChange={(checked) => setForm({ ...form, hintsEnabled: Boolean(checked) })}
          />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
          Show student calculations
          <Switch
            checked={form.showStudentCalculations}
            disabled={props.locked}
            onCheckedChange={(checked) => setForm({ ...form, showStudentCalculations: Boolean(checked) })}
          />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
          Show leaderboard
          <Switch
            checked={form.showLeaderboard}
            disabled={props.locked}
            onCheckedChange={(checked) => setForm({ ...form, showLeaderboard: Boolean(checked) })}
          />
        </label>
        <BayesPercentFields
          values={percents}
          onChange={(next) => {
            setPercents(next);
            setPercentError(null);
          }}
          disabled={props.busy}
          error={percentError}
        />
        <div className="sm:col-span-2 lg:col-span-3">
          <Button disabled={props.busy} onClick={save}>
            Save rules
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
