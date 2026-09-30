<script setup>
import { computed, ref, watch } from 'vue'
import { cancelRun, replay, startRun, stopReplay, store } from '../useRun'

const mode = ref('company')
const company = ref('')
const recId = ref('')
const speed = ref(4)

const warm = computed(() => store.meta?.warm)
const running = computed(() => store.run && ['connecting', 'running'].includes(store.run.status))
const canStart = computed(
  () => warm.value?.ready && !running.value && (mode.value === 'discover' || company.value.trim()),
)

watch(
  () => store.recordings,
  (list) => {
    if (!list.some((r) => r.id === recId.value)) recId.value = list[0]?.id ?? ''
  },
)

function submit() {
  if (canStart.value) startRun(mode.value, mode.value === 'company' ? company.value.trim() : null)
}

function recLabel(r) {
  const when = r.created?.replace('T', ' ').slice(5, 16)
  const target = r.mode === 'company' ? r.company : '자동 발굴'
  const outcome = r.invested ? `${r.invested} 투자 ${r.total}점` : '추천 없음'
  return `${when} · ${target} → ${outcome}`
}
</script>

<template>
  <section class="card controls">
    <form class="live" @submit.prevent="submit">
      <div class="seg" role="radiogroup" aria-label="평가 방식">
        <button type="button" :class="{ on: mode === 'company' }" :disabled="running" @click="mode = 'company'">
          기업 지정
        </button>
        <button type="button" :class="{ on: mode === 'discover' }" :disabled="running" @click="mode = 'discover'">
          자동 발굴
        </button>
      </div>
      <input
        v-if="mode === 'company'"
        v-model="company"
        class="input"
        maxlength="40"
        placeholder="기업명 (예: 파네시아)"
        :disabled="running"
      />
      <p v-else class="discover-note">고정 검색어로 후보를 찾아 최대 {{ store.meta?.settings.max_candidates ?? 5 }}곳까지 차례로 평가</p>
      <button class="btn primary" type="submit" :disabled="!canStart">평가 시작</button>
      <button
        v-if="running && !store.run.replay"
        class="btn danger"
        type="button"
        :disabled="store.run.cancelRequested"
        @click="cancelRun"
      >
        {{ store.run.cancelRequested ? '현재 단계 끝나면 중단' : '중단' }}
      </button>
    </form>

    <div class="replay">
      <span class="replay-label">저장된 실행</span>
      <select v-model="recId" class="input select" :disabled="running || !store.recordings.length">
        <option v-if="!store.recordings.length" value="">저장된 실행 없음</option>
        <option v-for="r in store.recordings" :key="r.id" :value="r.id">{{ recLabel(r) }}</option>
      </select>
      <select v-model.number="speed" class="input speed" :disabled="running" aria-label="재생 속도">
        <option :value="1">1배속</option>
        <option :value="2">2배속</option>
        <option :value="4">4배속</option>
        <option :value="10">10배속</option>
      </select>
      <button v-if="running && store.run.replay" class="btn" type="button" @click="stopReplay">재생 멈춤</button>
      <button v-else class="btn" type="button" :disabled="running || !recId" @click="replay(recId, speed)">재생</button>
    </div>

    <p v-if="warm && !warm.ready" class="warm" :class="{ bad: warm.error }">
      {{ warm.error ? `임베딩·벡터DB 로딩 실패: ${warm.error}` : '임베딩 모델(KURE-v1)과 벡터DB를 불러오는 중…' }}
    </p>
    <p v-if="store.metaError" class="warm bad">백엔드에 연결하지 못했습니다 ({{ store.metaError }}). backend/run.sh 가 실행 중인지 확인하세요.</p>
  </section>
</template>

<style scoped>
.controls { display: flex; flex-wrap: wrap; align-items: center; gap: 14px 28px; }
.live, .replay { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.live { flex: 1 1 520px; }
.replay { flex: 0 1 auto; padding-left: 28px; border-left: 1px solid var(--line); }
.seg { display: inline-flex; padding: 3px; background: #f1f5f9; border-radius: 11px; }
.seg button {
  height: 34px; padding: 0 14px; border: 0; border-radius: 8px; background: transparent;
  font-weight: 600; color: var(--muted); cursor: pointer;
}
.seg button.on { background: var(--card); color: var(--text); box-shadow: 0 1px 3px rgb(15 23 42 / 0.12); }
.seg button:disabled { cursor: not-allowed; }
.input {
  height: 40px; padding: 0 12px; border: 1px solid var(--line-strong); border-radius: 10px;
  background: var(--card); min-width: 0;
}
.live .input { flex: 1 1 200px; max-width: 320px; }
.input:focus { outline: 2px solid var(--accent-soft); border-color: var(--accent); }
.select { max-width: 360px; }
.speed { width: 92px; }
.discover-note { margin: 0; flex: 1 1 200px; color: var(--muted); font-size: 14px; }
.replay-label { font-size: 13px; font-weight: 700; color: var(--muted); }
.warm { flex-basis: 100%; margin: 0; font-size: 13px; color: var(--accent); animation: pulse 1.6s infinite; }
.warm.bad { color: var(--bad); animation: none; }
@media (max-width: 900px) {
  .replay { padding-left: 0; border-left: 0; }
}
</style>
