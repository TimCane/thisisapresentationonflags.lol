import type { APIRoute } from 'astro'
import { recordGuess } from '@/lib/session'
import { json, readBody } from '@/lib/http'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  const { code, playerId, optionIndex } = await readBody(request)
  if (typeof code !== 'string' || typeof playerId !== 'string' || typeof optionIndex !== 'number')
    return json({ ok: false, error: 'bad request' }, 400)
  const ok = recordGuess(code.toUpperCase(), playerId, optionIndex)
  return json({ ok })
}
