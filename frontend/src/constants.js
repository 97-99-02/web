// 노드 이름은 에이전트 저장소 graph.py 의 add_node 이름과 같다.
export const NODE_INFO = {
  explorer: { label: '스타트업 탐색', sub: '웹 검색 · 조건 확인' },
  tech_summary: { label: '기술 요약', sub: 'RAG 기술 문서 + 웹' },
  market: { label: '시장성 평가', sub: 'RAG 시장 보고서' },
  competitor: { label: '경쟁사 비교', sub: '웹 검색' },
  team: { label: '팀 분석', sub: '웹 검색' },
  judge: { label: '투자 판단', sub: '평가표 채점 · 규칙 결정' },
  reporter: { label: '보고서 생성', sub: '출처 포함 작성' },
  verifier: { label: '사실 검증', sub: '수치·출처 대조' },
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
  'verifier->__end__': { lines: ['완료'], x: 1092, y: 250 },
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
