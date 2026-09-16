# Hide & Seek Probability

A local classroom game for teaching **conditional probability**, the **law of total probability**, and **Bayes' rule**. Players hide on a 3×3 board while one monster moves according to a public trait. Survival points are split with anyone who hid on the same square.

This is a Next.js app with a server-authoritative in-memory room. Open it on a laptop, then join from other browser tabs. There are no accounts, no matchmaking, and no production deploy in this slice.

## Run locally

```bash
npm install
npm test
npm run dev
```

Then open [http://127.0.0.1:43147](http://127.0.0.1:43147). The dev server binds `0.0.0.0` on port **43147**.

## How to play

### Host / teacher

1. Click **Create room** on the home page.
2. Share the four-character code or `/room/CODE` link.
3. Optionally set round length (default 240 seconds), trait, Bayes, hints, and leaderboard.
4. Use **Demo timing (45s)** before starting if you do not want a four-minute decision window.
5. **Start game**, then **Pause**, **Resume**, **End round now**, **Next round**, or **End game**.
6. Keep the host tab on `/room/CODE/host`. Host controls stay on the browser that created the room.

### Players

1. Open `/room/CODE` in another tab (or Join from home).
2. Enter a display name.
3. When the round starts, pick a highlighted legal square.
4. Enter the hit probability as a **percent** (type `19` for 19%, not `0.19`).
5. On Bayes rounds, also enter `P(noticed | clue)`.
6. Lock in before the timer ends. Late players get a random legal square and no probability bonus.

Player counts and other people's squares stay hidden until the results screen.

### Practice

`/practice` is a single-player version of the same math. Turn on hints to see true probabilities before you submit. Bayes practice uses a Hunter and a hidden noticed-players state.

## What the first round looks like

Round 1 is the spec's Walker-in-the-center example:

- stay 0.20, horizontal 0.30, vertical 0.30, random local 0.20
- `P(left) = 0.19`, `P(center) = 0.24`
- corners are disabled because they have probability 0

Every third round is a Bayes challenge (Hunter, hidden `noticedPlayers`, warning/quiet clue) unless the host turns Bayes off.

## Scoring

- Survival: `100 / (1 + other players on your square)` if you live, otherwise 0
- Probability bonus: up to 20 points for closeness to the true hit probability, even if you are caught
- Bayes bonus: the same closeness rule on `P(noticed | clue)`

## Tests

```bash
npm test
```

Covers neighbor generation, LOTP 0.19, Bayes 0.7273, edge renormalization, congestion payouts, calibration bonuses, hidden information before resolution, late submissions, and reconnect.

## Notes

Rooms live in the Node process memory. Restarting the dev server empties rooms. That is enough for a class on one machine; it is not a hosted service.
