"""평가 실행과 재생.

그래프를 스레드에서 돌리며 노드 시작·종료를 이벤트로 쌓는다. 화면은 이 이벤트를 SSE로 받아 그린다.
끝까지 돈 실행은 recordings/ 에 저장해, 발표장에서 네트워크나 API가 막혀도 같은 화면으로 재생할 수 있게 한다.
"""
import json
import logging
import re
import threading
import time
import uuid
from datetime import datetime

from .agent import JUDGE_LOG_PATH, RECORDINGS_DIR, build_graph, export_report_pdf, settings

logger = logging.getLogger(__name__)

SNIPPET_LIMIT = 300          # 화면에 보낼 출처 원문 길이
RECURSION_LIMIT = 60         # 에이전트 저장소 app.py와 같은 값
RUN_ID = re.compile(r"^\d{8}-\d{6}-[0-9a-f]{4}$")


class Busy(Exception):
    """이미 실행 중인 평가가 있을 때. 병렬 노드가 Chroma를 함께 쓰므로 한 번에 한 건만 돌린다."""


class Run:
    def __init__(self, mode: str, company: str | None):
        self.id = f"{datetime.now():%Y%m%d-%H%M%S}-{uuid.uuid4().hex[:4]}"
        self.mode, self.company = mode, company
        self.created = datetime.now().isoformat(timespec="seconds")
        self.events: list[dict] = []
        self.done = False
        self.cancel_requested = False
        self._t0 = time.monotonic()

    def emit(self, type_: str, **data):
        self.events.append({"id": len(self.events), "type": type_,
                            "t": round(time.monotonic() - self._t0, 2), **data})


_runs: dict[str, Run] = {}
_current: Run | None = None
_start_lock = threading.Lock()


def start_run(mode: str, company: str | None) -> Run:
    global _current
    with _start_lock:
        if _current and not _current.done:
            raise Busy(_current.id)
        run = Run(mode, company)
        _runs[run.id] = run
        _current = run
    threading.Thread(target=_execute, args=(run,), daemon=True).start()
    return run


def get_run(run_id: str) -> Run | None:
    return _runs.get(run_id)


def current_run_id() -> str | None:
    return _current.id if _current and not _current.done else None


# ---------- 이벤트 내용 만들기 ----------

def _jsonable(obj):
    return json.loads(json.dumps(obj, ensure_ascii=False, default=str))


def _trim_sources(sources: list[dict]) -> list[dict]:
    out = []
    for s in sources or []:
        s = dict(s)
        if len(s.get("snippet") or "") > SNIPPET_LIMIT:
            s["snippet"] = s["snippet"][:SNIPPET_LIMIT] + "…"
        out.append(s)
    return out


def _start_context(node: str, state: dict) -> dict:
    """노드가 시작할 때 보여줄 최소 정보. 입력 state 전체는 크므로 보내지 않는다."""
    if node == "explorer":
        candidates = state.get("candidates") or []
        idx = state.get("current_index", 0)
        return {"index": idx, "candidates": candidates,
                "target": candidates[idx] if idx < len(candidates) else None}
    company = (state.get("company") or {}).get("name")
    return {"company": company} if company else {}


def _clean_update(result) -> dict:
    """노드가 state에 쓴 값. 다음 후보로 넘어갈 때 비우는 None 값은 뺀다."""
    if not isinstance(result, dict):
        return {"value": result}
    update = {k: v for k, v in result.items() if v is not None}
    if "sources" in update:
        update["sources"] = _trim_sources(update["sources"])
    return update


def _judge_consistency(company: str | None, since: str) -> dict | None:
    """채점 로그에서 이 실행 이후 같은 기업의 마지막 기록을 찾아 일관성 검사(재채점) 결과를 돌려준다."""
    if not company:
        return None
    try:
        lines = JUDGE_LOG_PATH.read_text(encoding="utf-8").splitlines()[-20:]
    except OSError:
        return None
    for line in reversed(lines):
        try:
            record = json.loads(line)
        except json.JSONDecodeError:
            continue
        if record.get("company") == company and record.get("time", "") >= since:
            return record.get("consistency")
    return None


def _final_result(state: dict) -> dict:
    keys = ("candidates", "company", "rejected", "scores", "verify_result", "report", "retry_count")
    result = {k: state.get(k) for k in keys}
    result["source_count"] = len(state.get("sources") or [])
    return result


