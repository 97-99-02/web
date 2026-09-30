<script setup>
import { computed } from 'vue'
import { FIELD_LABELS, NODE_INFO } from '../constants'
import { followLive, store } from '../useRun'
import SourceList from './SourceList.vue'
import ValueView from './ValueView.vue'

const TECH_FIELDS = ['core_chips', 'process', 'development_stage', 'performance_metrics', 'strengths', 'weaknesses', 'public_revenue_contracts']
const MISMATCH_KIND = { number: '수치', rag_number: '문서 수치', rag_claim: '문서 근거' }
const VERIFY_STAGE = { rag: '문서 원문 대조', judge: 'LLM 검수' }
const TOPIC = { performance: '성능', process: '공정', maturity: '성숙도', tradeoffs: '트레이드오프' }
const COMPARISON = { context_only: '일반 해석', comparable: '같은 조건 비교', conditions_missing: '비교 조건 부족' }
const CONTEXT_STATUS = {
  no_company_facts: '해석할 기업 사실이 없음',
  retrieval_unavailable: '기술 문서 검색 실패',
  no_reports: '관련 기술 보고서를 찾지 못함',
  no_supported_context: '보고서 근거로 뒷받침되는 해석 없음',
}

const name = computed(() => store.selected)
const info = computed(() => NODE_INFO[name.value])
const run = computed(() => store.nodes[name.value])
const u = computed(() => store.outputs[name.value])

const company = computed(() => {
  const { name: _, ...rest } = u.value?.company ?? {}
  return rest
})
const tech = computed(() => u.value?.tech_summary)
const techFields = computed(() => Object.fromEntries(TECH_FIELDS.map((k) => [k, tech.value?.[k]])))
const diag = computed(() => {
  const d = tech.value?.diagnostics
  if (!d) return null
  const rag = d.rag ?? {}
  return [
    `웹 검색 ${d.retrieved_web ?? 0}건 → 근거 선택 ${d.selected_web ?? 0}건`,
    `주장 채택 ${d.accepted_claims ?? 0} · 기각 ${Array.isArray(d.rejected_claims) ? d.rejected_claims.length : (d.rejected_claims ?? 0)}`,
    rag.retrieved_reports != null ? `기술 보고서 ${rag.retrieved_reports}조각 검색 → 해석 ${tech.value.industry_context?.length ?? 0}건 채택` : null,
  ].filter(Boolean)
})
const market = computed(() => u.value?.market_analysis)
const comp = computed(() => u.value?.competitor_analysis)
const team = computed(() => u.value?.team_analysis)
const verify = computed(() => u.value?.verify_result)

const title = computed(() => {
  if (!run.value) return ''
  const d = run.value.duration != null ? `${run.value.duration.toFixed(1)}초` : ''
  const c = run.value.count > 1 ? `${run.value.count}번째 실행` : ''
  return [c, d].filter(Boolean).join(' · ')
})
</script>

