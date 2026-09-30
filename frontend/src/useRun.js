// 실행 상태 저장소. 서버가 SSE로 보내는 이벤트(run / node_start / node_end / done ...)를 받아 화면 상태로 바꾼다.
// 실시간 실행과 저장된 실행 재생이 같은 이벤트 형식을 쓰므로 처리 코드도 하나다.
import { reactive } from 'vue'
import { nodeLabel } from './constants'

const FINISHED = ['done', 'error', 'cancelled']

export const store = reactive({
  meta: null,
  runSettings: null, // 실행 당시 평가 설정 (재생 시 현재 설정과 다를 수 있음)
  metaError: null,
  recordings: [],
  run: null, // { id, mode, company, replay, recording, speed, status, t, created, cancelRequested }
  nodes: {}, // 노드 이름 → { status, count, startT, duration, context }
  edges: {}, // 'a->b' → { count, batch }
  batch: 0, // 가장 최근에 지나간 연결선 묶음 번호 (강조 표시용)
  outputs: {}, // 노드 이름 → 마지막 출력
  logs: [],
  candidates: [], // { name, status, reason, total, segment }
  scores: null,
  scoresCompany: null,
  report: null,
  verify: null,
  result: null,
  error: null,
  selected: null,
  follow: true,
  clock: 0,
})

let source = null
let frontier = ['__start__']
let endedSinceStart = []
let lastWasStart = false
let clockTimer = null
let clockBase = 0

// ---------- API ----------

async function api(path, options) {
  const res = await fetch(`/api${path}`, options)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(body.detail?.message ?? body.detail ?? res.statusText)
    err.status = res.status
    err.detail = body.detail
    throw err
  }
  return body
}

export async function loadMeta() {
  try {
    store.meta = await api('/meta')
    store.metaError = null
    if (!store.meta.warm.ready && !store.meta.warm.error) setTimeout(loadMeta, 2000)
    if (store.meta.current && !store.run) attach(store.meta.current)
  } catch (e) {
    store.metaError = e.message
    setTimeout(loadMeta, 3000)
  }
}

export async function loadRecordings() {
  try {
    store.recordings = await api('/recordings')
  } catch {
    store.recordings = []
  }
}

export async function startRun(mode, company) {
  try {
    const { id } = await api('/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, company }),
    })
    attach(id)
  } catch (e) {
    if (e.status === 409 && e.detail?.run_id) attach(e.detail.run_id) // 이미 도는 실행이 있으면 그 화면으로 붙는다
    else store.error = e.message
  }
}

export async function cancelRun() {
  if (!store.run || store.run.replay) return
  store.run.cancelRequested = true
  await api(`/runs/${store.run.id}/cancel`, { method: 'POST' }).catch(() => {})
}

export function replay(recId, speed) {
  reset()
  connect(`/api/recordings/${recId}/events?speed=${speed}&max_gap=${speed >= 10 ? 0.6 : 3}`)
  store.run = { id: recId, replay: true, recording: recId, speed, status: 'connecting', t: 0 }
}

export function stopReplay() {
  source?.close()
  if (store.run) store.run.status = 'cancelled'
  stopClock()
}

function attach(runId) {
  reset()
  store.run = { id: runId, replay: false, status: 'connecting', t: 0 }
  connect(`/api/runs/${runId}/events`)
}

function connect(url) {
  source?.close()
  source = new EventSource(url)
  source.onmessage = (m) => handle(JSON.parse(m.data))
  source.onerror = () => {
    if (!store.run || FINISHED.includes(store.run.status)) source?.close()
  }
}

// ---------- 상태 초기화 ----------

function reset() {
  source?.close()
  stopClock()
  Object.assign(store, {
    run: null, runSettings: null, nodes: {}, edges: {}, batch: 0, outputs: {}, logs: [], candidates: [],
    scores: null, scoresCompany: null, report: null, verify: null, result: null, error: null,
    selected: null, follow: true, clock: 0,
  })
  frontier = ['__start__']
  endedSinceStart = []
  lastWasStart = false
}

function startClock(t) {
  stopClock()
  clockBase = Date.now() - t * 1000
  clockTimer = setInterval(() => (store.clock = (Date.now() - clockBase) / 1000), 200)
}

function stopClock() {
  clearInterval(clockTimer)
  clockTimer = null
}

// ---------- 이벤트 처리 ----------

function hasEdge(src, dst) {
  return store.meta?.graph.edges.some((e) => e.source === src && e.target === dst)
}

function traverse(src, dst) {
  const key = `${src}->${dst}`
  const e = store.edges[key] ?? { count: 0, batch: 0 }
  store.edges[key] = { count: e.count + 1, batch: store.batch }
}

function log(ev, node, kind, text) {
  store.logs.push({ id: ev.id, t: ev.t, node, kind, text })
}

function handle(ev) {
  if (!store.run) return
  store.run.t = ev.t
  store.clock = ev.t // 재생 중에는 원래 실행의 경과 시간을 그대로 보여준다
  switch (ev.type) {
    case 'run':
      Object.assign(store.run, {
        mode: ev.mode, company: ev.company, created: ev.created, status: 'running',
        replay: !!ev.replay || store.run.replay,
      })
      store.runSettings = ev.settings ?? null
      if (!store.run.replay) startClock(ev.t)
      log(ev, null, 'info', ev.mode === 'company' ? `기업 지정 평가 시작: ${ev.company}` : '자동 발굴 평가 시작')
      break
    case 'node_start':
      onStart(ev)
      break
    case 'node_end':
      onEnd(ev)
      break
    case 'node_error':
      store.nodes[ev.node] = { ...(store.nodes[ev.node] ?? {}), status: 'error' }
      log(ev, ev.node, 'error', ev.message)
      break
    case 'done':
      for (const src of endedSinceStart) if (hasEdge(src, '__end__')) traverse(src, '__end__')
      store.batch += 1
      store.result = ev.result
      store.report = ev.result.report
      store.verify = ev.result.verify_result
      finish('done')
      log(ev, null, 'info', '평가 완료')
      loadRecordings()
      break
    case 'error':
      store.error = ev.message
      finish('error')
      log(ev, null, 'error', ev.message)
      break
    case 'cancelled':
      finish('cancelled')
      log(ev, null, 'info', '사용자가 중단함')
      break
  }
}

