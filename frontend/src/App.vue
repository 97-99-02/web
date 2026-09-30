<script setup>
import { computed, onMounted, ref } from 'vue'
import ActivityLog from './components/ActivityLog.vue'
import CandidateTrack from './components/CandidateTrack.vue'
import ControlBar from './components/ControlBar.vue'
import DesignGraph from './components/DesignGraph.vue'
import NodeDetail from './components/NodeDetail.vue'
import PipelineGraph from './components/PipelineGraph.vue'
import ReportView from './components/ReportView.vue'
import ScoreBoard from './components/ScoreBoard.vue'
import { loadMeta, loadRecordings, replay, store } from './useRun'

// 설계 그래프: 팀 README 그림(노드 안 흐름 포함) / 코드 그래프: graph.py build_graph() 실제 노드·연결선
const view = ref('design')

onMounted(async () => {
  loadMeta()
  await loadRecordings()
  // ?replay=<기록 id>&speed=4 로 열면 그 기록을 바로 재생한다 (데모 링크 공유용)
  const q = new URLSearchParams(location.search)
  const id = q.get('replay')
  if (id && store.recordings.some((r) => r.id === id)) replay(id, Number(q.get('speed')) || 4)
})

const STATUS = {
  connecting: ['연결 중', 'accent'],
  running: ['실행 중', 'accent'],
  done: ['완료', 'ok'],
  error: ['오류', 'bad'],
  cancelled: ['중단됨', ''],
}
const status = computed(() => {
  if (!store.run) return ['대기', '']
  if (store.run.replay && store.run.status === 'running') return ['재생 중', 'accent']
  return STATUS[store.run.status]
})
const clock = computed(() => {
  const s = Math.floor(store.clock)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
})

const outcome = computed(() => {
  const r = store.result
  if (!r) return null
  if (r.scores?.decision === '투자') return { ok: true, text: `${r.company?.name} 투자 추천 · ${r.scores.total}점` }
  const n = r.rejected?.length ?? 0
  return { ok: false, text: n ? `추천 없음 — 평가한 ${n}곳 모두 보류 또는 조건 미충족` : '추천 없음 — 조건을 충족하는 후보를 찾지 못함' }
})

const replayInfo = computed(() => {
  const r = store.run
  if (!r?.replay) return null
  const rec = store.recordings.find((x) => x.id === r.recording)
  return `${(r.created ?? rec?.created ?? '').replace('T', ' ')} 실행 기록 · ${r.speed}배속`
})
</script>

<template>
  <div class="page">
    <header class="top">
      <div>
        <h1>AI 반도체 스타트업 투자 평가</h1>
        <p class="muted">LangGraph Multi-Agent · Agentic RAG · SKALA 울산 4반 4조</p>
      </div>
      <div class="run-status">
        <span class="badge big" :class="status[1]">
          <i v-if="store.run?.status === 'running'" class="dot" />{{ status[0] }}
        </span>
        <span v-if="store.run" class="mono clock">{{ clock }}</span>
      </div>
    </header>

    <div v-if="replayInfo" class="banner replay">
      <strong>{{ store.run.status === 'running' ? '저장된 실행 재생 중' : '저장된 실행 재생' }}</strong> · {{ replayInfo }} ·
      검색·LLM을 호출하지 않고 기록을 다시 보여줍니다
    </div>

    <ControlBar />

    <div v-if="outcome" class="banner" :class="outcome.ok ? 'ok' : 'warn'">
      <strong>결론</strong> {{ outcome.text }}
    </div>
    <div v-if="store.error" class="banner bad"><strong>오류</strong> {{ store.error }}</div>

    <section class="card">
      <h2 class="card-title">
        에이전트 흐름
        <span class="hint">{{ view === 'design'
          ? 'README 설계 그래프 · 분기와 투자 판단 안 흐름은 실행 결과로 추론해 표시'
          : 'graph.py build_graph() 의 실제 노드·연결선' }}</span>
        <span class="spacer" />
        <span class="seg" role="radiogroup" aria-label="그래프 보기">
          <button type="button" :class="{ on: view === 'design' }" @click="view = 'design'">설계 그래프</button>
          <button type="button" :class="{ on: view === 'code' }" @click="view = 'code'">코드 그래프</button>
        </span>
      </h2>
      <DesignGraph v-if="view === 'design'" />
      <PipelineGraph v-else />
      <ul class="legend">
        <li><i class="l-cond" />조건 분기</li>
        <li><i class="l-active" />방금 지난 경로</li>
        <li><i class="l-done" />지난 경로</li>
        <li><i class="l-running" />실행 중</li>
        <li><i class="l-ok" />완료 (노드를 누르면 결과 보기)</li>
      </ul>
    </section>

    <div class="grid">
      <div class="col">
        <CandidateTrack />
        <ScoreBoard />
      </div>
      <div class="col">
        <NodeDetail />
        <ActivityLog />
      </div>
    </div>

    <ReportView />
  </div>
</template>

<style scoped>
.page { max-width: 1480px; margin: 0 auto; padding: 24px 28px 48px; display: grid; gap: 16px; }
.top { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
h1 { margin: 0; font-size: 26px; letter-spacing: -0.03em; }
.top p { margin: 2px 0 0; font-size: 14px; }
.run-status { display: flex; align-items: center; gap: 12px; }
.big { font-size: 14px; padding: 5px 14px; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; animation: pulse 1s infinite; margin-right: 2px; }
.clock { font-size: 22px; font-weight: 700; }

.banner { padding: 12px 18px; border-radius: 12px; font-size: 15px; border: 1px solid transparent; }
.banner strong { margin-right: 8px; }
.banner.ok { background: var(--ok-soft); color: var(--ok); border-color: #86efac; font-size: 17px; }
.banner.warn { background: var(--warn-soft); color: var(--warn); border-color: #fcd34d; font-size: 17px; }
.banner.bad { background: var(--bad-soft); color: var(--bad); }
.banner.replay { background: #fff7ed; color: #9a3412; border-color: #fdba74; }

.seg { display: inline-flex; padding: 3px; background: #f1f5f9; border-radius: 10px; }
.seg button { height: 28px; padding: 0 12px; border: 0; border-radius: 7px; background: transparent; font-size: 13px; font-weight: 600; color: var(--muted); cursor: pointer; }
.seg button.on { background: var(--card); color: var(--text); box-shadow: 0 1px 3px rgb(15 23 42 / 0.12); }
.legend { display: flex; flex-wrap: wrap; gap: 6px 18px; list-style: none; margin: 8px 0 0; padding: 0; font-size: 12.5px; color: var(--muted); }
.legend li { display: flex; align-items: center; gap: 6px; }
.legend i { display: inline-block; width: 22px; height: 0; border-top: 2px solid; }
.l-cond { border-top-style: dashed !important; color: var(--line-strong); }
.l-active { color: var(--accent); border-top-width: 3px !important; }
.l-done { color: #64748b; }
.l-running, .l-ok { width: 16px !important; height: 12px !important; border: 2px solid; border-radius: 4px; }
.l-running { color: var(--accent); background: var(--accent-soft); }
.l-ok { color: var(--ok); }

.grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; align-items: start; }
.col { display: grid; gap: 16px; min-width: 0; }
@media (max-width: 1100px) {
  .grid { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 640px) {
  .page { padding: 16px 16px 40px; }
  h1 { font-size: 21px; }
}
</style>
