"""팀 저장소(ai-startup-investment-agent)를 불러온다.

에이전트 코드는 outputs/, fonts/ 같은 상대 경로를 쓰므로 작업 폴더를 에이전트 저장소로 옮긴 뒤 import 한다.
OpenAI·Tavily 키는 에이전트 저장소의 .env를 그대로 쓴다 (이 저장소에는 키를 두지 않는다).
"""
import logging
import os
import sys
import threading
from pathlib import Path

from dotenv import load_dotenv

logger = logging.getLogger(__name__)

BACKEND_DIR = Path(__file__).resolve().parent.parent
RECORDINGS_DIR = BACKEND_DIR / "recordings"

load_dotenv(BACKEND_DIR / ".env")
AGENT_DIR = (BACKEND_DIR / os.environ.get("AGENT_DIR", "../agent")).resolve()
if not (AGENT_DIR / "graph.py").exists():
    raise RuntimeError(f"에이전트 저장소를 찾지 못했습니다: {AGENT_DIR}\n"
                       "git submodule update --init 을 실행하거나 backend/.env 의 AGENT_DIR 을 확인하세요.")

load_dotenv(AGENT_DIR / ".env")
sys.path.insert(0, str(AGENT_DIR))
os.chdir(AGENT_DIR)

import config as agent_config  # noqa: E402
from agents.judge import ITEM_LABELS  # noqa: E402
from agents.reporter import export_report_pdf  # noqa: E402
from config import CORE_ITEMS, CORE_MIN_SCORE, INVEST_THRESHOLD, MAX_CANDIDATES, WEIGHTS  # noqa: E402
from graph import build_graph  # noqa: E402
from rag.retriever import get_vectorstore  # noqa: E402

__all__ = ["BACKEND_DIR", "RECORDINGS_DIR", "build_graph", "export_report_pdf",
           "graph_structure", "settings", "warm_up", "warm_status"]

_warm = {"ready": False, "error": None}


def warm_up():
    """임베딩 모델과 Chroma를 미리 불러 둔다. 첫 평가에서 모델 로딩을 기다리지 않게 하기 위함."""
    def load():
        try:
            get_vectorstore()
            _warm["ready"] = True
        except Exception as e:
            logger.exception("vectorstore 로딩 실패")
            _warm["error"] = f"{type(e).__name__}: {e}"
    threading.Thread(target=load, daemon=True).start()


def warm_status() -> dict:
    return dict(_warm)


def graph_structure() -> dict:
    """화면에 그릴 그래프 구조. 에이전트 저장소의 build_graph()에서 그대로 읽는다."""
    g = build_graph().get_graph()
    return {
        "nodes": list(g.nodes),
        "edges": [{"source": e.source, "target": e.target, "conditional": e.conditional} for e in g.edges],
    }


def settings() -> dict:
    return {
        "weights": WEIGHTS,
        "item_labels": ITEM_LABELS,
        "threshold": INVEST_THRESHOLD,
        "core_items": list(CORE_ITEMS),
        "core_min_score": CORE_MIN_SCORE,
        "core_caution_score": getattr(agent_config, "CORE_CAUTION_SCORE", None),
        "max_candidates": MAX_CANDIDATES,
    }
