<script setup>
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { computed } from 'vue'
import { store } from '../useRun'

// 보고서 링크를 누르면 시연 화면을 떠나지 않도록 새 탭으로 연다
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

// 목록 바로 다음 줄의 **소제목** 은 마크다운에서 목록 안으로 딸려 들어가므로 빈 줄을 넣어 끊는다
const normalize = (md) => md.replace(/^(\s*[-*] .*)\n(\*\*)/gm, '$1\n\n$2')
// 보고서에는 웹 검색 원문이 섞이므로 HTML로 바꾼 뒤 반드시 정리(sanitize)한다
const html = computed(() => (store.report ? DOMPurify.sanitize(marked.parse(normalize(store.report))) : ''))
const done = computed(() => store.run?.status === 'done')
const pdfUrl = computed(() => {
  const id = store.run?.recording ?? store.run?.id
  return done.value && store.result?.pdf && id ? `/api/recordings/${id}/pdf` : null
})
const v = computed(() => store.verify)
</script>

<template>
  <section class="card">
    <h2 class="card-title">
      투자 보고서
      <span v-if="store.report && !done" class="badge accent">초안 · 사실 검증 전</span>
      <span v-else-if="v" class="badge" :class="v.passed ? 'ok' : 'warn'">
        {{ v.passed ? '사실 검증 통과' : `확인 필요 ${v.mismatches?.length ?? 0}건` }}
      </span>
      <span class="spacer" />
      <a v-if="pdfUrl" class="btn primary small" :href="pdfUrl" download>PDF 다운로드</a>
    </h2>
    <p v-if="!store.report" class="empty">투자 판단이 끝나면 보고서 생성 에이전트가 작성합니다</p>
    <!-- eslint-disable-next-line vue/no-v-html -->
    <article v-else class="md" v-html="html" />
  </section>
</template>

<style scoped>
a.btn { text-decoration: none; }
.md { max-height: 72vh; overflow-y: auto; padding-right: 8px; font-size: 15px; line-height: 1.7; }
.md :deep(h1) { font-size: 24px; margin: 4px 0 12px; letter-spacing: -0.02em; }
.md :deep(h2) { font-size: 19px; margin: 26px 0 10px; padding-bottom: 6px; border-bottom: 1px solid var(--line); }
.md :deep(h3) { font-size: 16px; margin: 18px 0 8px; }
.md :deep(p) { margin: 8px 0; }
.md :deep(ul), .md :deep(ol) { padding-left: 22px; }
.md :deep(table) { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13.5px; }
.md :deep(th), .md :deep(td) { border: 1px solid var(--line); padding: 6px 9px; text-align: left; vertical-align: top; }
.md :deep(th) { background: #f8fafc; }
.md :deep(a) { color: var(--accent); }
.md :deep(blockquote) { margin: 10px 0; padding: 6px 14px; border-left: 3px solid var(--line-strong); color: #475569; background: #f8fafc; }
.md :deep(code) { font-family: var(--mono); font-size: 0.9em; background: #f1f5f9; padding: 1px 5px; border-radius: 5px; }
</style>
