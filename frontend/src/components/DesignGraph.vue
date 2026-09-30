<script setup>
// 팀 README의 '설계 그래프'(노드 안 흐름 포함)를 그리고, 실행 이벤트에서 추론한 경로를 강조한다
import { computed } from 'vue'
import { DESIGN_EDGES, DESIGN_GROUPS, DESIGN_NODES, DESIGN_VIEW, NODE_H, NODE_INFO, TERMINAL_R } from '../constants'
import { select, store } from '../useRun'

const isLive = computed(() => ['running', 'connecting'].includes(store.run?.status))
const D = computed(() => store.design)

function state(batch) {
  if (batch == null) return 'idle'
  return batch === D.value.batch && isLive.value ? 'active' : 'done'
}

const edges = computed(() =>
  DESIGN_EDGES.map((e) => {
    const key = `${e.from}->${e.to}`
    return { ...e, key, d: e.d ?? forwardPath(e.from, e.to), state: state(D.value.edges[key]?.batch) }
  }).sort((a, b) => rank(a.state) - rank(b.state)),
)

const nodes = computed(() =>
  Object.entries(DESIGN_NODES).map(([id, n]) => {
    const info = n.node ? NODE_INFO[n.node] : {}
    const run = n.node ? store.nodes[n.node] : null
    const reached = D.value.reached[id]
    let status = run?.status ?? (reached != null ? 'done' : 'idle')
    if (!run && reached != null && reached === D.value.batch && isLive.value) status = 'active'
    if (id === 'start' && store.run && store.run.status !== 'connecting') status = 'done'
    return {
      id, ...n, h: n.h ?? NODE_H, label: n.label ?? info.label, sub: n.sub ?? info.sub, run, status,
      target: n.node ?? n.select,
    }
  }),
)

function rank(s) {
  return { idle: 0, done: 1, active: 2 }[s]
}

function side(id, where) {
  const n = DESIGN_NODES[id]
  const half = n.kind === 'terminal' ? TERMINAL_R : n.kind === 'diamond' ? n.hw : n.w / 2
  return where === 'right' ? [n.x + half, n.y] : [n.x - half - 2, n.y]
}

function forwardPath(a, b) {
  const [sx, sy] = side(a, 'right')
  const [tx, ty] = side(b, 'left')
  const mx = (sx + tx) / 2
  return `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ty}, ${tx} ${ty}`
}

function diamond(n) {
  return `${n.x},${n.y - n.hh} ${n.x + n.hw},${n.y} ${n.x},${n.y + n.hh} ${n.x - n.hw},${n.y}`
}

function statusText(n) {
  const run = n.run
  if (!run) return n.id === 'rescore' && n.status !== 'idle' ? '✓ 재채점함' : ''
  const times = run.count > 1 ? `${run.count}회 · ` : ''
  if (run.status === 'running') return `${times}진행 중…`
  if (run.status === 'error') return '오류'
  if (run.status === 'stopped') return '중단됨'
  return `${times}✓ ${run.duration?.toFixed(1)}초`
}

function click(n) {
  if (n.target) select(n.target)
}
</script>

