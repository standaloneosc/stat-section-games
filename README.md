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
3. Optionally set round length (default 240 seconds), trait, Bayes, spoiler percents, and leaderboard.
4. Use **Demo timing (45s)** before starting if you do not want a four-minute decision window.
5. **Start game**, then **Pause**, **Resume**, **End round now**, **Next round**, or **End game**.
6. Keep the host tab on `/room/CODE/host`. Host controls stay on the browser that created the room.

Create room works without client JavaScript: the form posts to `/api/rooms` and sets a host cookie.

### Players

1. Open `/room/CODE` in another tab (or Join from home).
2. Enter a display name.
3. When the round starts, read the clue (red warning light or all quiet).
4. Update how likely the monster noticed the class, pick a highlighted legal square, and estimate the hit chance. Corners are off for a Walker in the center.
5. Enter percents (type `20` for 20%, not `0.20`).
6. Lock in before the timer ends. Late players get a random legal square and no probability bonus.

The player board does **not** show worked calculations or true square percents. Host and practice score against the true values after lock-in.

Player counts and other people's squares stay hidden until the results screen.

### Practice

`/practice` is a single-player version of the same math. Leave true hit percents off to work by hand. The clue / two moods switch is on by default.

## What the first round looks like

Round 1 is a Walker in the **center** `(1,1)` — five legal squares (stay plus the four sides). Corners are out of range.

| Mode | How often | Where it goes |
| --- | --- | --- |
| Stay | 20% | stays on the current square |
| Horizontal | 30% | left or right, equally |
| Vertical | 30% | up or down, equally |
| Wander | 20% | stay or any orthogonal neighbor, equally |

Students add those Calm modes themselves (LOTP). If Alert (angry), the Walker hunts the middle on the same five squares: Stay 60%, each side 10%. Those are P(square | Alert), not P(hit | clue). Students mix Alert vs Calm after Bayes. Teachers can check mixed hit answers (`P(left) = 0.19` Calm-only, or the posterior mix) after lock-in — those answers are not printed on the player board.

Every round has two hidden moods unless the host turns the clue off:

- **Alert** — it noticed the class and hunts the middle
- **Calm** — it did not notice you and mixes Stay / Horizontal / Vertical / Wander

The clue is something students can see: a red warning light, or all quiet. World facts they can plug into Bayes: it notices the class 40% of the time; a warning happens 80% of the time when Alert and 20% of the time when Calm. They calculate P(Alert | clue), then P(hit this square). The player board does not print the posterior or the true hit percents.

## Scoring

- Survival: `100 / (1 + other players on your square)` if you live, otherwise 0
- Probability bonus: up to 20 points for closeness to the true hit probability, even if you are caught
- Bayes bonus: the same closeness rule on `P(noticed | clue)`

## Tests

```bash
npm test
```

Covers neighbor generation, Walker-center LOTP 0.19/0.24, Bayes 0.40/0.80/0.20 → ≈0.7273, hunt-center weights, edge renormalization, congestion payouts, calibration bonuses, hidden information before resolution, late submissions, and reconnect.

## Notes

Rooms live in the Node process memory. Restarting the server empties rooms. That is enough for a class on one machine.
