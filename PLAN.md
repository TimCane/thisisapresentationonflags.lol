# PLAN

An interactive flag-guessing presentation built in Astro. The presenter drives a
slideshow of national flags; the audience, on their own phones, guesses each flag
and fires off reactions that surface live on the presenter's screen.

## Modes

Two views over one shared, global session (one talk at a time).

- **Audience** (`/`) - the default. Anyone visiting joins the current session,
  sees the current flag, submits a multiple-choice guess, and sends reactions.
- **Presenter** (`/present`) - an unguessable secret route. Source of truth for
  the current slide; advances flags and watches guesses/reactions roll in.

No login. Control is gated only by knowing the `/present` path.

## Content

Existing collection at `src/content/flags/<code>/`:

- `index.md` frontmatter: `name`, `continent`, `code`, `flag` (relative svg).
- `flag.svg` - the artwork.
- ~197 countries already seeded.

Multiple-choice options are generated from this set (correct answer + distractors,
preferably same-continent for plausibility).

## Realtime

Astro SSR. Server holds session state in memory (ephemeral, gone on restart).

- **Down (server -> client):** Server-Sent Events. Clients subscribe to one SSE
  endpoint and receive slide changes, reaction bursts, and live guess tallies.
- **Up (client -> server):** plain `POST` API routes for guesses, reactions, and
  presenter slide control.

SSE fits because the data flow is overwhelmingly broadcast-down; the few
client->server actions are fine as POSTs.

## Slide control

Presenter drives, audience follows. The presenter advances the flag; an SSE event
pushes the new slide to every audience screen so they stay in sync.

## Guessing

Multiple choice. Each flag presents N options; audience taps one. Server scores
exactly against the correct country and broadcasts an aggregate tally (and/or the
reveal) back to all screens.

## Reactions

Fixed emoji palette (e.g. clap, fire, laugh, heart). Audience taps an emoji; it
animates/floats on the presenter screen.

## State model (in-memory)

- Current slide index / flag code.
- Per-flag guess tallies.
- Reaction stream (recent, ephemeral).
- Connected client count (optional, for presenter awareness).

## Routes (sketch)

- `GET /` - audience view.
- `GET /present` - presenter view.
- `GET /api/events` - SSE stream.
- `POST /api/guess` - submit a guess.
- `POST /api/react` - send a reaction.
- `POST /api/slide` - presenter advances/sets the current flag.

## Open questions

- Reveal timing: does the presenter trigger the answer reveal, or auto-reveal
  after a timer / once guesses settle?
- Scoring: per-correct points only, or speed-weighted? Any leaderboard, given
  state is ephemeral and anonymous?
- Number of choices per question and distractor strategy.
- How presenter actions are themselves authorized on the POST endpoints (the
  secret route hides the UI, but the API is still open).
- Astro SSR adapter + deploy target (devcontainer + Coolify per house defaults).

## Out of scope (for now)

- Persistence across sessions, accounts, multiple concurrent rooms.
- Committing `src/content/flags` (staged but intentionally not committed yet).
