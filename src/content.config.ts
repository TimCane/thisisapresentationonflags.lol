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

// The talk deck. One file per slide, ordered by filename (NN-...). `kind`
// discriminates the slide; quiz slides reference flag codes from `flags`.
const code = z.string()
const slides = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/slides' }),
  schema: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('title'),
      title: z.string(),
      subtitle: z.string().optional(),
      showCode: z.boolean().default(false),
      notes: z.string().optional(),
    }),
    z.object({
      kind: z.literal('section'),
      title: z.string(),
      subtitle: z.string().optional(),
      notes: z.string().optional(),
    }),
    z.object({
      kind: z.literal('guess-flag'),
      answer: code,
      // Optional explicit options; when omitted, similar-flag distractors fill in.
      options: z.array(code).optional(),
      notes: z.string().optional(),
    }),
    z.object({
      kind: z.literal('which-flag'),
      flags: z.array(code).min(2),
      answer: code,
      // Defaults to "Which flag is <answer name>?".
      prompt: z.string().optional(),
      notes: z.string().optional(),
    }),
  ]),
})

export const collections = { flags, slides }
