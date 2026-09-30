<script setup>
// 에이전트 출력(dict·list·문자열)을 모양 그대로 보여주는 범용 표시기. 필드 이름은 FIELD_LABELS로 한글화한다.
import { FIELD_LABELS } from '../constants'

defineOptions({ name: 'ValueView' })
defineProps({ value: { type: null, required: true }, depth: { type: Number, default: 0 } })

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v)
const isEmpty = (v) => v == null || v === '' || (Array.isArray(v) && !v.length) || (isObj(v) && !Object.keys(v).length)
const fmt = (v) => (typeof v === 'boolean' ? (v ? '예' : '아니오') : String(v))
</script>

<template>
  <span v-if="isEmpty(value)" class="none">정보 없음</span>
  <span v-else-if="!Array.isArray(value) && !isObj(value)" class="scalar">{{ fmt(value) }}</span>
  <ul v-else-if="Array.isArray(value) && value.every((v) => !isObj(v))" class="list">
    <li v-for="(v, i) in value" :key="i">{{ fmt(v) }}</li>
  </ul>
  <div v-else-if="Array.isArray(value)" class="objs">
    <div v-for="(v, i) in value" :key="i" class="obj"><ValueView :value="v" :depth="depth + 1" /></div>
  </div>
  <dl v-else class="kv">
    <template v-for="(v, k) in value" :key="k">
      <dt>{{ FIELD_LABELS[k] ?? k }}</dt>
      <dd><ValueView :value="v" :depth="depth + 1" /></dd>
    </template>
  </dl>
</template>

<style scoped>
.none { color: var(--faint); }
.kv { display: grid; grid-template-columns: minmax(84px, max-content) 1fr; gap: 6px 14px; margin: 0; }
.kv dt { color: var(--muted); font-size: 13px; font-weight: 600; }
.kv dd { margin: 0; min-width: 0; }
.objs { display: grid; gap: 8px; }
.obj { padding: 8px 10px; border: 1px solid var(--line); border-radius: 10px; background: #fcfdfe; }
</style>
