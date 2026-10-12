#!/bin/bash

cd "$(dirname "$0")" || exit 1

pause_on_error() {
  if [ -t 0 ]; then
    read -r -p "按回车键关闭窗口..." _
  fi
}

if ! command -v node >/dev/null 2>&1; then
  echo "未找到 Node.js。请安装 Node.js 20 或更新版本后重试。"
  pause_on_error
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "未找到 npm。请安装包含 npm 的 Node.js 后重试。"
  pause_on_error
  exit 1
fi

if ! npm ls --depth=0 --silent >/dev/null 2>&1; then
  echo "正在安装或补全项目依赖..."
  if ! npm install; then
    echo "npm install 失败，请检查网络和 npm 设置。"
    pause_on_error
    exit 1
  fi
fi

node scripts/launch.mjs
status=$?
if [ "$status" -ne 0 ]; then
  pause_on_error
fi
exit "$status"
