#!/usr/bin/env bash
set -e

cd "$(dirname "$0")/.."
nvm_script="${NVM_DIR:-$HOME/.nvm}/nvm.sh"
if [ ! -s "$nvm_script" ]; then
  echo "未找到 nvm：请先安装 nvm 和 Node 24，再运行本地预览。" >&2
  exit 1
fi
# nvm is a shell function, so load it even in a non-interactive terminal.
source "$nvm_script"
nvm use 24 || { echo "请先执行 nvm install 24。" >&2; exit 1; }
exec pnpm exec node scripts/dev.mjs --preview
