import type { APIRoute } from 'astro'
import { ensureSession, snapshot, subscribe, type ServerEvent } from '@/lib/session'

export const prerender = false

export const GET: APIRoute = () => {
  ensureSession()
  const encoder = new TextEncoder()
  let unsub: (() => void) | undefined
  let ping: ReturnType<typeof setInterval> | undefined

  const stream = new ReadableStream({
    start(controller) {
      const send = (ev: ServerEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`))
        } catch {
          unsub?.()
        }
      }
      send({ type: 'state', state: snapshot() })
      unsub = subscribe(send)
      ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'))
        } catch {
          unsub?.()
        }
      }, 25000)
    },
    cancel() {
      unsub?.()
      if (ping) clearInterval(ping)
    },
  })

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  })
}
