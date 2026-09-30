<script setup>
import { computed, ref } from 'vue'
import { store } from '../useRun'

const s = computed(() => store.scores)
const cfg = computed(() => store.meta?.settings)
const open = ref(null)

const rows = computed(() => {
  if (!s.value || !cfg.value) return []
  return Object.entries(cfg.value.weights).map(([key, weight]) => {
    const item = s.value.items?.[key] ?? {}
    return {
      key, weight, label: cfg.value.item_labels[key] ?? key, score: item.score ?? 0,
      contrib: ((item.score ?? 0) / 5) * weight, evidence: item.evidence, insufficient: item.insufficient,
      core: cfg.value.core_items.includes(key),
    }
  })
})

const invest = computed(() => s.value?.decision === '투자')
</script>

<template>
  <section class="card">
    <h2 class="card-title">
      투자 판단
      <span v-if="store.scoresCompany" class="hint">{{ store.scoresCompany }}</span>
      <span class="spacer" />
      <span v-if="s" class="badge" :class="invest ? 'ok' : 'warn'">{{ s.decision }}</span>
    </h2>

    <p v-if="!s" class="empty">분석 4개가 모두 끝나면 평가표로 채점합니다</p>
    <template v-else>
      <div class="total">
        <div class="num mono" :class="invest ? 'ok' : 'warn'">{{ s.total }}<small>점</small></div>
        <div class="bar-wrap">
          <div class="bar"><div class="fill" :class="invest ? 'ok' : 'warn'" :style="{ width: `${s.total}%` }" /></div>
          <div class="threshold" :style="{ left: `${cfg.threshold}%` }"><span>투자 기준 {{ cfg.threshold }}점</span></div>
        </div>
      </div>

      <ul v-if="s.hold_reasons?.length" class="reasons">
        <li v-for="r in s.hold_reasons" :key="r">{{ r }}</li>
      </ul>

      <table class="items">
        <thead>
          <tr><th>평가 항목</th><th class="w">비중</th><th>점수</th><th class="w">환산</th></tr>
        </thead>
        <tbody>
          <template v-for="r in rows" :key="r.key">
            <tr class="row" :class="{ open: open === r.key }" @click="open = open === r.key ? null : r.key">
              <td>
                <span class="item-label">{{ r.label }}</span>
                <span v-if="r.core" class="badge accent tiny">핵심</span>
                <span v-if="r.insufficient" class="badge warn tiny">근거 부족</span>
              </td>
              <td class="w mono">{{ r.weight }}%</td>
              <td>
                <span class="dots" :aria-label="`${r.score}점 / 5점`">
                  <i v-for="k in 5" :key="k" :class="{ on: k <= r.score, low: r.core && r.score < cfg.core_min_score }" />
                </span>
                <span class="mono score">{{ r.score }}/5</span>
              </td>
              <td class="w mono">{{ r.contrib.toFixed(1) }}</td>
            </tr>
            <tr v-if="open === r.key" class="evidence-row">
              <td colspan="4">{{ r.evidence || '근거 없음' }}</td>
            </tr>
          </template>
        </tbody>
      </table>
      <p class="foot muted">항목을 누르면 채점 근거가 보입니다 · 환산 점수 = Σ(점수 ÷ 5 × 비중)</p>

      <div v-if="s.legal_risk" class="legal" :class="{ bad: s.legal_risk.unresolved }">
        <strong>법률 리스크</strong> {{ s.legal_risk.evidence }}
      </div>
      <div v-if="s.risks?.length" class="risks">
        <strong>주요 리스크</strong>
        <ul class="list">
          <li v-for="(r, i) in s.risks" :key="i"><span class="badge tiny">{{ r.category }}</span> {{ r.description }}</li>
        </ul>
      </div>
    </template>
  </section>
</template>

<style scoped>
.total { display: flex; align-items: center; gap: 22px; margin-bottom: 14px; }
.num { font-size: 44px; font-weight: 800; line-height: 1; letter-spacing: -0.03em; }
.num small { font-size: 18px; margin-left: 2px; font-weight: 700; }
.num.ok { color: var(--ok); }
.num.warn { color: var(--warn); }
.bar-wrap { position: relative; flex: 1; padding-bottom: 22px; }
.bar { height: 12px; border-radius: 999px; background: #f1f5f9; overflow: hidden; }
.fill { height: 100%; border-radius: 999px; transition: width 0.8s ease; }
.fill.ok { background: var(--ok); }
.fill.warn { background: #f59e0b; }
.threshold { position: absolute; top: -4px; height: 20px; border-left: 2px dashed var(--text); }
.threshold span {
  position: absolute; top: 22px; left: 0; transform: translateX(-50%); font-size: 12px; font-weight: 700; white-space: nowrap;
}
.reasons { margin: 0 0 12px; padding: 10px 12px 10px 28px; border-radius: 10px; background: var(--warn-soft); color: var(--warn); font-size: 14px; font-weight: 600; }
.items { width: 100%; border-collapse: collapse; font-size: 14px; }
.items th { text-align: left; font-size: 12px; color: var(--muted); font-weight: 600; padding: 0 6px 6px; border-bottom: 1px solid var(--line); }
.items td { padding: 8px 6px; border-bottom: 1px solid var(--line); vertical-align: middle; }
.items .w { text-align: right; width: 60px; }
.row { cursor: pointer; }
.row:hover td, .row.open td { background: #f8fafc; }
.item-label { font-weight: 600; margin-right: 6px; }
.tiny { font-size: 11px; padding: 1px 7px; margin-right: 4px; }
.dots { display: inline-flex; gap: 4px; vertical-align: middle; margin-right: 8px; }
.dots i { width: 11px; height: 11px; border-radius: 50%; background: #e2e8f0; }
.dots i.on { background: var(--accent); }
.dots i.on.low { background: var(--bad); }
.score { color: var(--muted); font-size: 13px; }
.evidence-row td { background: #f8fafc; color: #334155; font-size: 13.5px; padding: 4px 10px 12px; }
.foot { font-size: 12px; margin: 8px 0 0; }
.legal { margin-top: 14px; font-size: 13.5px; padding: 10px 12px; border-radius: 10px; background: #f8fafc; }
.legal.bad { background: var(--bad-soft); color: var(--bad); }
.legal strong, .risks strong { margin-right: 6px; }
.risks { margin-top: 12px; font-size: 13.5px; }
.risks ul { margin-top: 6px; }
</style>
