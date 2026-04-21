import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import https from 'https'

// 简单的 GitHub OAuth Token 交换插件
const githubAuthPlugin = (env) => ({
  name: 'github-auth-plugin',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (req.url.startsWith('/api/auth/github')) {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const code = url.searchParams.get('code');
        
        if (!code) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Missing code' }));
          return;
        }

        const data = JSON.stringify({
          client_id: env.VITE_GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code: code,
        });

        const options = {
          hostname: 'github.com',
          port: 443,
          path: '/login/oauth/access_token',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Content-Length': data.length,
            'User-Agent': 'DevToolBar-Vite-Server'
          }
        };

        const ghReq = https.request(options, (ghRes) => {
          let body = '';
          ghRes.on('data', (d) => body += d);
          ghRes.on('end', () => {
            res.setHeader('Content-Type', 'application/json');
            res.end(body);
          });
        });

        ghReq.on('error', (error) => {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: error.message }));
        });

        ghReq.write(data);
        ghReq.end();
      } else {
        next();
      }
    });
  }
});

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), githubAuthPlugin(env)],
    base: '/DevToolBar/',
    server: {
      host: true
    }
  }
})
