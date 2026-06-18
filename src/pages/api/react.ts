import type { APIRoute } from 'astro'
import { recordReaction } from '@/lib/session'
import { json, readBody } from '@/lib/http'
import { REACTION_EMOJI } from '@/lib/constants'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  const { code, playerId, reaction } = await readBody(request)
  if (typeof code !== 'string' || typeof playerId !== 'string' || typeof reaction !== 'string')
    return json({ ok: false, error: 'bad request' }, 400)
  const emoji = REACTION_EMOJI[reaction]
  if (!emoji) return json({ ok: false, error: 'unknown reaction' }, 400)
  const ok = recordReaction(code.toUpperCase(), playerId, emoji)
  return json({ ok })
}
