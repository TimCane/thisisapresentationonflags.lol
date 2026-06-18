import { getCollection } from 'astro:content'

export type FlagInfo = {
  code: string
  name: string
  continent: string
  colours: string[]
  features: string[]
}

let cache: Map<string, FlagInfo> | null = null

async function load(): Promise<Map<string, FlagInfo>> {
  if (cache) return cache
  const entries = await getCollection('flags')
  cache = new Map(
    entries.map((e) => [
      e.data.code,
      {
        code: e.data.code,
        name: e.data.name,
        continent: e.data.continent,
        colours: e.data.colours,
        features: e.data.features,
      },
    ]),
  )
  return cache
}

export async function allFlags(): Promise<FlagInfo[]> {
  return [...(await load()).values()]
}

export async function flagByCode(code: string): Promise<FlagInfo | undefined> {
  return (await load()).get(code)
}