<template>
  <svg class="graph" :viewBox="`0 0 ${DESIGN_VIEW.w} ${DESIGN_VIEW.h}`" role="img" aria-label="README 설계 그래프">
    <defs>
      <marker v-for="s in ['idle', 'done', 'active']" :id="`d-arrow-${s}`" :key="s" viewBox="0 0 10 10" refX="9" refY="5"
        markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" :class="`arrow-${s}`" />
      </marker>
    </defs>

    <g v-for="g in DESIGN_GROUPS" :key="g.label">
      <rect class="group" :x="g.x" :y="g.y" :width="g.w" :height="g.h" rx="16" />
      <text class="group-label" :x="g.lx" :y="g.ly" :text-anchor="g.anchor">{{ g.label }}</text>
    </g>

    <path v-for="e in edges" :key="e.key" :d="e.d" class="edge" :class="[e.state, { cond: e.cond }]"
      :marker-end="`url(#d-arrow-${e.state})`" />
    <template v-for="e in edges" :key="`l-${e.key}`">
      <text v-if="e.label" class="edge-label" :class="e.state" :x="e.label.x" :y="e.label.y"
        :text-anchor="e.label.anchor ?? 'middle'">
        <tspan v-for="(line, i) in e.label.lines" :key="i" :x="e.label.x" :dy="i ? 15 : 0">{{ line }}</tspan>
      </text>
    </template>

    <g v-for="n in nodes" :key="n.id" class="node" :class="[n.kind, n.status, { selected: n.target && store.selected === n.target && n.kind === 'box' }]"
      :tabindex="n.target ? 0 : -1" :role="n.target ? 'button' : undefined" @click="click(n)" @keydown.enter="click(n)">
      <template v-if="n.kind === 'terminal'">
        <circle :cx="n.x" :cy="n.y" :r="TERMINAL_R" />
        <text class="t-label" :x="n.x" :y="n.y + 32" text-anchor="middle">{{ n.label }}</text>
      </template>
      <template v-else-if="n.kind === 'diamond'">
        <polygon class="box" :points="diamond(n)" />
        <text class="d-label" :x="n.x" :y="n.y + (n.lines.length > 1 ? -3 : 5)" text-anchor="middle">
          <tspan v-for="(line, i) in n.lines" :key="i" :x="n.x" :dy="i ? 16 : 0">{{ line }}</tspan>
        </text>
      </template>
      <template v-else>
        <rect v-if="n.status === 'running'" class="halo" :x="n.x - n.w / 2 - 6" :y="n.y - n.h / 2 - 6"
          :width="n.w + 12" :height="n.h + 12" rx="18" />
        <rect class="box" :x="n.x - n.w / 2" :y="n.y - n.h / 2" :width="n.w" :height="n.h" rx="12" />
        <text class="label" :x="n.x" :y="n.y - 9" text-anchor="middle">{{ n.label }}</text>
        <text class="sub" :x="n.x" :y="n.y + 9" text-anchor="middle">{{ n.sub }}</text>
        <text class="status" :x="n.x" :y="n.y + 25" text-anchor="middle">{{ statusText(n) }}</text>
      </template>
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

.node { outline: none; }
.node[role='button'] { cursor: pointer; }
.node.terminal circle { fill: #fff; stroke: var(--line-strong); stroke-width: 2.5; }
.node.terminal .t-label { font-size: 12.5px; fill: var(--faint); font-weight: 600; }
.node.terminal.done circle, .node.terminal.active circle { fill: var(--text); stroke: var(--text); }
.node.terminal.done .t-label, .node.terminal.active .t-label { fill: var(--text); }

.node .box { fill: #fff; stroke: var(--line-strong); stroke-width: 1.5; transition: stroke 0.3s, fill 0.3s; }
.node[role='button']:hover .box { stroke: var(--faint); }
.node .label { font-size: 16px; font-weight: 700; fill: var(--text); }
.node .sub { font-size: 11.5px; fill: var(--muted); }
.node .status { font-size: 11.5px; font-weight: 700; fill: var(--muted); }
.node .d-label { font-size: 13px; font-weight: 700; fill: #475569; }
.node.idle .label { fill: #475569; }

.node.running .box, .node.active .box { stroke: var(--accent); stroke-width: 2.5; fill: var(--accent-soft); }
.node.running .status { fill: var(--accent); }
.node .halo { fill: none; stroke: var(--accent); stroke-width: 3; opacity: 0.35; animation: pulse 1.2s ease-in-out infinite; }
.node.done .box { stroke: var(--ok); stroke-width: 2; }
.node.done .status { fill: var(--ok); }
.node.diamond.done .box { fill: #f0fdf4; }
.node.diamond.done .d-label, .node.diamond.active .d-label { fill: var(--text); }
.node.error .box { stroke: var(--bad); stroke-width: 2.5; fill: var(--bad-soft); }
.node.error .status { fill: var(--bad); }
.node.stopped .box { stroke: var(--faint); stroke-dasharray: 5 4; }
.node.selected .box { stroke-width: 3.5; filter: drop-shadow(0 4px 10px rgb(79 70 229 / 0.25)); }

@keyframes flow { to { stroke-dashoffset: -17; } }
</style>
