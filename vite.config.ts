import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { rankingsMiddleware } from './server/rankings.mjs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'playpulse-api',
      configureServer(server) {
        server.middlewares.use('/api/rankings', rankingsMiddleware);
      },
      configurePreviewServer(server) {
        server.middlewares.use('/api/rankings', rankingsMiddleware);
      },
    },
  ],
  server: { port: 1420, strictPort: true },
});
