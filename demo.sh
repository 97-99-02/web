#!/usr/bin/env bash
# 클론 후 바로 실행. 처음 한 번 필요한 준비(에이전트 코드, 가상환경, 벡터DB, 화면 빌드)를 없을 때만 하고
# FastAPI 한 곳(http://127.0.0.1:8000)에서 화면과 API를 함께 띄운다.
#   OFFLINE=1 ./demo.sh   네트워크 없이 캐시만 사용 (저장된 실행 재생용)
#   PORT=8010 ./demo.sh   다른 포트로 실행
set -euo pipefail
cd "$(dirname "$0")"

need() { command -v "$1" >/dev/null 2>&1 || { echo "✗ $1 이(가) 필요합니다 → $2" >&2; exit 1; }; }
need uv "https://docs.astral.sh/uv/getting-started/installation/"
need npm "Node.js 20.19 이상 https://nodejs.org"

if [ -f backend/.env ]; then set -a; . backend/.env; set +a; fi
case "${AGENT_DIR:=../agent}" in
  /*) AGENT="$AGENT_DIR" ;;
  *) AGENT="backend/$AGENT_DIR" ;;   # backend/.env 의 상대 경로는 backend/ 기준
esac
SHOW="${AGENT#backend/../}"   # 안내 문구용 (backend/../agent → agent)

# 1) 에이전트 코드 (git submodule)
if [ ! -f "$AGENT/graph.py" ]; then
  echo "▶ 에이전트 코드(submodule)를 받습니다"
  git submodule update --init
fi

# 2) API 키 파일. 없으면 빈 템플릿을 만든다 (키가 없어도 저장된 실행 재생은 된다)
if [ ! -f "$AGENT/.env" ]; then
  printf 'OPENAI_API_KEY=\nTAVILY_API_KEY=\nHF_TOKEN=\n' > "$AGENT/.env"
  echo "ℹ $SHOW/.env 를 만들었습니다. OPENAI_API_KEY, TAVILY_API_KEY 를 채우고 다시 실행하면 실시간 평가를 할 수 있습니다."
fi

# 3) 벡터DB (처음 한 번: 임베딩 모델 KURE-v1 내려받기 + 문서 10편 적재)
if [ ! -d "$AGENT/vectorstore" ]; then
  if [ "${OFFLINE:-0}" = "1" ]; then
    echo "ℹ 벡터DB가 없어 실시간 평가는 할 수 없습니다 (OFFLINE). 저장된 실행 재생은 됩니다."
  else
    echo "▶ 벡터DB를 만듭니다 (처음 한 번)"
    (cd "$AGENT" && uv run --frozen python -m rag.ingest)
  fi
fi

# 4) 화면 빌드
[ -d frontend/node_modules ] || (cd frontend && npm ci)
(cd frontend && npm run build)

exec backend/run.sh
