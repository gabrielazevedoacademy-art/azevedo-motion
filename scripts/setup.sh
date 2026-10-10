#!/usr/bin/env bash
# Setup do estúdio azevedo-motion: dependências npm + Chromium + checagem do ffmpeg.
# Rápido (< 5 min). Uso: bash scripts/setup.sh
set -euo pipefail
cd "$(dirname "$0")/.."
t0=$(date +%s)

echo "▸ npm ci"
if [ -f package-lock.json ]; then npm ci --no-audit --no-fund --loglevel=error; else npm install --no-audit --no-fund --loglevel=error; fi

echo "▸ Chromium"
if node engine/bin.mjs >/dev/null 2>&1; then
  echo "  já existe um Chromium utilizável"
else
  echo "  baixando Chromium do Playwright…"
  if ! PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD= timeout 240 npx playwright install chromium; then
    echo "  download bloqueado; tentando @sparticuz/chromium…"
    npm install --no-save --no-audit --no-fund @sparticuz/chromium >/dev/null 2>&1 || true
  fi
fi

echo "▸ Checagem"
if ! node engine/bin.mjs; then
  echo "✗ Sem Chromium. Libere na rede do ambiente: cdn.playwright.dev e playwright.download.prss.microsoft.com (ou github.com p/ @sparticuz/chromium)."
  exit 1
fi
"$(node -e "import('./engine/bin.mjs').then(m=>console.log(m.FFMPEG))")" -hide_banner -version | head -1
echo "✓ setup concluído em $(( $(date +%s) - t0 ))s"
