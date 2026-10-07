# Stat Section Games

Classroom probability games: **Hide & Seek** (LOTP, Bayes, congestion scoring), **Coin Pattern Race** (pattern-before-pattern waiting probabilities), and **Question betting** (interview problems with 2x–4x stakes). Local multiplayer, no accounts.

Live: [https://stat-section-games.onrender.com](https://stat-section-games.onrender.com)

This is a Next.js app with server-authoritative in-memory rooms. Open it on a laptop, then join from other browser tabs. Rooms live in one Node process, so a host like Render (long-running `next start`) is required.

## Run locally

```bash
npm install
npm test
npm run dev
```

Then open [http://127.0.0.1:43147](http://127.0.0.1:43147). Production (`npm start`) binds `0.0.0.0` on `${PORT:-43147}`.

## Routes

| | Hide & Seek | Coin Pattern Race | Question betting |
| --- | --- | --- | --- |
| Home / picker | [`/`](/) | [`/`](/) | [`/`](/) |
| Game hub | [`/hide-and-seek`](/hide-and-seek) | [`/coin-race`](/coin-race) | [`/betting`](/betting) |
| Host desk | [`/room/CODE/host`](/room/CODE/host) | [`/coin-race/room/CODE/host`](/coin-race/room/CODE/host) | [`/betting/room/CODE/host`](/betting/room/CODE/host) |
| Player | [`/room/CODE`](/room/CODE) | [`/coin-race/room/CODE`](/coin-race/room/CODE) | [`/betting/room/CODE`](/betting/room/CODE) |
| Practice | [`/practice`](/practice) | [`/coin-race/practice`](/coin-race/practice) | [`/betting/practice`](/betting/practice) |

Create-room forms work without client JavaScript: they POST to the API and set a host cookie.

## Coin Pattern Race

Players see two equal-length patterns (2 or 3 letters), such as HHT vs THT or HT vs TH, plus any flips so far. A fair coin is flipped until one pattern appears as consecutive faces. The graded answer is **P(this pattern appears before the other | current suffix)**, from a suffix/state chain — not P(the next few flips equal that pattern).

Each round is sampled independently:

- **About two thirds** use length-3 patterns; **about one third** use length-2 pairs (HT vs TH, HH vs HT, TT vs TH, …).
- **Half** start from a **blank history**; **half** show a **random first flip** H or T. Starts that already finish a pattern or make one side impossible are redrawn.

Examples: HHT vs THT from empty → 62.5%/37.5%; HHT vs THT after **H** → 75%/25%; HT vs TH from empty → 50%/50%.

### Host

1. Open **Coin Pattern Race** from the home picker, then **Create room**.
2. Share `/coin-race/room/CODE`.
3. On `/coin-race/room/CODE/host`, set **Scoring config** (defaults: 180s, 100/100/50, Bayes off, tie tolerance 0.01). Bayes mode: off / every round / every third round / final round only.
4. Click **Start game** after at least one player joins. Then **Pause**, **Resume**, **End round now**, **Next round**, or **End game**.
5. True win probabilities stay hidden until submissions close. The random race winner is shown on results but does **not** decide correct-choice points.

### Players

1. Join `/coin-race/room/CODE` with a display name.
2. Choose Pattern A or B, enter P(your pattern first) as a percent (`75` not `0.75`), and lock in. Speed points use the server timestamp of that complete submission.
3. On a Bayes round, also enter P(biased coin | observed flips). Prior 50/50; fair P(H)=50%; biased P(H)=75%. Example: P(B | HT) = 3/7.

### Scoring (max 250, or 300 with Bayes)

| Category | Default max |
| --- | --- |
| Correct choice | 100 |
| Probability accuracy | 100 |
| Speed | 50 |
| Bayes bonus | 0 or 50 |

Example: choose HHT, q = 0.70, submit at 90s of 180s, no Bayes → 100 + 80 + 25 = **205**, even if THT happens to appear first.

Results list each category separately.

## Hide & Seek

Players hide on a 3×3 board while one monster moves according to a public trait. Survival points split with anyone who hid on the same square.

### Host / teacher

1. Open **Hide & Seek** from the home picker (or `/hide-and-seek`) and **Create room**.
2. Share `/room/CODE`.
3. Optionally set round length (default 240 seconds), trait, Bayes, **Alert percents** (default P(Alert) 40%, P(warning | Alert) 80%, P(warning | Calm) 20%), spoiler percents, and leaderboard.
4. **Start game**, then **Pause**, **Resume**, **End round now**, **Next round**, or **End game**. Host tab stays on `/room/CODE/host`.

### Players

1. Open `/room/CODE`, enter a name.
2. Use the lightbulb (on = warning, off = quiet), the Calm and Alert tables, and the facts box (current host percents, not hardcoded 40/80/20).
3. Pick a legal square, enter percents, lock in.

### Scoring

- Survival: `100 / (1 + other players on your square)` if you live, otherwise 0
- Probability bonus: up to 20 points for closeness to the true hit probability
- Bayes bonus: the same closeness rule on `P(noticed | clue)`

Round 1 is a Walker in the center: Calm LOTP `P(left)=0.19`, `P(center)=0.24`. Alert hunts the middle (60% stay / 10% each side).

## Question betting

Fifteen interview questions. Groups start at **10,000**. Before they bet they see the question’s multiplier as a large amber chip (**2x**, **2.5x**, **3x**, **3.5x**, or **4x**) on the player board, practice, host desk, and the question list. Correct: `balance − bet + bet × multiplier`. Wrong: lose the bet. Bet 0 is allowed. Max bet is `min(10,000, balance)`.

### Host

1. Open **Question betting**, **Create room**, share `/betting/room/CODE`.
2. Groups join with a team name.
3. On `/betting/room/CODE/host`, click **Start game** (question 1) or pick any row in the bank (each row shows its multiplier).
4. **Pause** / **Resume**, **Reveal / lock** to grade and pay out, **Next question**, or **End game**.
5. **Give or take points**: pick a group, enter a signed amount, apply. The live leaderboard is always on the desk.

Distribution questions use a family dropdown (Bernoulli, Binomial, Geometric, Poisson, Hypergeometric, Uniform discrete, Normal, Exponential) plus only the parameters that family needs.

### Practice

`/betting/practice` uses a fake 10,000 and the same bank. Multipliers stay visible before lock-in.

## Tests

```bash
npm test
```

Hide-and-seek: neighbor generation, Walker-center LOTP, Bayes 0.40/0.80/0.20, congestion, hidden information.

Coin Pattern Race: HHT vs THT → 0.75/0.25 from suffix H; scoring 205; Bayes P(B|HT)=3/7; ties; probability points table; speed at 90s of 180s = 25.

Question betting: payout 10k+1000 at 2.5x → 11500; keys 5/16, 2.45, 2.718, 14.7, 16/31, 2/3, 7/12, 84, Hypergeometric(20,7,5), Bin(n,1/3); multiplier published before lock-in.

## Notes

Rooms live in the Node process memory. Restarting the server empties rooms. That is enough for a class on one machine.
