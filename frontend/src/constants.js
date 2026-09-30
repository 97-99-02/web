// 노드 이름은 에이전트 저장소 graph.py 의 add_node 이름과 같다.
export const NODE_INFO = {
  explorer: { label: '스타트업 탐색', sub: '후보 발굴 · 조건 확인' },
  tech_summary: { label: '기술 요약', sub: '웹 사실 + RAG 업계 해석' },
  market: { label: '시장성 평가', sub: 'RAG 시장(+기술) 문서' },
  competitor: { label: '경쟁사 비교', sub: '웹 검색 · 상장 여부 판정' },
  team: { label: '팀 분석', sub: '웹 검색' },
  judge: { label: '투자 판단', sub: '채점 · 규칙 · 재채점' },
  reporter: { label: '보고서 생성', sub: '출처 포함 작성' },
  verifier: { label: '사실 검증', sub: '수치·원문·LLM 검수' },
}

export const nodeLabel = (name) => NODE_INFO[name]?.label ?? name

// 그래프 그림 좌표 (viewBox 기준). 연결선은 API가 준 실제 edge로 그린다.
export const VIEW = { w: 1160, h: 510 }
export const LAYOUT = {
  __start__: { x: 34, y: 260, terminal: true, label: '시작' },
  explorer: { x: 165, y: 260, w: 170 },
  tech_summary: { x: 400, y: 122, w: 180 },
  market: { x: 400, y: 214, w: 180 },
  competitor: { x: 400, y: 306, w: 180 },
  team: { x: 400, y: 398, w: 180 },
  judge: { x: 625, y: 260, w: 140 },
  reporter: { x: 820, y: 260, w: 140 },
  verifier: { x: 1000, y: 260, w: 140 },
  __end__: { x: 1126, y: 260, terminal: true, label: '종료' },
}
export const NODE_H = 64
export const TERMINAL_R = 12
export const PARALLEL_GROUP = { x: 296, y: 80, w: 208, h: 360, label: '조건 충족 → 4개 에이전트 병렬 분석' }

// 조건 분기 설명 (graph.py 의 route_* 함수). judge→reporter 는 투자일 때와 보류인데 남은 후보가 없을 때 모두 지난다
export const EDGE_LABELS = {
  'explorer->explorer': { lines: ['조건 미충족'], x: 128, y: 168 },
  'explorer->reporter': { lines: ['남은 후보 없음'], x: 500, y: 12 },
  'judge->explorer': { lines: ['보류 → 다음 후보'], x: 395, y: 502 },
  'judge->reporter': { lines: ['투자', '후보 소진'], x: 722, y: 196 },
  'verifier->reporter': { lines: ['불일치 → 1회 재작성'], x: 918, y: 156 },
  'verifier->__end__': { lines: ['통과 또는', '확인 필요 표시'], x: 1098, y: 200 },
}

// 특수한 모양의 연결선 (되돌아가는 선, 자기 자신으로 가는 선)
export const EDGE_PATHS = {
  'explorer->explorer': 'M 110 228 C 80 166, 170 166, 145 226',
  'explorer->reporter': 'M 200 228 C 200 -50, 795 -50, 795 226',
  'judge->explorer': 'M 625 292 C 625 540, 165 540, 165 294',
  'verifier->reporter': 'M 990 228 C 990 150, 845 150, 845 226',
}

export const FIELD_LABELS = {
  // 기업 정보 (explorer)
  name: '기업명', segment: '세부 분야', product: '대표 제품', ceo: '대표자', listed: '상장 여부',
  exited: '엑싯', latest_round: '최근 라운드', round: '투자 단계', round_date: '투자 시기',
  funding_amount: '최근 투자 금액', total_funding: '누적 투자', valuation: '기업가치', investors: '주요 투자사',
  is_domestic: '국내 기업',
  // 기술 요약
  core_chips: '핵심 칩', process: '공정', development_stage: '개발 단계', performance_metrics: '성능 지표',
  strengths: '강점', weaknesses: '약점', public_revenue_contracts: '공개 매출·계약',
  // 시장성
  figures: '시장 수치', demand_drivers: '수요 요인', market_risks: '시장 리스크', summary: '요약', searched: '검색 범위',
  // 경쟁사
  competitors: '경쟁사', differentiation: '차별점', competitive_risks: '경쟁 리스크',
  excluded_other_segment: '다른 분야라 제외',
  // 팀
  members: '핵심 인력', team_size: '임직원 수', concerns: '우려 사항',
}

export const SEGMENT_TIER_CLASS = { '선도 기업': 'tier-lead', '동급 기업': 'tier-peer' }

export const CANDIDATE_STATUS = {
  pending: { label: '대기', cls: 'st-pending' },
  checking: { label: '조건 확인 중', cls: 'st-active' },
  analyzing: { label: '분석 중', cls: 'st-active' },
  excluded: { label: '조건 미충족', cls: 'st-excluded' },
  hold: { label: '보류', cls: 'st-hold' },
  invest: { label: '투자', cls: 'st-invest' },
}