<template>
  <section class="card detail">
    <h2 class="card-title">
      {{ info ? info.label : '에이전트 결과' }}
      <span v-if="title" class="hint">{{ title }}</span>
      <span class="spacer" />
      <button v-if="!store.follow" class="btn small" type="button" @click="followLive">자동 따라가기</button>
      <span v-else-if="store.run" class="badge accent">자동 따라가는 중</span>
    </h2>

    <p v-if="!name" class="empty">에이전트가 끝나면 결과가 여기에 표시됩니다. 그래프의 노드를 눌러도 됩니다.</p>
    <p v-else-if="run?.status === 'running' && !u" class="empty running">{{ info.label }} 진행 중…</p>
    <p v-else-if="!u" class="empty">아직 실행되지 않았습니다</p>

    <div v-else class="body">
      <!-- 스타트업 탐색 -->
      <template v-if="name === 'explorer'">
        <div class="verdict" :class="u.is_eligible ? 'ok' : 'bad'">
          <strong>{{ u.company?.name ?? '후보 없음' }}</strong>
          {{ u.is_eligible ? '평가 조건 충족' : `제외 — ${u.eligibility_reason}` }}
        </div>
        <ValueView v-if="Object.keys(company).length" :value="company" />
      </template>

      <!-- 기술 요약 -->
      <template v-else-if="name === 'tech_summary' && tech">
        <p v-if="tech.missing_fields?.length" class="note">
          빈 항목: {{ tech.missing_fields.map((f) => FIELD_LABELS[f] ?? f).join(', ') }}
        </p>
        <p v-if="diag" class="diag">{{ diag.join(' · ') }}</p>
        <ValueView :value="techFields" />
        <div v-if="tech.industry_context_status" class="context">
          <h3>업계 맥락 <span class="muted">기술 보고서 근거로 해석</span></h3>
          <ul v-if="tech.industry_context?.length" class="claims">
            <li v-for="(c, i) in tech.industry_context" :key="i">
              <span class="badge tiny accent">{{ TOPIC[c.topic] ?? c.topic }}</span>
              <span class="badge tiny">{{ COMPARISON[c.comparison] ?? c.comparison }}</span> {{ c.text }}
              <span class="meta">{{ [c.title, c.date, c.page ? `${c.page}쪽` : ''].filter(Boolean).join(' · ') }}</span>
            </li>
          </ul>
          <p v-else class="muted">{{ CONTEXT_STATUS[tech.industry_context_status] ?? tech.industry_context_status }}</p>
        </div>
        <details v-if="tech.evidence?.length" class="more">
          <summary>주장별 근거 {{ tech.evidence.length }}건</summary>
          <ul class="claims">
            <li v-for="(e, i) in tech.evidence" :key="i">
              <span class="badge tiny">{{ FIELD_LABELS[e.field] ?? e.field }}</span> {{ e.text }}
              <span class="meta">{{ [e.title, e.date, e.page ? `${e.page}쪽` : ''].filter(Boolean).join(' · ') }}</span>
            </li>
          </ul>
        </details>
      </template>

      <!-- 시장성 평가 -->
      <template v-else-if="name === 'market' && market">
        <p class="summary">{{ market.summary }}</p>
        <table v-if="market.figures?.length" class="tbl">
          <thead><tr><th>구분</th><th>수치</th><th>기준</th><th>시장 범위</th></tr></thead>
          <tbody>
            <tr v-for="(f, i) in market.figures" :key="i">
              <td>{{ f.kind }}</td><td class="strong">{{ f.value }}</td><td>{{ f.year }}</td><td>{{ f.scope }}</td>
            </tr>
          </tbody>
        </table>
        <ValueView :value="{ demand_drivers: market.demand_drivers, market_risks: market.market_risks }" />
      </template>

      <!-- 경쟁사 비교 -->
      <template v-else-if="name === 'competitor' && comp">
        <table v-if="comp.competitors?.length" class="tbl">
          <thead><tr><th>경쟁사</th><th>구분</th><th>비교</th></tr></thead>
          <tbody>
            <tr v-for="c in comp.competitors" :key="c.name">
              <td class="strong">{{ c.name }}<span class="meta">{{ [c.country, c.product].filter(Boolean).join(' · ') }}</span></td>
              <td><span class="badge tiny" :class="c.tier === '선도 기업' ? 'accent' : ''">{{ c.tier }}</span></td>
              <td>{{ c.comparison }}</td>
            </tr>
          </tbody>
        </table>
        <ValueView :value="{ differentiation: comp.differentiation, competitive_risks: comp.competitive_risks,
          ...(comp.excluded_other_segment?.length ? { excluded_other_segment: comp.excluded_other_segment } : {}) }" />
      </template>

      <!-- 팀 분석 -->
      <template v-else-if="name === 'team' && team">
        <ul class="members">
          <li v-for="m in team.members" :key="m.name">
            <strong>{{ m.name }}</strong> <span class="badge tiny">{{ m.role }}</span>
            <p>{{ m.background }}</p>
          </li>
        </ul>
        <ValueView :value="{ team_size: team.team_size, strengths: team.strengths, concerns: team.concerns }" />
      </template>

      <!-- 투자 판단 -->
      <template v-else-if="name === 'judge' && u.scores">
        <div class="verdict" :class="u.scores.decision === '투자' ? 'ok' : 'warn'">
          <strong>{{ u.scores.total }}점 → {{ u.scores.decision }}</strong>
          {{ u.scores.hold_reasons?.join('; ') }}
        </div>
        <p class="muted">항목별 점수와 근거는 ‘투자 판단’ 카드에 있습니다.</p>
      </template>

      <!-- 보고서 생성 -->
      <template v-else-if="name === 'reporter'">
        <p>보고서 {{ u.report?.length?.toLocaleString() }}자 작성{{ u.retry_count ? ` · 재작성 ${u.retry_count}회차` : '' }}</p>
        <p class="muted">본문은 아래 ‘투자 보고서’에 있습니다.</p>
      </template>

      <!-- 사실 검증 -->
      <template v-else-if="name === 'verifier' && verify">
        <div class="verdict" :class="verify.passed ? 'ok' : 'warn'">
          <strong>{{ verify.passed ? '검증 통과' : `불일치 ${verify.mismatches?.length ?? 0}건` }}</strong>
          보고서 수치 {{ verify.checked ?? 0 }}개 대조
          <template v-if="verify.rag"> · 문서 근거 확인 {{ verify.rag.grounded ?? 0 }}/{{ verify.rag.checked ?? 0 }}</template>
        </div>
        <p v-for="(msg, stage) in verify.errors ?? {}" :key="stage" class="note">
          {{ VERIFY_STAGE[stage] ?? stage }} 단계 오류로 건너뜀: {{ msg }}
        </p>
        <ul v-if="verify.mismatches?.length" class="claims">
          <li v-for="(m, i) in verify.mismatches" :key="i">
            <span class="badge warn tiny">{{ MISMATCH_KIND[m.kind] ?? m.kind }}</span> <strong>{{ m.value }}</strong>
            <span class="meta">{{ m.context }}</span>
          </li>
        </ul>
      </template>

      <ValueView v-else :value="u" />

      <SourceList :sources="u.sources ?? []" />
    </div>
  </section>