function finish(status) {
  store.run.status = status
  source?.close()
  stopClock()
  if (!store.run.replay) store.clock = store.run.t
  for (const n of Object.values(store.nodes)) if (n.status === 'running') n.status = 'stopped'
}

function onStart(ev) {
  if (!lastWasStart) {
    // 새 단계(superstep)의 첫 시작: 직전에 끝난 노드들에서 이어진 연결선을 표시한다
    if (endedSinceStart.length) frontier = endedSinceStart
    endedSinceStart = []
    store.batch += 1
  }
  lastWasStart = true
  for (const src of frontier) if (hasEdge(src, ev.node)) traverse(src, ev.node)

  const prev = store.nodes[ev.node] ?? { count: 0 }
  store.nodes[ev.node] = { ...prev, status: 'running', count: prev.count + 1, startT: ev.t, context: ev.context }

  const ctx = ev.context ?? {}
  if (ev.node === 'explorer') {
    const c = store.candidates[ctx.index]
    if (c) c.status = 'checking'
    log(ev, ev.node, 'start', ctx.target ? `${ctx.target} 조건 확인` : '후보 발굴 (고정 검색어 웹 검색)')
  } else {
    log(ev, ev.node, 'start', ctx.company ? `${ctx.company} 분석 시작` : '시작')
  }
}

function onEnd(ev) {
  lastWasStart = false
  endedSinceStart.push(ev.node)
  const n = store.nodes[ev.node]
  n.status = 'done'
  n.duration = ev.t - n.startT
  const u = ev.update ?? {}
  store.outputs[ev.node] = u
  if (store.follow) store.selected = ev.node

  const handlers = { explorer: endExplorer, judge: endJudge, reporter: endReporter, verifier: endVerifier }
  const text = (handlers[ev.node] ?? describeAnalysis)(ev.node, u)
  log(ev, ev.node, 'end', text)
}

function endExplorer(_, u) {
  for (const name of u.candidates ?? []) {
    if (!store.candidates.some((c) => c.name === name)) store.candidates.push({ name, status: 'pending' })
  }
  if (!u.candidates?.length) return '조건을 충족하는 후보를 찾지 못함'
  const c = store.candidates[(u.current_index ?? 1) - 1]
  if (!c) return u.eligibility_reason ?? ''
  const company = u.company ?? {}
  c.segment = company.segment
  if (u.is_eligible) {
    c.status = 'analyzing'
    return `${c.name} 조건 충족 · ${[company.segment, company.round].filter(Boolean).join(' · ')}`
  }
  c.status = 'excluded'
  c.reason = u.eligibility_reason
  return `${c.name} 제외 — ${u.eligibility_reason}`
}

function describeAnalysis(node, u) {
  const src = u.sources?.length ? ` · 출처 ${u.sources.length}건` : ''
  if (node === 'tech_summary') {
    const t = u.tech_summary ?? {}
    const miss = t.missing_fields?.length ? ` · 빈 항목 ${t.missing_fields.length}개` : ''
    const ctx = t.industry_context ? ` · 업계 해석 ${t.industry_context.length}건` : ''
    return `기술 근거 ${t.evidence?.length ?? 0}건${ctx}${miss}${src}`
  }
  if (node === 'market') {
    const m = u.market_analysis ?? {}
    return `시장 수치 ${m.figures?.length ?? 0}개${m.info_insufficient ? ' · 정보 부족' : ''}${src}`
  }
  if (node === 'competitor') return `같은 분야 경쟁사 ${u.competitor_analysis?.competitors?.length ?? 0}곳${src}`
  if (node === 'team') return `핵심 인력 ${u.team_analysis?.members?.length ?? 0}명${src}`
  return `${nodeLabel(node)} 완료${src}`
}

function endJudge(_, u) {
  const s = u.scores
  if (!s) return '채점 결과 없음'
  store.scores = s
  const c = store.candidates.find((x) => x.status === 'analyzing')
  store.scoresCompany = c?.name ?? store.outputs.explorer?.company?.name
  if (c) {
    c.status = s.decision === '투자' ? 'invest' : 'hold'
    c.total = s.total
    c.reason = s.hold_reasons?.join('; ')
  }
  return `${s.total}점 → ${s.decision}${s.decision === '보류' ? ` (${s.hold_reasons.join('; ')})` : ''}`
}

function endReporter(_, u) {
  store.report = u.report
  return `보고서 ${u.report?.length?.toLocaleString() ?? 0}자 작성${u.retry_count ? ` (재작성 ${u.retry_count}회차)` : ''}`
}

function endVerifier(_, u) {
  const v = u.verify_result ?? {}
  store.verify = v
  return v.passed ? `검증 통과 (수치 ${v.checked ?? 0}개 대조)` : `불일치 ${v.mismatches?.length ?? 0}건`
}

export function select(node) {
  store.selected = node
  store.follow = false
}

export function followLive() {
  store.follow = true
  const last = [...store.logs].reverse().find((l) => l.kind === 'end')
  if (last) store.selected = last.node
}
