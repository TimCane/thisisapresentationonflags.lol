export type Phase = 'lobby' | 'info' | 'guessing' | 'revealed' | 'ended' | 'prize'

export type Option = { code: string; name: string }

// What the server keeps for the current slide: static fields plus, for quiz
// slides, the resolved options/flags and the answer. Live tally/answered are
// merged in at snapshot time.
export type BuiltSlide =
  | { kind: 'title'; notes: string; title: string; subtitle?: string; showCode: boolean }
  | { kind: 'section'; notes: string; title: string; subtitle?: string }
  | { kind: 'guess-flag'; notes: string; flagCode: string; options: Option[]; answerIndex: number }
  | {
      kind: 'which-flag'
      notes: string
      prompt: string
      flags: string[]
      answerIndex: number
      answerName: string
    }

export function isQuiz(slide: BuiltSlide): boolean {
  return slide.kind === 'guess-flag' || slide.kind === 'which-flag'
}

// What clients render. The answer index is withheld until reveal.
export type DisplaySlide =
  | { kind: 'title'; title: string; subtitle?: string; showCode: boolean }
  | { kind: 'section'; title: string; subtitle?: string }
  | {
      kind: 'guess-flag'
      flagCode: string
      options: Option[]
      tally: number[]
      answered: number
      revealed: boolean
      answerIndex: number | null
    }
  | {
      kind: 'which-flag'
      prompt: string
      flags: string[]
      tally: number[]
      answered: number
      revealed: boolean
      answerIndex: number | null
      answerName: string | null
    }

export type Snapshot = {
  code: string
  phase: Phase
  index: number
  total: number
  players: number
  slide: DisplaySlide | null
  // All players in stable join order; column index drives the scoreboard and
  // the origin of each player's floating reactions.
  roster: { nickname: string; score: number }[]
  prizesEnabled: boolean
  // Set only during the 'prize' phase. `everyone` means the whole room wins, so
  // `winner` is null.
  prize: { winner: string | null; everyone: boolean; count: number } | null
}

export type ServerEvent =
  | { type: 'state'; state: Snapshot }
  | { type: 'reaction'; emoji: string; slot: number; streak: number }
