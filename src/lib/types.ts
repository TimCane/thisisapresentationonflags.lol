export type Phase = 'lobby' | 'guessing' | 'revealed' | 'ended'

export type Option = { code: string; name: string }

export type Question = {
  flagCode: string
  options: Option[]
  tally: number[]
  answered: number
  revealed: boolean
}

export type Snapshot = {
  code: string
  phase: Phase
  deckIndex: number
  deckSize: number
  players: number
  question: Question | null
  leaderboard: { nickname: string; score: number }[]
}

export type ServerEvent = { type: 'state'; state: Snapshot } | { type: 'reaction'; emoji: string }
