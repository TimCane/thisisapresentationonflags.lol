# PLAN

An interactive flag-guessing presentation built in Astro. The presenter drives a
deck of national flags from their phone; the room watches a projector; the
audience guesses each flag and fires off emoji reactions on their own phones.

## Modes

Three views over one shared, global session (one talk at a time).

- **Audience** (`/`) - phones. Enter the room code + a nickname to join, then
  guess the current flag and send reactions.
- **Display** (`/display`) - the projector/TV. Mints and shows the 3-letter join
  code, renders the current flag, live vote distribution, leaderboard, and
  floating reactions.
- **Presenter** (`/presenter`) - the presenter's phone. Enter the room code to
  control the deck (reveal, next), see the answer, speaker notes, and the tally.

### Joining (room code)

Jackbox-style. `/display` mints a fresh 3-letter code when a session starts
(resetting scores + deck position). Audience and presenter type that code to join
the session. The code is visible to the whole room, so it is a join gate, not
real auth - presenter control is available to anyone who enters the code. No
passphrase, no login.

## Content

Two collections:

- **flags** (`src/content/flags/<code>/`): `name`, `continent`, `code`, `flag`,
  `colours` (enum), `features` (tags). 197 seeded; `colours`/`features` drive
  distractor selection.
- **slides** (`src/content/slides/NN-name.md`): the talk deck. One file per
  slide, ordered by filename, with a `kind`-discriminated schema. Every slide
  may carry presenter `notes`.

### Slide types

- `title` - heading + subtitle; optional `showCode` renders the join code big.
- `section` - announces a category ("Flags everyone should know").
- `guess-flag` (mode 1) - "What flag is this?". `answer` flag shown large;
  audience picks the country name. Author may list explicit `options`; otherwise
  3 similar-flag distractors auto-fill.
- `which-flag` (mode 2) - "Which flag is X?". `flags` shown numbered 1..N on the
  screen; audience picks a number. Prompt defaults to the answer's name.

## Slide lifecycle

Presenter-driven via `/presenter`:

- **Advance** moves to the next slide. Static slides (title/section) just show.
  Quiz slides open guessing immediately - options/numbers appear on phones.
- **Reveal** (quiz only) highlights the correct answer everywhere and updates the
  leaderboard.

Guesses lock on submit. Scoring is a flat 1 point per correct answer, accumulated
across the whole deck; the leaderboard ranks players by nickname.

## Distractors (mode 1 auto fill)

When a `guess-flag` slide omits `options`, the server picks 3 visually similar
flags at advance time: rank others by shared `colours`/`features` (+ small
same-continent bonus), break ties randomly, take the closest. Options are
shuffled; everyone sees the same 4.

## Reactions

Ambient - available anytime, independent of the question phase. Fixed palette:
clap, fire, laugh, heart, mind-blown, flag. Taps float/animate across `/display`.

## Realtime

Astro SSR (`@astrojs/node` standalone). One in-memory global session (ephemeral,
gone on restart).

- **Down:** one SSE stream (`/api/events`) broadcasts session state (code, phase,
  slide payload, live tally, leaderboard) plus transient reaction events. The
  answer index is withheld until reveal; presenter answer + notes are embedded in
  the `/presenter` page at render, never on the wire.
- **Up:** `POST` routes for join, guess, react, and presenter control.

Player identity is a uuid minted in the browser (localStorage) alongside the
nickname; sent with every action. Server routes are `prerender = false`.

## State model (in-memory)

- `code`, `phase` (`lobby` | `info` | `guessing` | `revealed` | `ended`),
  `index`, `total`.
- `slide`: the built current slide (static fields, plus resolved options/flags +
  answer for quiz slides).
- `guesses`: playerId -> optionIndex (current slide, locked).
- `players`: playerId -> { nickname, score }.
- subscribers: the set of open SSE streams.
- reactions are broadcast transiently, not stored.

## Routes

- `GET /` - audience view.
- `GET /display` - projector view (creates the session if none, shows the code).
- `GET /presenter` - control view.
- `GET /api/events` - SSE stream of session state + reactions.
- `POST /api/join` - register { code, playerId, nickname }.
- `POST /api/guess` - submit { code, playerId, optionIndex }.
- `POST /api/react` - send { code, playerId, emoji }.
- `POST /api/control` - presenter { code, action } (advance | reveal | reset).

## Out of scope (for now)

- Persistence across sessions, accounts, multiple concurrent rooms.
- Real auth on presenter control (the room code is the only gate, by choice).
- Deploy target tuning (devcontainer + Coolify per house defaults).