# ---------- 실행 ----------

def _execute(run: Run):
    inputs = {"current_index": 0, "retry_count": 0}
    if run.mode == "company":
        inputs["candidates"] = [run.company]   # 탐색 노드는 candidates가 있으면 발굴을 건너뛴다
    # 평가 비중·기준은 에이전트 저장소 버전에 따라 바뀌므로 실행 당시 값을 기록에 함께 남긴다
    run.emit("run", mode=run.mode, company=run.company, created=run.created, replay=False, settings=settings())
    final: dict = {}
    stream = None
    try:
        stream = build_graph().stream(inputs, {"recursion_limit": RECURSION_LIMIT},
                                      stream_mode=["tasks", "values"])
        for mode, chunk in stream:
            if run.cancel_requested:
                run.emit("cancelled")
                return
            if mode == "values":
                final = chunk
            elif "input" in chunk:   # tasks 모드: 시작 이벤트에는 input, 종료 이벤트에는 result가 있다
                run.emit("node_start", node=chunk["name"], task=chunk["id"],
                         context=_jsonable(_start_context(chunk["name"], chunk["input"])))
            elif chunk.get("error"):
                run.emit("node_error", node=chunk["name"], task=chunk["id"], message=str(chunk["error"]))
            else:
                update = _clean_update(chunk["result"])
                if chunk["name"] == "judge":
                    update["consistency"] = _judge_consistency((final.get("company") or {}).get("name"), run.created)
                run.emit("node_end", node=chunk["name"], task=chunk["id"], update=_jsonable(update))
        result = _jsonable(_final_result(final))
        result["pdf"] = _export_pdf(run, final)
        run.emit("done", result=result)
        _save_recording(run, result)
    except Exception as e:
        logger.exception("평가 실행 실패")
        run.emit("error", message=f"{type(e).__name__}: {e}")
    finally:
        if stream is not None:
            stream.close()
        run.done = True


def request_cancel(run: Run):
    """진행 중인 노드는 멈출 수 없어서, 다음 이벤트가 올 때 멈춘다."""
    run.cancel_requested = True


def _export_pdf(run: Run, state: dict) -> bool:
    if not state.get("report"):
        return False
    try:
        RECORDINGS_DIR.mkdir(exist_ok=True)
        export_report_pdf(state["report"], output_dir=RECORDINGS_DIR, filename=f"{run.id}.pdf", state=state)
        return True
    except Exception:
        logger.exception("PDF 생성 실패")
        return False


# ---------- 재생 ----------

def _summary(run: Run, result: dict) -> dict:
    scores = result.get("scores") or {}
    invested = scores.get("decision") == "투자"
    return {
        "id": run.id, "mode": run.mode, "company": run.company, "created": run.created,
        "duration": run.events[-1]["t"],
        "invested": (result.get("company") or {}).get("name") if invested else None,
        "total": scores.get("total") if invested else None,
        "evaluated": len(result.get("rejected") or []) + (1 if invested else 0),
    }


def _save_recording(run: Run, result: dict):
    RECORDINGS_DIR.mkdir(exist_ok=True)
    path = RECORDINGS_DIR / f"{run.id}.jsonl"
    with path.open("w", encoding="utf-8") as f:
        f.write(json.dumps(_summary(run, result), ensure_ascii=False) + "\n")
        for ev in run.events:
            f.write(json.dumps(ev, ensure_ascii=False) + "\n")


def list_recordings() -> list[dict]:
    items = []
    for path in sorted(RECORDINGS_DIR.glob("*.jsonl"), reverse=True):
        with path.open(encoding="utf-8") as f:
            first = f.readline()
        try:
            items.append(json.loads(first))
        except json.JSONDecodeError:
            continue
    return items


def load_recording(rec_id: str) -> list[dict] | None:
    if not RUN_ID.match(rec_id):
        return None
    path = RECORDINGS_DIR / f"{rec_id}.jsonl"
    if not path.exists():
        return None
    lines = path.read_text(encoding="utf-8").splitlines()
    return [json.loads(line) for line in lines[1:] if line.strip()]


def pdf_path(rec_id: str):
    if not RUN_ID.match(rec_id):
        return None
    path = RECORDINGS_DIR / f"{rec_id}.pdf"
    return path if path.exists() else None
