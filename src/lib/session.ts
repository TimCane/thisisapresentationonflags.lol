import { isQuiz } from './types'
import {
  PRIZE_CHANCE,
  PRIZE_MIN_GAP,
  PRIZE_EVERYONE_CHANCE,
  SPEED_MAX_POINTS,
  SPEED_WINDOW_MS,
  SPEED_FLOOR,
  REACTION_SPAM_WINDOW_MS,
} from './constants'
import type { BuiltSlide, DisplaySlide, Snapshot, ServerEvent, Phase } from './types'

export type { BuiltSlide, DisplaySlide, Snapshot, ServerEvent, Phase }

type Player = { nickname: string; score: number }
type Guess = { index: number; at: number }

type Session = {
  code: string
  phase: Phase
  index: number
  total: number
  slide: BuiltSlide | null
  openedAt: number
  guesses: Map<string, Guess>
  players: Map<string, Player>
  lastReaction: Map<string, { emoji: string; at: number; streak: number }>
  prizesEnabled: boolean
  prizeWinner: { winner: string | null; everyone: boolean } | null
  prizeCount: number
  slidesSincePrize: number
}

type Store = {
  session: Session | null
  subscribers: Set<(ev: ServerEvent) => void>
}

// Survive Vite HMR in dev so the live session is not wiped on every edit.
const store: Store = ((globalThis as Record<string, unknown>).__flagStore ??= {
  session: null,
  subscribers: new Set(),
}) as Store

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // no I/O, easy to read on a projector

