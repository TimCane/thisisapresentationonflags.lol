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

Collection at `src/content/flags/<code>/`:

- `index.md` frontmatter: `name`, `continent`, `code`, `flag`, `colours` (enum),
  `features` (tags), and now optional `notes` (presenter talking points).
- `flag.svg` - the artwork.
- 197 countries seeded; `colours`/`features` drive distractor selection.

The deck for the talk is a curated, ordered subset (`src/lib/deck.ts`, ~20
varied flags). Only deck flags carry `notes`.

## Question lifecycle

Presenter-driven, two taps per flag:

1. **Advance** - presenter taps next; server picks the next deck flag, builds 4
   options (correct + 3 distractors), opens guessing immediately. Options appear
   on audience phones.
2. **Reveal** - presenter taps reveal; correct answer highlighted everywhere,
   leaderboard updates.

Guesses lock on submit (first tap is final). Scoring is a flat 1 point per
correct answer; the leaderboard ranks players by nickname.

## Multiple choice

"Which country is this flag?" - 4 options, one correct. Distractors are chosen
server-side at advance time to be visually similar: rank other flags by shared
`colours`/`features`, take the closest, top up by same continent then random so
there are always 3. Options are shuffled. Everyone sees the same 4.

## Reactions

Ambient - available anytime, independent of the question phase. Fixed palette:
clap, fire, laugh, heart, mind-blown, flag. Taps float/animate across `/display`.

## Realtime

Astro SSR (`@astrojs/node` standalone). One in-memory global session (ephemeral,
gone on restart).

- **Down:** one SSE stream (`/api/events`) broadcasts session state (code, phase,
  current flag, options, live tally, leaderboard) plus transient reaction events.
- **Up:** `POST` routes for join, guess, react, and presenter control.

Player identity is a uuid minted in the browser (localStorage) alongside the
nickname; sent with every action. Server routes are `prerender = false`.

## State model (in-memory)

- `code`, `phase` (`lobby` | `guessing` | `revealed` | `ended`), `deckIndex`.
- current flag `code`, the 4 option codes, the answer.
- `guesses`: playerId -> optionIndex (current question, locked).
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