// ---------- 설계 그래프 (팀 README '설계 그래프', 노드 안 흐름 포함) ----------
// 마름모(남은 후보? / 과거 평가와 다름? / 투자·보류)는 실제 LangGraph 노드가 아니라 분기 함수·judge 노드 안 로직이라
// 서버 이벤트에서 경로를 추론해 표시한다 (useRun.js designEvent)
export const ANALYSIS_NODES = ['tech_summary', 'market', 'competitor', 'team']

export const DESIGN_VIEW = { w: 1440, h: 530 }
export const DESIGN_GROUPS = [
  { x: 300, y: 130, w: 200, h: 350, label: '조건 충족 → 4개 병렬 분석', lx: 400, ly: 502, anchor: 'middle' },
  { x: 555, y: 222, w: 440, h: 270, label: '투자 판단 (judge 노드 안)', lx: 572, ly: 248, anchor: 'start' },
]
export const DESIGN_NODES = {
  start: { kind: 'terminal', x: 30, y: 320, label: '시작' },
  explorer: { kind: 'box', x: 160, y: 320, w: 170, node: 'explorer' },
  next: { kind: 'diamond', x: 160, y: 150, hw: 58, hh: 34, lines: ['남은 후보?'] },
  tech_summary: { kind: 'box', x: 400, y: 170, w: 180, h: 58, node: 'tech_summary' },
  market: { kind: 'box', x: 400, y: 260, w: 180, h: 58, node: 'market' },
  competitor: { kind: 'box', x: 400, y: 350, w: 180, h: 58, node: 'competitor' },
  team: { kind: 'box', x: 400, y: 440, w: 180, h: 58, node: 'team' },
  score: { kind: 'box', x: 640, y: 320, w: 130, node: 'judge', label: '평가표 채점', sub: '환산 점수·결정 규칙' },
  diff: { kind: 'diamond', x: 790, y: 320, hw: 62, hh: 44, lines: ['과거 평가와', '크게 다름?'], select: 'judge' },
  rescore: { kind: 'box', x: 790, y: 440, w: 150, h: 54, label: '재채점', sub: 'seed 2회 · 항목별 중앙값', select: 'judge' },
  dec: { kind: 'diamond', x: 930, y: 320, hw: 48, hh: 38, lines: ['투자 /', '보류'], select: 'judge' },
  reporter: { kind: 'box', x: 1100, y: 320, w: 140, node: 'reporter' },
  verifier: { kind: 'box', x: 1280, y: 320, w: 140, node: 'verifier' },
  end: { kind: 'terminal', x: 1405, y: 320, label: '종료' },
  end2: { kind: 'terminal', x: 1280, y: 470, label: '확인 필요 표시 후 종료' },
}
export const DESIGN_EDGES = [
  { from: 'start', to: 'explorer' },
  { from: 'explorer', to: 'next', cond: true, d: 'M 145 288 L 145 178', label: { lines: ['조건 미충족'], x: 136, y: 240, anchor: 'end' } },
  { from: 'next', to: 'explorer', cond: true, d: 'M 175 178 L 175 286', label: { lines: ['있음'], x: 184, y: 240, anchor: 'start' } },
  ...ANALYSIS_NODES.map((a) => ({ from: 'explorer', to: a, cond: true })),
  ...ANALYSIS_NODES.map((a) => ({ from: a, to: 'score' })),
  { from: 'score', to: 'diff' },
  { from: 'diff', to: 'rescore', cond: true, d: 'M 790 364 L 790 411', label: { lines: ['예'], x: 800, y: 393, anchor: 'start' } },
  { from: 'diff', to: 'dec', cond: true, label: { lines: ['아니오'], x: 867, y: 306 } },
  { from: 'rescore', to: 'dec', d: 'M 865 440 C 930 440, 930 400, 930 360' },
  { from: 'dec', to: 'reporter', cond: true, label: { lines: ['투자'], x: 1004, y: 308 } },
  { from: 'dec', to: 'next', cond: true, d: 'M 930 282 C 930 70, 400 90, 220 150', label: { lines: ['보류'], x: 942, y: 264, anchor: 'start' } },
  { from: 'next', to: 'reporter', cond: true, d: 'M 160 116 C 160 10, 1080 10, 1080 286', label: { lines: ['남은 후보 없음'], x: 620, y: 44 } },
  { from: 'reporter', to: 'verifier' },
  { from: 'verifier', to: 'end', cond: true, label: { lines: ['통과'], x: 1372, y: 308 } },
  { from: 'verifier', to: 'reporter', cond: true, d: 'M 1265 288 C 1265 215, 1125 215, 1125 286', label: { lines: ['불일치 → 1회 재작성'], x: 1195, y: 222 } },
  { from: 'verifier', to: 'end2', cond: true, d: 'M 1280 352 L 1280 456', label: { lines: ['재작성 후에도', '불일치'], x: 1292, y: 396, anchor: 'start' } },
]
