import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

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

export default defineConfig({ plugins: [react(), devMotions()] })
