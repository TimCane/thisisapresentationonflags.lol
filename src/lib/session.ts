import { isQuiz } from './types'
import { PRIZE_CHANCE, PRIZE_MIN_GAP } from './constants'
import type { BuiltSlide, DisplaySlide, Snapshot, ServerEvent, Phase } from './types'

export type { BuiltSlide, DisplaySlide, Snapshot, ServerEvent, Phase }

type Player = { nickname: string; score: number }

type Session = {
  code: string
  phase: Phase
  index: number
  total: number
  slide: BuiltSlide | null
  guesses: Map<string, number>
  players: Map<string, Player>
  lastReactionAt: Map<string, number>
  prizesEnabled: boolean
  prizeWinner: { nickname: string } | null
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
    guesses: new Map(),
    players: new Map(),
    lastReactionAt: new Map(),
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
  for (const idx of s.guesses.values()) tally[idx] = (tally[idx] ?? 0) + 1
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
        ? { winner: s.prizeWinner.nickname, count: s.prizeCount }
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

export function join(code: string, playerId: string, nickname: string): boolean {
  const s = ensureSession()
  if (code !== s.code) return false
  const existing = s.players.get(playerId)
  if (existing) existing.nickname = nickname.slice(0, 24)
  else s.players.set(playerId, { nickname: nickname.slice(0, 24), score: 0 })
  broadcastState()
  return true
}

export function openSlide(index: number, total: number, slide: BuiltSlide): void {
  const s = ensureSession()
  s.index = index
  s.total = total
  s.slide = slide
  s.guesses = new Map()
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
  const winner = s.players.get(ids[Math.floor(Math.random() * ids.length)])!
  s.prizeWinner = { nickname: winner.nickname }
  s.prizeCount += 1
  s.slidesSincePrize = 0
  s.phase = 'prize'
  broadcastState()
  return true
}

export function reveal(): void {
  const s = ensureSession()
  if (s.phase !== 'guessing' || !s.slide) return
  // Score at reveal, not at guess time, so the always-on scoreboard does not
  // leak who guessed right mid-round.
  const answerIndex =
    s.slide.kind === 'guess-flag' || s.slide.kind === 'which-flag' ? s.slide.answerIndex : -1
  for (const [pid, idx] of s.guesses) {
    if (idx === answerIndex) {
      const p = s.players.get(pid)
      if (p) p.score += 1
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
  // Just record; scoring happens at reveal (see reveal()).
  s.guesses.set(playerId, optionIndex)
  broadcastState()
  return true
}

export function recordReaction(code: string, playerId: string, emoji: string): boolean {
  const s = ensureSession()
  if (code !== s.code) return false
  const now = Date.now()
  const last = s.lastReactionAt.get(playerId) ?? 0
  if (now - last < 250) return false
  s.lastReactionAt.set(playerId, now)
  const slot = [...s.players.keys()].indexOf(playerId)
  broadcast({ type: 'reaction', emoji, slot })
  return true
}
