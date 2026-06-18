// Shared by server and client bundles.

export const OPTION_COUNT = 4
export const LEADERBOARD_SIZE = 8

// Fixed ambient reaction palette. `key` is the wire value; `emoji` is rendered.
export const REACTIONS = [
  { key: 'clap', emoji: '\u{1F44F}' },
  { key: 'fire', emoji: '\u{1F525}' },
  { key: 'laugh', emoji: '\u{1F602}' },
  { key: 'heart', emoji: '\u{2764}\u{FE0F}' },
  { key: 'mind-blown', emoji: '\u{1F92F}' },
  { key: 'flag', emoji: '\u{1F3F3}\u{FE0F}' },
] as const

export const REACTION_KEYS = REACTIONS.map((r) => r.key)
export const REACTION_EMOJI = Object.fromEntries(REACTIONS.map((r) => [r.key, r.emoji]))
