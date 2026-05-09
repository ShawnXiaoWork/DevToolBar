import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vite.dev/config/
export default defineConfig(() => {
  return {
    plugins: [
      react(),
      {
        name: 'save-excel-api',
        configureServer(server) {
          server.middlewares.use('/DevToolBar/api/save-excel', (req, res, next) => {
            if (req.method === 'POST') {
              let body = '';
              req.on('data', chunk => { body += chunk.toString(); });
              req.on('end', () => {
                try {
                  const { content } = JSON.parse(body);
                  const buffer = Buffer.from(content, 'base64');
                  const targetPath = path.resolve(__dirname, 'public/ArmyTable.xlsx');
                  fs.writeFileSync(targetPath, buffer);
                  res.statusCode = 200;
                  res.end('OK');
                } catch (e) {
                  console.error('Save failed:', e);
                  res.statusCode = 500;
                  res.end('Error saving file');
                }
              });
            } else {
              next();
            }
          });
        }
      }
    ],
    base: '/DevToolBar/',
    server: {
      host: true
    }
  }
})
