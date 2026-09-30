<script setup>
import { computed } from 'vue'
import {
  EDGE_LABELS, EDGE_PATHS, LAYOUT, NODE_H, NODE_INFO, PARALLEL_GROUP, TERMINAL_R, VIEW,
} from '../constants'
import { select, store } from '../useRun'

const edges = computed(() =>
  (store.meta?.graph.edges ?? [])
    .filter((e) => LAYOUT[e.source] && LAYOUT[e.target])
    .map((e) => {
      const key = `${e.source}->${e.target}`
      const seen = store.edges[key]
      const state = !seen ? 'idle' : seen.batch === store.batch && isLive.value ? 'active' : 'done'
      return { ...e, key, d: EDGE_PATHS[key] ?? forwardPath(e.source, e.target), state, count: seen?.count ?? 0 }
    })
    // 강조된 선이 위에 그려지도록
    .sort((a, b) => rank(a.state) - rank(b.state)),
)

const isLive = computed(() => ['running', 'connecting'].includes(store.run?.status))

const nodes = computed(() =>
  Object.entries(LAYOUT)
    .filter(([name]) => !LAYOUT[name].terminal)
    .map(([name, p]) => ({ name, ...p, ...NODE_INFO[name], run: store.nodes[name] })),
)

const terminals = computed(() =>
  Object.entries(LAYOUT)
    .filter(([, p]) => p.terminal)
    .map(([name, p]) => ({
      name, ...p,
      reached: name === '__start__' ? !!store.run?.status && store.run.status !== 'connecting' : !!store.edges[`verifier->${name}`],
    })),
)

const labels = computed(() =>
  Object.entries(EDGE_LABELS).map(([key, l]) => {
    const seen = store.edges[key]
    return { key, ...l, state: !seen ? 'idle' : seen.batch === store.batch && isLive.value ? 'active' : 'done' }
  }),
)

function rank(s) {
  return { idle: 0, done: 1, active: 2 }[s]
}

function side(name, where) {
  const p = LAYOUT[name]
  const half = p.terminal ? TERMINAL_R : p.w / 2
  return where === 'right' ? [p.x + half, p.y] : [p.x - half - (p.terminal ? 0 : 2), p.y]
}

function forwardPath(src, dst) {
  const [sx, sy] = side(src, 'right')
  const [tx, ty] = side(dst, 'left')
  const mx = (sx + tx) / 2
  return `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ty}, ${tx} ${ty}`
}

function statusText(run) {
  if (!run) return ''
  const times = run.count > 1 ? `${run.count}회 · ` : ''
  if (run.status === 'running') return `${times}진행 중…`
  if (run.status === 'error') return '오류'
  if (run.status === 'stopped') return '중단됨'
  return `${times}✓ ${run.duration?.toFixed(1)}초`
}
</script>

