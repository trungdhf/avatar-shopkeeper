import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { screenAddress } from './api/screen'

// Serves local .vrma files to debug.html. apply: 'serve' keeps it out of the
// production build, so these motions are never published: the BOOTH licence
// forbids redistributing them in a form that can be extracted or rigged.
// Point VRMA_DIR at another folder to use it instead of ./dev-motions.
function devMotions(): Plugin {
  const dir = resolve(process.env.VRMA_DIR ?? 'dev-motions')
  const list = () => {
    try {
      return readdirSync(dir).filter((name) => name.toLowerCase().endsWith('.vrma')).sort()
    } catch {
      return []
    }
  }
  return {
    name: 'dev-motions',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/dev-motions.json', (_request, response) => {
        response.setHeader('Content-Type', 'application/json')
        response.end(JSON.stringify({ dir, files: list() }))
      })
      server.middlewares.use('/dev-motions', (request, response, next) => {
        const name = decodeURIComponent((request.url ?? '').replace(/^\//, '').split('?')[0])
        if (!list().includes(name)) return next()
        response.setHeader('Content-Type', 'model/gltf-binary')
        response.end(readFileSync(join(dir, name)))
      })
    },
  }
}

// Vercel serves api/screen.ts in production; this gives the dev server the same
// route, reading the key from .env so it never reaches the browser bundle.
function devScreen(key: string | undefined): Plugin {
  return {
    name: 'dev-screen',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/screen', (request, response) => {
        const address = new URL(request.url ?? '', 'http://localhost').searchParams.get('address') ?? ''
        void screenAddress(address, key).then((result) => {
          response.setHeader('Content-Type', 'application/json')
          response.setHeader('Cache-Control', 'no-store')
          response.statusCode = result.state === 'error' ? 502 : 200
          response.end(JSON.stringify(result))
        })
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // Empty prefix so non VITE_ variables are visible to the config too.
  const env = loadEnv(mode, process.cwd(), '')
  return { plugins: [react(), devMotions(), devScreen(env.INTERCEPTA_API_KEY)] }
})
