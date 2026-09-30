# AI 반도체 스타트업 투자 평가 — 시연 웹

조별 과제 저장소 [ai-startup-investment-agent](https://github.com/97-99-02/ai-startup-investment-agent)의 LangGraph 그래프를 웹에서 실행하고, 에이전트가 도는 과정을 실시간으로 보여주는 발표 시연용 앱입니다.

- 에이전트 코드는 git submodule(`agent/`)로 참조하며 수정하지 않습니다. 화면의 그래프도 `build_graph()`에서 읽은 실제 연결 구조로 그립니다.
- 로컬 실행 전용입니다. 서버는 `127.0.0.1`에만 열리고, API 키는 에이전트 저장소의 `.env`만 사용합니다.

## 화면 구성

| 영역 | 내용 |
|---|---|
| 실행 | 기업 지정(한 곳만 평가) / 자동 발굴(고정 검색어로 후보 발굴 후 최대 5곳 차례로 평가) |
| 에이전트 흐름 | 노드별 진행 상태·소요 시간, 방금 지난 경로 강조, 조건 분기 라벨. 노드를 누르면 해당 에이전트 결과 표시 |
| 평가 후보 | 후보별 조건 확인·분석·보류·투자 상태와 환산 점수 |
| 투자 판단 | 항목별 점수(1~5)·비중·환산 점수, 투자 기준선, 보류 사유, 법률·주요 리스크. 항목을 누르면 채점 근거 |
| 에이전트 결과 | 탐색(기업 정보·조건), 기술 요약, 시장 수치, 경쟁사 표, 팀, 사실 검증 결과와 근거 출처 |
| 투자 보고서 | 보고서 본문(마크다운), 사실 검증 결과, PDF 다운로드 (`export_report_pdf` 그대로 사용) |
| 저장된 실행 재생 | 끝까지 돈 실행은 자동 저장. 네트워크·API 없이 같은 화면으로 다시 재생 (재생 중임을 화면 상단에 표시) |

## 구조

```
ai-startup-investment-web/
├── agent/                 # submodule → 97-99-02/ai-startup-investment-agent
├── backend/
│   ├── server/
│   │   ├── agent.py       # 에이전트 저장소 import (작업 폴더 이동, .env 로드, 임베딩 미리 로딩)
│   │   ├── runner.py      # 그래프 실행(스레드) → 이벤트 기록, 한 번에 한 건, 실행 기록 저장·재생
│   │   └── main.py        # FastAPI 라우트, SSE 전송, frontend/dist 정적 제공
│   ├── recordings/        # 실행 기록(.jsonl)과 보고서 PDF
│   ├── requirements.txt   # fastapi, uvicorn (에이전트 의존성 위에 얹음)
│   └── run.sh
├── frontend/              # Vite + Vue 3
│   └── src/
│       ├── useRun.js      # SSE 이벤트 → 화면 상태
│       ├── constants.js   # 노드 이름·그래프 좌표·항목 이름
│       └── components/    # PipelineGraph, CandidateTrack, ScoreBoard, NodeDetail, ActivityLog, ReportView …
└── demo.sh                # 화면 빌드 후 서버 하나(8000)로 실행
```

## 동작 방식

1. `POST /api/runs` 로 실행을 만들면 백엔드가 스레드에서 `build_graph().stream(..., stream_mode=["tasks", "values"])` 를 돈다.
2. `tasks` 스트림의 시작·종료 이벤트를 `node_start` / `node_end` 로 바꿔 쌓고, 화면은 `GET /api/runs/{id}/events` (SSE)로 받는다. 끊겼다 다시 붙으면 `Last-Event-ID` 다음부터 이어 받는다.
3. 기업 지정 모드는 `candidates=[기업명]` 을 넣어 시작한다. 탐색 노드가 `state.get("candidates") or discover_candidates()` 이므로 발굴 단계만 건너뛴다.
4. 끝나면 `values` 스트림의 마지막 state로 PDF를 만들고, 이벤트 전체를 `recordings/` 에 저장한다.
5. 병렬 분석 노드가 Chroma를 함께 쓰므로 실행은 한 번에 한 건만 받는다(두 번째 요청은 409, 화면은 진행 중인 실행에 붙음).

## 실행

### 1. 준비 (처음 한 번)

```bash
git clone --recurse-submodules <이 저장소 URL>
cd ai-startup-investment-web

# 에이전트 준비: agent/.env 에 OPENAI_API_KEY, TAVILY_API_KEY, HF_TOKEN 작성 후 (에이전트 README '환경 변수' 참고)
cd agent && uv sync && uv run python -m rag.ingest && cd ..

cd frontend && npm install && cd ..
```

에이전트 저장소를 이미 다른 위치에 받아 두었다면 submodule 대신 그 위치를 쓸 수 있습니다.

```bash
cp backend/.env.example backend/.env   # AGENT_DIR 에 경로 입력 (공백이 있으면 따옴표)
```

### 2. 시연 (서버 하나)

```bash
./demo.sh          # http://127.0.0.1:8000
```

### 3. 개발 (화면 수정 즉시 반영)

```bash
backend/run.sh                 # API  http://127.0.0.1:8000
cd frontend && npm run dev     # 화면 http://localhost:5174 (/api 는 8000으로 전달)
```

## 발표장 체크리스트

- 리허설 때 시연할 기업으로 실시간 실행을 한 번 해 두면 `recordings/` 에 기록이 남는다.
- 네트워크가 불안하면 `OFFLINE=1 ./demo.sh` 로 띄우고 **저장된 실행 → 재생** 을 쓴다. uv·Hugging Face가 캐시만 사용한다(실시간 평가는 불가).
- 재생은 원래 실행의 경과 시간을 그대로 표시하고, 이벤트 사이 대기만 배속에 맞춰 줄인다.

## API

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/meta` | 그래프 구조, 평가 설정(비중·기준 점수), 모델 로딩 상태, 진행 중인 실행 |
| POST | `/api/runs` | `{"mode": "company", "company": "파네시아"}` 또는 `{"mode": "discover"}` |
| GET | `/api/runs/{id}/events` | 실행 이벤트 (SSE) |
| POST | `/api/runs/{id}/cancel` | 중단 요청 (진행 중인 노드가 끝난 뒤 멈춤) |
| GET | `/api/recordings` | 저장된 실행 목록 |
| GET | `/api/recordings/{id}/events?speed=4` | 저장된 실행 재생 (SSE) |
| GET | `/api/recordings/{id}/pdf` | 보고서 PDF |

## 알려진 한계

- 중단은 노드 단위다. 이미 시작된 노드(LLM·검색 호출)는 끝까지 돈 뒤 멈춘다.
- 평가 결과는 실행마다 달라질 수 있다(웹 검색 결과 변화, LLM 채점). 화면은 에이전트가 낸 값을 그대로 보여줄 뿐 보정하지 않는다.
