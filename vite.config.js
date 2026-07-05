/* global process, Buffer */
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SAVE_ALLOWED_FILES = ['ArmyTable.xlsx', 'StageStepTable.xlsx', 'StageTable.xlsx', 'ItemTable.xlsx', 'FunctionUnlockTable.xlsx']
const READ_ALLOWED_FILES = [...SAVE_ALLOWED_FILES, 'names.xlsx']

const normalizeExternalPath = (externalPathBase) => externalPathBase ? path.resolve(externalPathBase) : ''

export const resolveExcelReadPath = ({ projectRoot, filename, externalPathBase, existsSync = fs.existsSync }) => {
  if (!SAVE_ALLOWED_FILES.includes(filename)) {
    return path.resolve(projectRoot, 'public', filename)
  }

  const externalRoot = normalizeExternalPath(externalPathBase)
  if (externalRoot) {
    if (!existsSync(externalRoot)) {
      throw new Error(`EXTERNAL_SYNC_PATH 不存在：${externalRoot}`)
    }

    const externalPath = path.join(externalRoot, filename)
    if (!existsSync(externalPath)) {
      throw new Error(`EXTERNAL_SYNC_PATH 下缺少 ${filename}：${externalPath}`)
    }

    return externalPath
  }

  return path.resolve(projectRoot, 'public', filename)
}

export const resolveExcelWriteTargets = ({ projectRoot, filename, externalPathBase, existsSync = fs.existsSync }) => {
  const localPath = path.resolve(projectRoot, 'public', filename)
  const externalRoot = normalizeExternalPath(externalPathBase)
  if (!externalRoot) return { localPath, externalPath: null }

  if (!existsSync(externalRoot)) {
    throw new Error(`EXTERNAL_SYNC_PATH 不存在：${externalRoot}`)
  }

  const externalPath = path.join(externalRoot, filename)
  if (!existsSync(externalPath)) {
    throw new Error(`EXTERNAL_SYNC_PATH 下缺少 ${filename}：${externalPath}`)
  }

  return { localPath, externalPath }
}

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
                  if (!SAVE_ALLOWED_FILES.includes(filename)) {
                    res.statusCode = 403;
                    return res.end('Forbidden: Invalid filename');
                  }

                  const buffer = Buffer.from(content, 'base64');
                  const { localPath, externalPath } = resolveExcelWriteTargets({
                    projectRoot: __dirname,
                    filename,
                    externalPathBase: env.EXTERNAL_SYNC_PATH
                  });
                  
                  // 1. 同步到本地 public 目录 (基础备份)
                  fs.writeFileSync(localPath, buffer);
                  
                  // 2. 同步到外部配置目录 (如果已配置)
                  let externalSyncMsg = '';
                  if (externalPath) {
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
                  res.end(e.message || 'Error saving file');
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
              
              if (!READ_ALLOWED_FILES.includes(filename)) {
                res.statusCode = 403;
                return res.end('Forbidden');
              }

              try {
                const targetPath = resolveExcelReadPath({
                  projectRoot: __dirname,
                  filename,
                  externalPathBase: env.EXTERNAL_SYNC_PATH
                });
                const buffer = fs.readFileSync(targetPath);
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.end(buffer);
              } catch (e) {
                res.statusCode = 404;
                res.end(e.message || 'File not found');
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