</template>

<style scoped>
.detail .body { font-size: 14px; }
.running { color: var(--accent); animation: pulse 1.4s infinite; }
.verdict { padding: 10px 12px; border-radius: 10px; margin-bottom: 14px; font-size: 14px; }
.verdict strong { margin-right: 6px; font-size: 15px; }
.verdict.ok { background: var(--ok-soft); color: var(--ok); }
.verdict.bad { background: #f1f5f9; color: #475569; }
.verdict.warn { background: var(--warn-soft); color: var(--warn); }
.note { margin: 0 0 10px; font-size: 13px; color: var(--warn); }
.summary { margin: 0 0 12px; }
.tbl { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 13.5px; }
.tbl th { text-align: left; font-size: 12px; color: var(--muted); font-weight: 600; padding: 0 8px 6px 0; border-bottom: 1px solid var(--line); }
.tbl td { padding: 7px 8px 7px 0; border-bottom: 1px solid var(--line); vertical-align: top; }
.strong { font-weight: 700; }
.meta { display: block; color: var(--muted); font-size: 12px; font-weight: 400; }
.tiny { font-size: 11px; padding: 1px 7px; }
.diag { margin: 0 0 12px; padding: 7px 10px; border-radius: 8px; background: #f8fafc; color: #475569; font-size: 12.5px; }
.context { margin-top: 14px; }
.context h3 { margin: 0 0 6px; font-size: 14px; }
.context h3 .muted { font-size: 12px; font-weight: 500; }
.more { margin-top: 12px; }
.more summary { cursor: pointer; font-weight: 700; color: #334155; }
.claims { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 8px; font-size: 13.5px; }
.members { list-style: none; margin: 0 0 14px; padding: 0; display: grid; gap: 10px; }
.members p { margin: 2px 0 0; color: #334155; font-size: 13.5px; }
</style>
