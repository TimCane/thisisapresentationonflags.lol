import type { Snapshot } from './types'

export function playerId(): string {
  let id = localStorage.getItem('pid')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('pid', id)
  }
  return id
}

export async function post(url: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json().catch(() => ({}))
}

type Config = { flagUrls: Record<string, string> }

let cfg: Config | null = null
function config(): Config {
  if (!cfg) cfg = JSON.parse(document.getElementById('config')?.textContent ?? '{}')
  return cfg as Config
}

export function flagUrl(code: string): string {
  return config().flagUrls[code] ?? ''
}

export function connect(
  onState: (state: Snapshot) => void,
  onReaction?: (emoji: string, slot: number, streak: number) => void,
): EventSource {
  const es = new EventSource('/api/events')
  es.onmessage = (e) => {
    const ev = JSON.parse(e.data)
    if (ev.type === 'state') onState(ev.state)
    else if (ev.type === 'reaction') onReaction?.(ev.emoji, ev.slot, ev.streak)
  }
  return es
}
