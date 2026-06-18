import { getCollection } from 'astro:content'
import { allFlags, flagByCode } from './flags-data'
import { pickDistractors } from './distractors'
import { OPTION_COUNT } from './constants'
import type { BuiltSlide, Option } from './types'

type SlideData =
  | { kind: 'title'; title: string; subtitle?: string; showCode: boolean; notes?: string }
  | { kind: 'section'; title: string; subtitle?: string; notes?: string }
  | { kind: 'guess-flag'; answer: string; options?: string[]; notes?: string }
  | { kind: 'which-flag'; flags: string[]; answer: string; prompt?: string; notes?: string }

let cache: SlideData[] | null = null

// Ordered by entry id (the filename, e.g. 00-title), so renaming reorders.
async function rawSlides(): Promise<SlideData[]> {
  if (cache) return cache
  const entries = await getCollection('slides')
  entries.sort((a, b) => a.id.localeCompare(b.id))
  cache = entries.map((e) => e.data as SlideData)
  return cache
}

export async function slideCount(): Promise<number> {
  return (await rawSlides()).length
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export async function buildSlide(index: number): Promise<BuiltSlide | null> {
  const raw = (await rawSlides())[index]
  if (!raw) return null
  const notes = raw.notes ?? ''

  if (raw.kind === 'title') {
    return {
      kind: 'title',
      notes,
      title: raw.title,
      subtitle: raw.subtitle,
      showCode: raw.showCode,
    }
  }
  if (raw.kind === 'section') {
    return { kind: 'section', notes, title: raw.title, subtitle: raw.subtitle }
  }

  const pool = await allFlags()
  const names = new Map(pool.map((f) => [f.code, f.name]))
  const resolve = (c: string): Option => ({ code: c, name: names.get(c) ?? c })

  if (raw.kind === 'guess-flag') {
    let codes = raw.options ? [...raw.options] : []
    if (!codes.includes(raw.answer)) codes.unshift(raw.answer)
    if (!raw.options) {
      const answer = await flagByCode(raw.answer)
      const distractors = answer ? pickDistractors(answer, pool, OPTION_COUNT - 1) : []
      codes = [raw.answer, ...distractors]
    }
    const options = shuffle(codes).map(resolve)
    return {
      kind: 'guess-flag',
      notes,
      flagCode: raw.answer,
      options,
      answerIndex: options.findIndex((o) => o.code === raw.answer),
    }
  }

  // which-flag: author order is preserved so 1..N matches the screen layout.
  const answerName = names.get(raw.answer) ?? raw.answer
  return {
    kind: 'which-flag',
    notes,
    prompt: raw.prompt ?? `Which flag is ${answerName}?`,
    flags: raw.flags,
    answerIndex: raw.flags.indexOf(raw.answer),
    answerName,
  }
}
