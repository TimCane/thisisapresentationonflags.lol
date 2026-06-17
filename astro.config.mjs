import { defineConfig } from 'astro/config'
import node from '@astrojs/node'

// Hybrid: pages are static by default; server routes (SSE, API) opt in with
// `export const prerender = false`.
export default defineConfig({
  adapter: node({ mode: 'standalone' }),
})
