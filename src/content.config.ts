import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'

// Primary colours a person would name when describing a flag, ignoring fine
// detail inside coats of arms and emblems. Constrained so bad data fails the
// build; drives the multiple-choice colour distractors.
const COLOURS = [
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'lightblue',
  'white',
  'black',
  'maroon',
] as const

const CONTINENTS = [
  'Africa',
  'Asia',
  'Europe',
  'North America',
  'Oceania',
  'South America',
] as const

const flags = defineCollection({
  loader: glob({ pattern: '*/index.md', base: './src/content/flags' }),
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      continent: z.enum(CONTINENTS),
      code: z.string(),
      flag: image(),
      colours: z.array(z.enum(COLOURS)).min(1),
      features: z.array(z.string()).min(1),
    }),
})

export const collections = { flags }
