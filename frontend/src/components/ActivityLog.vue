<script setup>
import { nextTick, ref, watch } from 'vue'
import { nodeLabel } from '../constants'
import { select, store } from '../useRun'

const box = ref(null)

watch(
  () => store.logs.length,
  async () => {
    const el = box.value
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    await nextTick()
    if (nearBottom) el.scrollTop = el.scrollHeight
  },
)
</script>

<template>
  <section class="card">
    <h2 class="card-title">에이전트 활동 <span class="hint">{{ store.logs.length ? `${store.logs.length}건` : '' }}</span></h2>
    <p v-if="!store.logs.length" class="empty">실행 기록이 여기에 쌓입니다</p>
    <ol v-else ref="box" class="log">
      <li v-for="l in store.logs" :key="l.id" :class="l.kind">
        <span class="t mono">{{ l.t.toFixed(1) }}s</span>
        <button v-if="l.node" class="node" type="button" @click="select(l.node)">{{ nodeLabel(l.node) }}</button>
        <span class="text">{{ l.text }}</span>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.log { list-style: none; margin: 0; padding: 0; max-height: 340px; overflow-y: auto; font-size: 13.5px; }
.log li { display: flex; gap: 10px; align-items: baseline; padding: 5px 2px; border-bottom: 1px solid #f1f5f9; }
.t { flex: none; width: 52px; text-align: right; color: var(--faint); font-size: 12px; }
.node {
  flex: none; border: 0; border-radius: 6px; padding: 1px 8px; font-size: 12px; font-weight: 700;
  background: #f1f5f9; color: #334155; cursor: pointer;
}
.text { min-width: 0; }
.start .text { color: var(--muted); }
.end .node { background: var(--accent-soft); color: var(--accent); }
.end .text { font-weight: 600; }
.error .text, .error .node { color: var(--bad); }
.info .text { font-weight: 700; }
</style>
