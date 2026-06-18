import type { APIRoute } from 'astro'
import { join } from '@/lib/session'
import { json, readBody } from '@/lib/http'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  const { code, playerId, nickname } = await readBody(request)
  if (typeof code !== 'string' || typeof playerId !== 'string' || typeof nickname !== 'string')
    return json({ ok: false, error: 'bad request' }, 400)
  if (!nickname.trim()) return json({ ok: false, error: 'nickname required' }, 400)
  const ok = join(code.toUpperCase(), playerId, nickname.trim())
  return json({ ok, error: ok ? undefined : 'wrong code' }, ok ? 200 : 409)
}
