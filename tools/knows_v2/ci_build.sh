#!/bin/sh
# CI 방식 검사 + 촬영용 빌드 — docker run --rm -v <worktree>:/src:ro -v <out>:/out node:20-slim sh /src/tools/knows_v2/ci_build.sh
set -e
mkdir -p /app && cd /app
cp -r /src/frontend/src /src/frontend/tests /src/frontend/public /src/frontend/eslint.ci.config.js /src/frontend/package.json /src/frontend/index.html /src/frontend/vite.config.js .
echo '{"type":"module"}' > /tmp/t.json
npm i --no-audit --no-fund --silent eslint@9.17.0 eslint-plugin-react@7.37.2 eslint-plugin-react-hooks@5.1.0 globals@15.14.0 vite@8.3.8 @vitejs/plugin-react@6.3.0 react@19.3.1 react-dom@19.3.1 >/dev/null 2>&1
echo "== eslint"; npx eslint -c eslint.ci.config.js src && echo ESLINT_OK
echo "== node --test"; node --test tests/ 2>&1 | grep -E "^# (tests|pass|fail)|^not ok|^    not ok|^  not ok" 
echo "== vite build"; npx vite build 2>&1 | tail -4
cp /src/tools/knows_v2/harness/harness.html /src/tools/knows_v2/harness/harness-main.jsx .
cat > vite.harness.config.js <<'X'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({ plugins: [react()], build: { outDir: '/out/site', emptyOutDir: true, rollupOptions: { input: 'harness.html' } } })
X
npx vite build -c vite.harness.config.js 2>&1 | tail -3
