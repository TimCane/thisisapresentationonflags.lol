import type { APIRoute } from 'astro'
import { DECK } from '@/lib/deck'
import { OPTION_COUNT } from '@/lib/constants'
import { allFlags, flagByCode } from '@/lib/flags-data'
import { pickDistractors } from '@/lib/distractors'
import { ensureSession, openQuestion, reveal, reset, end, type Option } from '@/lib/session'
import { json, readBody } from '@/lib/http'

export const prerender = false

function shuffle<T>(items: T[]): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

async function advance(): Promise<void> {
  const s = ensureSession()
  const next = s.deckIndex + 1
  if (next >= DECK.length) {
    end()
    return
  }
  const flagCode = DECK[next]
  const answer = await flagByCode(flagCode)
  if (!answer) {
    end()
    return
  }
  const pool = await allFlags()
  const names = new Map(pool.map((f) => [f.code, f.name]))
  const distractors = pickDistractors(answer, pool, OPTION_COUNT - 1)
  const options: Option[] = shuffle([flagCode, ...distractors]).map((c) => ({
    code: c,
    name: names.get(c) ?? c,
  }))
  openQuestion(next, flagCode, options)
}

export const POST: APIRoute = async ({ request }) => {
  const { code, action } = await readBody(request)
  if (typeof code !== 'string' || typeof action !== 'string')
    return json({ ok: false, error: 'bad request' }, 400)

  const s = ensureSession()
  if (action === 'reset') {
    if (code.toUpperCase() !== s.code) return json({ ok: false, error: 'wrong code' }, 409)
    reset()
    return json({ ok: true })
  }
  if (code.toUpperCase() !== s.code) return json({ ok: false, error: 'wrong code' }, 409)

  if (action === 'advance') {
    await advance()
    return json({ ok: true })
  }
  if (action === 'reveal') {
    reveal()
    return json({ ok: true })
  }
  return json({ ok: false, error: 'unknown action' }, 400)
}
