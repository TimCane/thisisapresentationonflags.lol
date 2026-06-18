import type { APIRoute } from 'astro'
import { buildSlide, slideCount } from '@/lib/slides'
import {
  ensureSession,
  openSlide,
  reveal,
  reset,
  end,
  shouldFirePrize,
  firePrize,
  setPrizesEnabled,
} from '@/lib/session'
import { json, readBody } from '@/lib/http'

export const prerender = false

async function advance(): Promise<void> {
  const s = ensureSession()
  // A clean boundary may pop a prize instead of moving on; it does not consume a
  // slide, so the next advance proceeds to the pending slide.
  if (s.phase !== 'prize' && shouldFirePrize() && firePrize()) return
  const total = await slideCount()
  const next = s.index + 1
  const built = next < total ? await buildSlide(next) : null
  if (!built) {
    end(total)
    return
  }
  openSlide(next, total, built)
}

export const POST: APIRoute = async ({ request }) => {
  const { code, action } = await readBody(request)
  if (typeof code !== 'string' || typeof action !== 'string')
    return json({ ok: false, error: 'bad request' }, 400)

  const s = ensureSession()
  if (code.toUpperCase() !== s.code) return json({ ok: false, error: 'wrong code' }, 409)

  if (action === 'advance') {
    await advance()
    return json({ ok: true })
  }
  if (action === 'reveal') {
    reveal()
    return json({ ok: true })
  }
  if (action === 'prizes-on' || action === 'prizes-off') {
    setPrizesEnabled(action === 'prizes-on')
    return json({ ok: true })
  }
  if (action === 'reset') {
    reset()
    return json({ ok: true })
  }
  return json({ ok: false, error: 'unknown action' }, 400)
}
