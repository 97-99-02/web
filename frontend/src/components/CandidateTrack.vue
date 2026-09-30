<script setup>
import { computed } from 'vue'
import { CANDIDATE_STATUS } from '../constants'
import { store } from '../useRun'

const discovering = computed(
  () => store.run?.mode === 'discover' && !store.candidates.length && store.nodes.explorer?.status === 'running',
)
</script>

<template>
  <section class="card">
    <h2 class="card-title">
      평가 후보
      <span class="hint">비상장 · Seed~Series C · Exit 전 국내 기업만 분석</span>
    </h2>
    <p v-if="discovering" class="empty pulse">고정 검색어로 후보를 발굴하는 중…</p>
    <p v-else-if="!store.candidates.length" class="empty">평가를 시작하면 후보가 여기에 표시됩니다</p>
    <ol v-else class="track">
      <li v-for="(c, i) in store.candidates" :key="c.name" class="cand" :class="CANDIDATE_STATUS[c.status].cls">
        <span class="idx">{{ i + 1 }}</span>
        <div class="body">
          <div class="top">
            <strong class="name">{{ c.name }}</strong>
            <span class="state">{{ CANDIDATE_STATUS[c.status].label }}</span>
            <span v-if="c.total != null" class="total mono">{{ c.total }}점</span>
          </div>
          <p v-if="c.segment || c.reason" class="reason" :title="c.reason">
            <span v-if="c.segment" class="seg">{{ c.segment }}</span>{{ c.reason }}
          </p>
        </div>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.pulse { animation: pulse 1.6s infinite; color: var(--accent); }
.track { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.cand {
  display: flex; gap: 12px; align-items: flex-start; padding: 10px 12px; border-radius: 11px;
  border: 1px solid var(--line); background: #fff; transition: background 0.3s, border-color 0.3s;
}
.idx {
  flex: none; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center;
  font-size: 12px; font-weight: 700; background: #f1f5f9; color: var(--muted);
}
.body { min-width: 0; flex: 1; }
.top { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.name { font-size: 16px; }
.state { font-size: 12px; font-weight: 700; }
.total { margin-left: auto; font-weight: 800; font-size: 16px; }
.reason {
  margin: 3px 0 0; font-size: 13px; color: var(--muted);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.seg { font-weight: 600; color: #475569; margin-right: 8px; }

.st-pending .state { color: var(--faint); }
.st-active { border-color: var(--accent); background: var(--accent-soft); }
.st-active .state { color: var(--accent); animation: pulse 1.4s infinite; }
.st-active .idx { background: var(--accent); color: #fff; }
.st-excluded { background: #f8fafc; }
.st-excluded .name { color: var(--muted); text-decoration: line-through; text-decoration-color: var(--faint); }
.st-excluded .state { color: var(--faint); }
.st-hold { border-color: #fcd34d; background: #fffbeb; }
.st-hold .state, .st-hold .total { color: var(--warn); }
.st-invest { border-color: #86efac; background: #f0fdf4; }
.st-invest .state, .st-invest .total { color: var(--ok); }
.st-invest .idx { background: var(--ok); color: #fff; }
</style>
