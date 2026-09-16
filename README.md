# Hide & Seek Probability

A classroom game for teaching **conditional probability**, the **law of total probability**, and **Bayes' rule**. Players hide on a 3×3 board while one monster moves according to a public trait. Survival points are split with anyone who hid on the same square.

Live: [https://stat-section-games.onrender.com](https://stat-section-games.onrender.com)

This is a Next.js app with a server-authoritative in-memory room. Open it on a laptop, then join from other browser tabs. There are no accounts and no matchmaking. Rooms live in one Node process, so a host like Render (long-running `next start`) is required.

## Run locally

```bash
npm install
npm test
npm run dev
```

Then open [http://127.0.0.1:43147](http://127.0.0.1:43147). Production (`npm start`) binds `0.0.0.0` on `${PORT:-43147}`.

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
4. Enter the hit probability as a **percent** (type `45` for 45%, not `0.45`).
5. On Bayes rounds, also enter `P(noticed | clue)`.
6. Lock in before the timer ends. Late players get a random legal square and no probability bonus.

Player counts and other people's squares stay hidden until the results screen.

### Practice

`/practice` is a single-player version of the same math. Turn on hints to see true probabilities before you submit. Bayes practice uses a Hunter and a hidden noticed-players state.

## What the first round looks like

Round 1 is a Walker on the top edge `(1,0)` — four legal squares, not five uniform 20% spots.

| Mode | P(mode) | What it does from `(1,0)` |
| --- | --- | --- |
| Stay | 10% | stays on `(1,0)` |
| Horizontal | 30% | left or right, equally |
| Vertical | 40% | only down, to the center |
| Wander | 20% | the four legal squares, equally |

Students add down a column. The worksheet for the center is:

`P(1,1) = (0%)(10%) + (0%)(30%) + (100%)(40%) + (25%)(20%) = ?`

which is **45%**. The start square is 15%. Left and right are 20% each.

Every third round is a Bayes challenge (Hunter in a corner, hidden `noticed` state, warning/quiet clue) unless the host turns Bayes off. If it noticed the class, it hunts the center. If not, it stays or sidesteps. A warning updates P(noticed) from 25% to 75%, so the center's hit chance **is** that posterior.

## Scoring

- Survival: `100 / (1 + other players on your square)` if you live, otherwise 0
- Probability bonus: up to 20 points for closeness to the true hit probability, even if you are caught
- Bayes bonus: the same closeness rule on `P(noticed | clue)`

## Tests

```bash
npm test
```

Covers neighbor generation, LOTP 15/20/20/45, Bayes 25% → 75%, edge renormalization, congestion payouts, calibration bonuses, hidden information before resolution, late submissions, and reconnect.

## Notes

Rooms live in the Node process memory. Restarting the server empties rooms. That is enough for a class on one machine.
