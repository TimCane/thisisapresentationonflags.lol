import type { FlagInfo } from './flags-data'

function overlap(a: string[], b: string[]): number {
  const set = new Set(a)
  return b.reduce((n, x) => n + (set.has(x) ? 1 : 0), 0)
}

// Score how visually confusable `other` is with `answer`: shared colours weigh
// more than shared features, with a small bonus for the same continent.
function similarity(answer: FlagInfo, other: FlagInfo): number {
  return (
    overlap(answer.colours, other.colours) * 2 +
    overlap(answer.features, other.features) +
    (answer.continent === other.continent ? 0.5 : 0)
  )
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Pick `count` distractor codes for `answer`: prefer the most similar-looking
// flags, breaking ties randomly so the same flag does not always draw the same
// wrong options.
export function pickDistractors(answer: FlagInfo, pool: FlagInfo[], count: number): string[] {
  const others = pool.filter((f) => f.code !== answer.code)
  const ranked = shuffle(others)
    .map((f) => ({ code: f.code, score: similarity(answer, f) }))
    .sort((a, b) => b.score - a.score)
  return ranked.slice(0, count).map((r) => r.code)
}
