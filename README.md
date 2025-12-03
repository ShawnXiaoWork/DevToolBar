# DevToolbox

一个为开发者设计的实用工具箱，包含时间戳转换器和 JSON 格式化工具。本项目基于 React + Vite 构建，并支持使用 Tauri 打包为原生桌面应用。

## 开发环境准备

在开始之前，请确保您的系统已安装以下环境：

1.  **Node.js** (推荐 v18+)
2.  **Rust** (仅 Tauri 构建需要)
    *   Windows: 下载安装 [Rustup](https://rustup.rs/)
    *   macOS/Linux: 运行 `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`

## 安装依赖

```bash
npm install
```

## 运行 Web 版本

如果您只需要在浏览器中运行：

```bash
npm run dev
```

打开浏览器访问显示的本地地址 (通常是 `http://localhost:1420`)。

## 运行桌面版本 (Tauri)

### 开发模式

此模式支持热重载：

```bash
npm run tauri dev
```

首次运行需要编译 Rust 后端，可能需要几分钟时间。

### 打包发布

构建生产环境的安装包（.exe, .dmg, .deb）：

```bash
npm run tauri build
```

构建产物将位于 `src-tauri/target/release/bundle/` 目录下。

## 项目结构

*   `src-tauri/`: Tauri 的后端配置和 Rust 代码。
*   `index.html`: Web 应用入口。
*   `package.json`: 项目依赖和脚本配置。
*   `vite.config.ts`: 前端构建配置。

## 常见问题

*   **图标缺失**: 默认配置使用了 Tauri 的默认图标。如果打包时提示找不到图标，请确保 `src-tauri/icons` 目录下存在图标文件，或者通过 `src-tauri/tauri.conf.json` 修改路径。
*   **权限问题**: 如果剪贴板复制功能在打包后失效，请检查 `src-tauri/tauri.conf.json` 中的 `allowlist` 是否开启了 `clipboard` 权限。