<template>
  <svg class="graph" :viewBox="`0 0 ${VIEW.w} ${VIEW.h}`" role="img" aria-label="LangGraph 에이전트 흐름">
    <defs>
      <marker v-for="s in ['idle', 'done', 'active']" :id="`arrow-${s}`" :key="s" viewBox="0 0 10 10" refX="9" refY="5"
        markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" :class="`arrow-${s}`" />
      </marker>
    </defs>

    <rect class="group" :x="PARALLEL_GROUP.x" :y="PARALLEL_GROUP.y" :width="PARALLEL_GROUP.w" :height="PARALLEL_GROUP.h" rx="16" />
    <text class="group-label" :x="PARALLEL_GROUP.x + PARALLEL_GROUP.w / 2" :y="PARALLEL_GROUP.y - 12" text-anchor="middle">
      {{ PARALLEL_GROUP.label }}
    </text>

    <path v-for="e in edges" :key="e.key" :d="e.d" class="edge" :class="[e.state, { cond: e.conditional }]"
      :marker-end="`url(#arrow-${e.state})`" />

    <text v-for="l in labels" :key="l.key" class="edge-label" :class="l.state" :x="l.x" :y="l.y" text-anchor="middle">
      <tspan v-for="(line, i) in l.lines" :key="i" :x="l.x" :dy="i ? 15 : 0">{{ line }}</tspan>
    </text>

    <g v-for="t in terminals" :key="t.name" class="terminal" :class="{ reached: t.reached }">
      <circle :cx="t.x" :cy="t.y" :r="TERMINAL_R" />
      <text :x="t.x" :y="t.y + 32" text-anchor="middle">{{ t.label }}</text>
    </g>

    <g v-for="n in nodes" :key="n.name" class="node" :class="[n.run?.status ?? 'idle', { selected: store.selected === n.name }]"
      tabindex="0" role="button" :aria-label="`${n.label} 결과 보기`" @click="select(n.name)" @keydown.enter="select(n.name)">
      <rect v-if="n.run?.status === 'running'" class="halo" :x="n.x - n.w / 2 - 6" :y="n.y - NODE_H / 2 - 6"
        :width="n.w + 12" :height="NODE_H + 12" rx="18" />
      <rect class="box" :x="n.x - n.w / 2" :y="n.y - NODE_H / 2" :width="n.w" :height="NODE_H" rx="12" />
      <text class="label" :x="n.x" :y="n.y - 9" text-anchor="middle">{{ n.label }}</text>
      <text class="sub" :x="n.x" :y="n.y + 9" text-anchor="middle">{{ n.sub }}</text>
      <text class="status" :x="n.x" :y="n.y + 25" text-anchor="middle">{{ statusText(n.run) }}</text>
    </g>
  </svg>
</template>

<style scoped>
.graph { display: block; width: 100%; height: auto; user-select: none; }

.group { fill: #f8fafc; stroke: var(--line-strong); stroke-dasharray: 6 5; }
.group-label { font-size: 13px; font-weight: 600; fill: var(--muted); }

.edge { fill: none; stroke: var(--line-strong); stroke-width: 1.6; transition: stroke 0.3s; }
.edge.cond { stroke-dasharray: 6 5; }
.edge.done { stroke: #64748b; stroke-width: 2.2; }
.edge.active { stroke: var(--accent); stroke-width: 3.2; stroke-dasharray: 10 7; animation: flow 0.7s linear infinite; }
.arrow-idle { fill: var(--line-strong); }
.arrow-done { fill: #64748b; }
.arrow-active { fill: var(--accent); }

.edge-label { font-size: 12.5px; fill: var(--faint); font-weight: 500; }
.edge-label.done { fill: #475569; font-weight: 600; }
.edge-label.active { fill: var(--accent); font-weight: 700; }

.terminal circle { fill: #fff; stroke: var(--line-strong); stroke-width: 2.5; }
.terminal text { font-size: 12.5px; fill: var(--faint); font-weight: 600; }
.terminal.reached circle { fill: var(--text); stroke: var(--text); }
.terminal.reached text { fill: var(--text); }

.node { cursor: pointer; outline: none; }
.node .box { fill: #fff; stroke: var(--line-strong); stroke-width: 1.5; transition: stroke 0.3s, fill 0.3s; }
.node:hover .box, .node:focus-visible .box { stroke: var(--faint); }
.node .label { font-size: 16px; font-weight: 700; fill: var(--text); }
.node .sub { font-size: 11.5px; fill: var(--muted); }
.node .status { font-size: 11.5px; font-weight: 700; fill: var(--muted); }
.node.idle .label { fill: #475569; }

.node.running .box { stroke: var(--accent); stroke-width: 2.5; fill: var(--accent-soft); }
.node.running .status { fill: var(--accent); }
.node .halo { fill: none; stroke: var(--accent); stroke-width: 3; opacity: 0.35; animation: pulse 1.2s ease-in-out infinite; }
.node.done .box { stroke: var(--ok); stroke-width: 2; }
.node.done .status { fill: var(--ok); }
.node.error .box { stroke: var(--bad); stroke-width: 2.5; fill: var(--bad-soft); }
.node.error .status { fill: var(--bad); }
.node.stopped .box { stroke: var(--faint); stroke-dasharray: 5 4; }
.node.selected .box { stroke-width: 3.5; filter: drop-shadow(0 4px 10px rgb(79 70 229 / 0.25)); }

@keyframes flow { to { stroke-dashoffset: -17; } }
</style>
