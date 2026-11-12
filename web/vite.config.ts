import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: './',
  plugins: [react(), {
    name: 'runtime-deployment-in-development',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0];
        if (path !== '/imd-deployment.json' && !/^\/abi\/[A-Za-z][A-Za-z0-9_]*\.json$/.test(path)) return next();
        const file = resolve(fileURLToPath(new URL('../dist/', import.meta.url)), path.slice(1));
        void readFile(file).then((bytes) => { res.setHeader('Content-Type', 'application/json'); res.end(bytes); })
          .catch(() => { res.statusCode = 503; res.end('Build the production export first: npm run build'); });
      });
    },
  }],
  build: { outDir: '../dist', emptyOutDir: true, sourcemap: false, chunkSizeWarningLimit: 650 },
});
