import { isQuiz } from './types'
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
  return { kind: 'which-flag', prompt: slide.prompt, flags: slide.flags, ...common }
}

export function snapshot(): Snapshot {
  const s = ensureSession()
  const leaderboard = [...s.players.values()]
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((p) => ({ nickname: p.nickname, score: p.score }))
  return {
    code: s.code,
    phase: s.phase,
    index: s.index,
    total: s.total,
    players: s.players.size,
    slide: toDisplay(s),
    leaderboard,
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
  s.phase = isQuiz(slide) ? 'guessing' : 'info'
  broadcastState()
}

export function reveal(): void {
  const s = ensureSession()
  if (s.phase !== 'guessing') return
  s.phase = 'revealed'
  broadcastState()
}

export function end(total: number): void {
  const s = ensureSession()
  s.phase = 'ended'
  s.slide = null
  s.index = total
  s.total = total
  broadcastState()
}

export function recordGuess(code: string, playerId: string, optionIndex: number): boolean {
  const s = ensureSession()
  if (code !== s.code || s.phase !== 'guessing' || !s.slide || !isQuiz(s.slide)) return false
  if (!s.players.has(playerId) || s.guesses.has(playerId)) return false
  if (optionIndex < 0 || optionIndex >= slotCount(s.slide)) return false
  s.guesses.set(playerId, optionIndex)
  const answerIndex =
    s.slide.kind === 'guess-flag' || s.slide.kind === 'which-flag' ? s.slide.answerIndex : -1
  if (optionIndex === answerIndex) s.players.get(playerId)!.score += 1
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
  broadcast({ type: 'reaction', emoji })
  return true
}
