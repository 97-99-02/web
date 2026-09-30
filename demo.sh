#!/usr/bin/env bash
# 시연용 실행: 화면을 빌드해 FastAPI 한 곳(http://127.0.0.1:8000)에서 화면과 API를 함께 띄운다
set -euo pipefail
cd "$(dirname "$0")"
[ -d frontend/node_modules ] || (cd frontend && npm install)
(cd frontend && npm run build)
exec backend/run.sh
