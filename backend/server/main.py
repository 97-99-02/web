"""시연용 API 서버.

실행: ./run.sh  (에이전트 저장소의 uv 환경에 FastAPI만 얹어서 띄운다)
frontend/dist 가 있으면 화면도 같은 주소(http://127.0.0.1:8000)에서 함께 내보낸다.
"""
import asyncio
import json
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import runner
from .agent import BACKEND_DIR, graph_structure, settings, warm_status, warm_up

DIST_DIR = BACKEND_DIR.parent / "frontend" / "dist"
KEEPALIVE_SEC = 15


@asynccontextmanager
async def lifespan(_: FastAPI):
    warm_up()
    yield


app = FastAPI(title="AI 반도체 스타트업 투자 평가 시연", lifespan=lifespan)


class RunRequest(BaseModel):
    mode: Literal["company", "discover"]
    company: str | None = Field(default=None, max_length=40)


def _sse(ev: dict) -> str:
    return f"id: {ev['id']}\ndata: {json.dumps(ev, ensure_ascii=False)}\n\n"


def _stream(gen) -> StreamingResponse:
    return StreamingResponse(gen, media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


def _resume_from(request: Request) -> int:
    """EventSource가 끊겼다 다시 붙으면 Last-Event-ID 다음 이벤트부터 보낸다."""
    last = request.headers.get("last-event-id", "")
    return int(last) + 1 if last.isdigit() else 0


@app.get("/api/meta")
def meta():
    return {"graph": graph_structure(), "settings": settings(),
            "warm": warm_status(), "current": runner.current_run_id()}


@app.post("/api/runs", status_code=201)
def create_run(req: RunRequest):
    company = (req.company or "").strip()
    if req.mode == "company" and not company:
        raise HTTPException(422, "기업명을 입력하세요.")
    try:
        run = runner.start_run(req.mode, company if req.mode == "company" else None)
    except runner.Busy as e:
        raise HTTPException(409, {"message": "이미 실행 중인 평가가 있습니다.", "run_id": str(e)})
    return {"id": run.id}


@app.post("/api/runs/{run_id}/cancel")
def cancel_run(run_id: str):
    run = runner.get_run(run_id)
    if not run:
        raise HTTPException(404, "실행을 찾지 못했습니다.")
    runner.request_cancel(run)
    return {"ok": True}


@app.get("/api/runs/{run_id}/events")
async def run_events(run_id: str, request: Request):
    run = runner.get_run(run_id)
    if not run:
        raise HTTPException(404, "실행을 찾지 못했습니다.")

    async def gen():
        i, idle = _resume_from(request), 0.0
        while True:
            while i < len(run.events):
                yield _sse(run.events[i])
                i, idle = i + 1, 0.0
            if run.done:
                return
            await asyncio.sleep(0.25)
            idle += 0.25
            if idle >= KEEPALIVE_SEC:
                yield ": keep-alive\n\n"
                idle = 0.0

    return _stream(gen())


@app.get("/api/recordings")
def recordings():
    return runner.list_recordings()


@app.get("/api/recordings/{rec_id}/events")
async def replay_events(rec_id: str, request: Request, speed: float = 1.0, max_gap: float = 3.0):
    """저장된 실행을 원래 순서대로 다시 보낸다. 이벤트 사이 대기는 speed배로 줄이고 max_gap초를 넘지 않게 한다."""
    events = runner.load_recording(rec_id)
    if events is None:
        raise HTTPException(404, "저장된 실행을 찾지 못했습니다.")
    speed = min(max(speed, 0.25), 50.0)

    async def gen():
        start = _resume_from(request)
        prev = events[start - 1]["t"] if 0 < start <= len(events) else 0.0
        for ev in events[start:]:
            gap = (ev["t"] - prev) / speed
            prev = ev["t"]
            await asyncio.sleep(min(gap, max_gap) if max_gap > 0 else gap)
            if ev["type"] == "run":
                ev = {**ev, "replay": True, "recording": rec_id}
            yield _sse(ev)

    return _stream(gen())


@app.get("/api/recordings/{rec_id}/pdf")
def recording_pdf(rec_id: str):
    path = runner.pdf_path(rec_id)
    if not path:
        raise HTTPException(404, "PDF가 없습니다.")
    return FileResponse(path, media_type="application/pdf", filename=f"투자평가보고서_{rec_id}.pdf")


if DIST_DIR.exists():
    app.mount("/", StaticFiles(directory=DIST_DIR, html=True), name="web")
