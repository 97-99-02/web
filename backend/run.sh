#!/usr/bin/env bash
# 백엔드 실행. 에이전트 저장소의 uv 환경(uv.lock 그대로)에 FastAPI·uvicorn만 얹어서 띄운다.
# 네트워크가 없는 곳(발표장 등)에서는 OFFLINE=1 로 실행하면 uv·Hugging Face 모두 캐시만 쓴다 (재생 모드용)
set -euo pipefail
cd "$(dirname "$0")"
if [ -f .env ]; then set -a; . ./.env; set +a; fi
AGENT_DIR="${AGENT_DIR:-../agent}"
if [ "${OFFLINE:-0}" = "1" ]; then export UV_OFFLINE=1 HF_HUB_OFFLINE=1; fi
exec uv run --frozen --project "$AGENT_DIR" --with-requirements requirements.txt \
  uvicorn server.main:app --host 127.0.0.1 --port "${PORT:-8000}" "$@"