function randomCode(): string {
  let out = ''
  for (let i = 0; i < 3; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  return out
}

function freshSession(): Session {
  return {
    code: randomCode(),
    phase: 'lobby',
    index: -1,
    total: 0,
    slide: null,
    openedAt: 0,
    guesses: new Map(),
    players: new Map(),
    lastReaction: new Map(),
    prizesEnabled: true,
    prizeWinner: null,
    prizeCount: 0,
    slidesSincePrize: 0,
  }
}

export function ensureSession(): Session {
  if (!store.session) store.session = freshSession()
  return store.session
}

export function getSession(): Session | null {
  return store.session
}

function slotCount(slide: BuiltSlide): number {
  if (slide.kind === 'guess-flag') return slide.options.length
  if (slide.kind === 'which-flag') return slide.flags.length
  return 0
}

function toDisplay(s: Session): DisplaySlide | null {
  const slide = s.slide
  if (!slide) return null
  if (slide.kind === 'title')
    return { kind: 'title', title: slide.title, subtitle: slide.subtitle, showCode: slide.showCode }
  if (slide.kind === 'section')
    return { kind: 'section', title: slide.title, subtitle: slide.subtitle }

  const tally = new Array(slotCount(slide)).fill(0)
  for (const g of s.guesses.values()) tally[g.index] = (tally[g.index] ?? 0) + 1
  const revealed = s.phase === 'revealed'
  const common = {
    tally,
    answered: s.guesses.size,
    revealed,
    answerIndex: revealed ? slide.answerIndex : null,
  }
  if (slide.kind === 'guess-flag')
    return { kind: 'guess-flag', flagCode: slide.flagCode, options: slide.options, ...common }
  return {
    kind: 'which-flag',
    prompt: slide.prompt,
    flags: slide.flags,
    answerName: revealed ? slide.answerName : null,
    ...common,
  }
}

export function snapshot(): Snapshot {
  const s = ensureSession()
  // Stable join order so scoreboard columns and reaction origins do not jump.
  const roster = [...s.players.values()].map((p) => ({ nickname: p.nickname, score: p.score }))
  return {
    code: s.code,
    phase: s.phase,
    index: s.index,
    total: s.total,
    players: s.players.size,
    slide: toDisplay(s),
    roster,
    prizesEnabled: s.prizesEnabled,
    prize:
      s.phase === 'prize' && s.prizeWinner
        ? { winner: s.prizeWinner.winner, everyone: s.prizeWinner.everyone, count: s.prizeCount }
        : null,
  }
}

export function subscribe(fn: (ev: ServerEvent) => void): () => void {
  store.subscribers.add(fn)
  return () => store.subscribers.delete(fn)
}

function broadcast(ev: ServerEvent): void {
  for (const fn of store.subscribers) fn(ev)
}

export function broadcastState(): void {
  broadcast({ type: 'state', state: snapshot() })
}

// --- mutations -------------------------------------------------------------

export function reset(): Snapshot {
  store.session = freshSession()
  broadcastState()
  return snapshot()
}

export type JoinResult = 'ok' | 'wrong-code' | 'name-taken'

export function join(code: string, playerId: string, nickname: string): JoinResult {
  const s = ensureSession()
  if (code !== s.code) return 'wrong-code'
  const name = nickname.slice(0, 24)
  const taken = [...s.players.entries()].some(
    ([id, p]) => id !== playerId && p.nickname.toLowerCase() === name.toLowerCase(),
  )
  if (taken) return 'name-taken'
  const existing = s.players.get(playerId)
  if (existing) existing.nickname = name
  else s.players.set(playerId, { nickname: name, score: 0 })
  broadcastState()
  return 'ok'
}

export function openSlide(index: number, total: number, slide: BuiltSlide): void {
  const s = ensureSession()
  s.index = index
  s.total = total
  s.slide = slide
  s.guesses = new Map()
  s.openedAt = Date.now()
  s.prizeWinner = null
  s.slidesSincePrize += 1
  s.phase = isQuiz(slide) ? 'guessing' : 'info'
  broadcastState()
}

export function setPrizesEnabled(enabled: boolean): void {
  ensureSession().prizesEnabled = enabled
  broadcastState()
}

// True when an advance should pop a prize instead of moving on. Only at clean
// boundaries (after info/reveal), never mid-question, and rate-limited.
export function shouldFirePrize(): boolean {
  const s = ensureSession()
  if (!s.prizesEnabled || s.players.size === 0) return false
  if (s.phase !== 'info' && s.phase !== 'revealed') return false
  if (s.slidesSincePrize < PRIZE_MIN_GAP) return false
  return Math.random() < PRIZE_CHANCE
}

export function firePrize(): boolean {
  const s = ensureSession()
  const ids = [...s.players.keys()]
  if (!ids.length) return false
  const everyone = Math.random() < PRIZE_EVERYONE_CHANCE
  const winner = everyone
    ? null
    : s.players.get(ids[Math.floor(Math.random() * ids.length)])!.nickname
  s.prizeWinner = { winner, everyone }
  s.prizeCount += 1
  s.slidesSincePrize = 0
  s.phase = 'prize'
  broadcastState()
  return true
}

// Full points for an instant correct answer, decaying to the floor by the window.
function speedPoints(elapsedMs: number): number {
  const t = Math.min(Math.max(elapsedMs, 0), SPEED_WINDOW_MS) / SPEED_WINDOW_MS
  return Math.round(SPEED_MAX_POINTS * (1 - t * (1 - SPEED_FLOOR)))
}

export function reveal(): void {
  const s = ensureSession()
  if (s.phase !== 'guessing' || !s.slide) return
  // Score at reveal, not at guess time, so the always-on scoreboard does not
  // leak who guessed right mid-round.
  const answerIndex =
    s.slide.kind === 'guess-flag' || s.slide.kind === 'which-flag' ? s.slide.answerIndex : -1
  for (const [pid, g] of s.guesses) {
    if (g.index === answerIndex) {
      const p = s.players.get(pid)
      if (p) p.score += speedPoints(g.at)
    }
  }
  s.phase = 'revealed'
  broadcastState()
}

export function end(total: number): void {
  const s = ensureSession()
  s.phase = 'ended'
  s.slide = null
  s.prizeWinner = null
  s.index = total
  s.total = total
  broadcastState()
}

export function recordGuess(code: string, playerId: string, optionIndex: number): boolean {
  const s = ensureSession()
  if (code !== s.code || s.phase !== 'guessing' || !s.slide || !isQuiz(s.slide)) return false
  if (!s.players.has(playerId) || s.guesses.has(playerId)) return false
  if (optionIndex < 0 || optionIndex >= slotCount(s.slide)) return false
  // Record the answer and how long it took; scoring happens at reveal.
  s.guesses.set(playerId, { index: optionIndex, at: Date.now() - s.openedAt })
  broadcastState()
  return true
}

export function recordReaction(code: string, playerId: string, emoji: string): boolean {
  const s = ensureSession()
  if (code !== s.code) return false
  const now = Date.now()
  const prev = s.lastReaction.get(playerId)
  if (prev && now - prev.at < 250) return false // rate limit
  // Same emoji again within the window keeps the streak going.
  const streak =
    prev && prev.emoji === emoji && now - prev.at < REACTION_SPAM_WINDOW_MS ? prev.streak + 1 : 1
  s.lastReaction.set(playerId, { emoji, at: now, streak })
  const slot = [...s.players.keys()].indexOf(playerId)
  broadcast({ type: 'reaction', emoji, slot, streak })
  return true
}
