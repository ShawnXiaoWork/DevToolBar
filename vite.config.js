import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [
      react(),
      {
        name: 'save-excel-api',
        configureServer(server) {
          // 保存 Excel API
          server.middlewares.use('/DevToolBar/api/save-excel', (req, res, next) => {
            if (req.method === 'POST') {
              let body = '';
              req.on('data', chunk => { body += chunk.toString(); });
              req.on('end', () => {
                try {
                  const { content, filename = 'ArmyTable.xlsx' } = JSON.parse(body);
                  
                  // 安全检查：仅允许保存特定的 xlsx 文件到指定目录
                  const allowedFiles = ['ArmyTable.xlsx', 'StageStepTable.xlsx', 'StageTable.xlsx', 'ItemTable.xlsx', 'FunctionUnlockTable.xlsx'];
                  if (!allowedFiles.includes(filename)) {
                    res.statusCode = 403;
                    return res.end('Forbidden: Invalid filename');
                  }

                  const buffer = Buffer.from(content, 'base64');
                  
                  // 1. 同步到本地 public 目录 (基础备份)
                  const localPath = path.resolve(__dirname, 'public', filename);
                  fs.writeFileSync(localPath, buffer);
                  
                  // 2. 同步到外部配置目录 (如果存在)
                  const externalPathBase = env.EXTERNAL_SYNC_PATH;
                  let externalSyncMsg = '';
                  if (externalPathBase && fs.existsSync(externalPathBase)) {
                    const externalPath = path.join(externalPathBase, filename);
                    fs.writeFileSync(externalPath, buffer);
                    externalSyncMsg = ` & External synced to ${externalPath}`;
                  }

                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ 
                    status: 'OK', 
                    message: `Local sync successful${externalSyncMsg}` 
                  }));
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

          // 读取 Excel API
          server.middlewares.use('/DevToolBar/api/read-excel', (req, res, next) => {
            if (req.method === 'GET') {
              const url = new URL(req.url, `http://${req.headers.host}`);
              const filename = url.searchParams.get('filename') || 'ArmyTable.xlsx';
              
              const allowedFiles = ['ArmyTable.xlsx', 'StageStepTable.xlsx', 'StageTable.xlsx', 'ItemTable.xlsx', 'FunctionUnlockTable.xlsx'];
              if (!allowedFiles.includes(filename)) {
                res.statusCode = 403;
                return res.end('Forbidden');
              }

              let targetPath = path.resolve(__dirname, 'public', filename);
              const externalPathBase = env.EXTERNAL_SYNC_PATH;
              
              // 优先尝试读取外部目录
              if (externalPathBase && fs.existsSync(externalPathBase)) {
                const extPath = path.join(externalPathBase, filename);
                if (fs.existsSync(extPath)) {
                  targetPath = extPath;
                }
              }

              try {
                const buffer = fs.readFileSync(targetPath);
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.end(buffer);
              } catch (e) {
                res.statusCode = 404;
                res.end('File not found');
              }
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
