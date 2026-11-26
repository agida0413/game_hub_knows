# 1) 빌드
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build
# JS · CSS 등 글자 파일은 미리 압축(.gz 를 옆에 둠) — nginx gzip_static 이 그대로 내보내 요청마다 압축하지 않는다
RUN find dist -type f \( -name "*.js" -o -name "*.css" -o -name "*.svg" -o -name "*.json" -o -name "*.html" \) -size +1k -exec gzip -9 -k {} +

# 2) 정적 파일 서빙 (API 라우팅은 앞단 gateway 담당)
# 안정판 1.30 줄의 최신 패치 — deploy.sh 가 --pull 로 빌드해 기반 이미지의 보안 패치(OpenSSL 등)가 빌드마다 들어온다 (docs/SECURITY.md 9장)
#   (1.28 줄 이미지는 더 다시 빌드되지 않아 취약점이 쌓였다 — 2026-11-24 Trivy)
FROM nginx:1.30-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
