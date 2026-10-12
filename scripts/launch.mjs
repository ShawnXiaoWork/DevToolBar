import { spawn } from 'node:child_process';
import { createServer } from 'vite';

try {
  const server = await createServer({
    server: { host: '127.0.0.1', port: 5173 },
  });
  await server.listen();
  const url = server.resolvedUrls?.local?.[0];
  if (!url) throw new Error('本地服务已启动，但未获得访问地址。');
  console.log(`游戏已启动：${url}`);
  console.log('保持此窗口打开；按 Ctrl+C 可停止服务。');

  if (process.platform === 'win32') {
    const browser = spawn('cmd.exe', ['/d', '/s', '/c', `start "" "${url}"`], {
      stdio: 'ignore',
      windowsHide: true,
    });
    browser.on('error', error => console.error(`自动打开浏览器失败，请手动访问 ${url}`, error));
  } else if (process.platform === 'darwin') {
    const browser = spawn('open', [url], { stdio: 'ignore' });
    browser.on('error', error => console.error(`自动打开浏览器失败，请手动访问 ${url}`, error));
  }
} catch (error) {
  console.error('启动游戏失败：', error);
  process.exitCode = 1;
}
