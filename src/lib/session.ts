import { DECK } from './deck'
import type { Option, Phase, Snapshot, ServerEvent } from './types'

export type { Option, Phase, Snapshot, ServerEvent }

type Player = { nickname: string; score: number }

type Session = {
  code: string
  phase: Phase
  deckIndex: number
  flagCode: string | null
  options: Option[]
  answerIndex: number
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
    deckIndex: -1,
    flagCode: null,
    options: [],
    answerIndex: -1,
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

export function snapshot(): Snapshot {
  const s = ensureSession()
  const tally = new Array(s.options.length).fill(0)
  for (const idx of s.guesses.values()) tally[idx] = (tally[idx] ?? 0) + 1
  const leaderboard = [...s.players.values()]
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((p) => ({ nickname: p.nickname, score: p.score }))
  return {
    code: s.code,
    phase: s.phase,
    deckIndex: s.deckIndex,
    deckSize: DECK.length,
    players: s.players.size,
    question: s.flagCode
      ? {
          flagCode: s.flagCode,
          options: s.options,
          tally,
          answered: s.guesses.size,
          revealed: s.phase === 'revealed',
        }
      : null,
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

export function openQuestion(deckIndex: number, flagCode: string, options: Option[]): void {
  const s = ensureSession()
  s.deckIndex = deckIndex
  s.flagCode = flagCode
  s.options = options
  s.answerIndex = options.findIndex((o) => o.code === flagCode)
  s.guesses = new Map()
  s.phase = 'guessing'
  broadcastState()
}

export function reveal(): void {
  const s = ensureSession()
  if (s.phase !== 'guessing') return
  s.phase = 'revealed'
  broadcastState()
}

export function end(): void {
  const s = ensureSession()
  s.phase = 'ended'
  s.flagCode = null
  s.options = []
  broadcastState()
}

export function recordGuess(code: string, playerId: string, optionIndex: number): boolean {
  const s = ensureSession()
  if (code !== s.code || s.phase !== 'guessing') return false
  if (!s.players.has(playerId) || s.guesses.has(playerId)) return false
  if (optionIndex < 0 || optionIndex >= s.options.length) return false
  s.guesses.set(playerId, optionIndex)
  if (optionIndex === s.answerIndex) {
    const p = s.players.get(playerId)!
    p.score += 1
  }
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
