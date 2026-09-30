<script setup>
import { ref } from 'vue'

defineProps({ sources: { type: Array, default: () => [] } })
const open = ref(false)

function safeUrl(url) {
  return /^https?:\/\//i.test(url ?? '') ? url : null
}
</script>

<template>
  <div v-if="sources.length" class="sources">
    <button class="toggle" type="button" @click="open = !open">
      {{ open ? '▾' : '▸' }} 근거 출처 {{ sources.length }}건
    </button>
    <ul v-if="open" class="items">
      <li v-for="(s, i) in sources" :key="i">
        <span class="badge tiny" :class="s.kind === 'report' ? 'accent' : ''">{{ s.kind === 'report' ? '보고서' : '웹' }}</span>
        <a v-if="safeUrl(s.url)" :href="safeUrl(s.url)" target="_blank" rel="noopener noreferrer">{{ s.title || s.url }}</a>
        <span v-else>{{ s.title || s.source_file }}</span>
        <span class="meta">{{ [s.publisher, s.date, s.page ? `${s.page}쪽` : ''].filter(Boolean).join(' · ') }}</span>
        <p v-if="s.snippet" class="snippet">{{ s.snippet }}</p>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.sources { margin-top: 14px; border-top: 1px solid var(--line); padding-top: 10px; }
.toggle { border: 0; background: none; padding: 4px 0; font-weight: 700; color: #334155; cursor: pointer; }
.items { list-style: none; margin: 6px 0 0; padding: 0; display: grid; gap: 10px; font-size: 13.5px; }
.tiny { font-size: 11px; padding: 1px 7px; margin-right: 6px; }
a { color: var(--accent); text-decoration: none; font-weight: 600; }
a:hover { text-decoration: underline; }
.meta { display: block; color: var(--muted); font-size: 12px; margin-top: 2px; }
.snippet { margin: 4px 0 0; padding: 6px 10px; border-left: 3px solid var(--line-strong); color: #475569; font-size: 12.5px; background: #f8fafc; }
</style>
