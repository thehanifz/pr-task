<template>
  <div class="tree-wrap" ref="wrapRef">
    <svg ref="svgRef" class="tree-svg">
      <g ref="gRef" />
    </svg>

    <!-- Mobile hint -->
    <div v-if="isTouchDevice" class="touch-hint">
      👆 Tap = collapse/expand &nbsp;·&nbsp; Hold = edit node
    </div>

    <!-- Node Context Popup (klik kanan / long-press) -->
    <div
      v-if="popup.show"
      class="node-popup"
      :style="{ top: popup.y + 'px', left: popup.x + 'px' }"
      @click.stop
      @touchstart.stop
    >
      <!-- Header -->
      <div class="popup-header">
        <span class="popup-title">✏️ Edit Node</span>
        <button class="popup-close-x" @click="closePopup">×</button>
      </div>

      <!-- Rename -->
      <div class="popup-section">
        <label class="popup-label">Nama</label>
        <div class="rename-row">
          <input
            ref="renameInput"
            class="rename-input"
            v-model="popup.nameVal"
            @keydown.enter="applyRename"
            @keydown.esc="closePopup"
            maxlength="40"
          />
          <button class="rename-apply" @click="applyRename" title="Simpan">✔</button>
        </div>
      </div>

      <!-- Divider -->
      <div class="popup-divider" />

      <!-- Color Swatches -->
      <div class="popup-section">
        <label class="popup-label">Warna Node</label>
        <div class="color-swatches">
          <button
            v-for="c in swatches"
            :key="c"
            class="swatch"
            :class="{ active: popup.colorVal === c }"
            :style="{ background: c }"
            @click="applyColor(c)"
          />
        </div>
        <input
          type="color"
          class="color-custom"
          :value="popup.colorVal"
          @input="applyColor($event.target.value)"
        />
      </div>

      <!-- Close -->
      <button class="popup-close-btn" @click="closePopup">✕ Tutup</button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, reactive, nextTick, computed } from 'vue'
import * as d3 from 'd3'
import { useTreeStore } from '@/stores/tree'

const store    = useTreeStore()
const svgRef   = ref(null)
const gRef     = ref(null)
const wrapRef  = ref(null)
const renameInput = ref(null)

// Deteksi touch device
const isTouchDevice = computed(() => window.matchMedia('(hover: none)').matches)

// Single unified popup (replace both color picker + dblclick rename)
const popup = reactive({
  show:     false,
  nodeId:   null,
  nameVal:  '',
  colorVal: '#3b82f6',
  x: 0,
  y: 0
})

const swatches = [
  '#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6',
  '#ec4899','#06b6d4','#84cc16','#f97316','#6366f1',
  '#14b8a6','#a855f7','#e11d48','#0ea5e9','#ffffff'
]

const NODE_W  = 140
const NODE_H  = 36
const NODE_RX = 8

let svg, g, zoom

// ── Long-press state ──────────────────────────
let longPressTimer = null
const LONG_PRESS_MS = 500

function startLongPress(event, d) {
  cancelLongPress()
  longPressTimer = setTimeout(() => {
    longPressTimer = null
    const touch = event.touches ? event.touches[0] : event
    openPopupAt(touch.clientX, touch.clientY, d)
  }, LONG_PRESS_MS)
}

function cancelLongPress() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

function openPopupAt(clientX, clientY, d) {
  const rect     = wrapRef.value.getBoundingClientRect()
  const isTouch  = window.matchMedia('(hover: none)').matches
  // popup dimensions (estimasi, tergantung media query)
  const popupW   = isTouch ? 210 : 230
  const popupH   = isTouch ? 250 : 280

  let x = clientX - rect.left
  let y = clientY - rect.top

  // Di mobile, geser popup sedikit ke atas agar tidak nutupin titik sentuh
  if (isTouch) y -= 24

  // Clamp agar tidak keluar batas
  if (x + popupW > rect.width)  x = rect.width  - popupW - 8
  if (y + popupH > rect.height) y = rect.height - popupH - 8
  if (x < 8) x = 8
  if (y < 8) y = 8

  popup.show     = true
  popup.nodeId   = d.data.id
  popup.nameVal  = d.data.name
  popup.colorVal = d.data.color || '#3b82f6'
  popup.x = x
  popup.y = y
  nextTick(() => {
    renameInput.value?.focus()
    renameInput.value?.select()
  })
}

function openPopup(event, d) {
  event.preventDefault()
  event.stopPropagation()
  openPopupAt(event.clientX, event.clientY, d)
}

function closePopup() {
  popup.show = false
}

function applyRename() {
  const name = popup.nameVal.trim()
  if (name && popup.nodeId) {
    store.updateNodeName(popup.nodeId, name)
  }
  closePopup()
}

function applyColor(color) {
  popup.colorVal = color
  if (popup.nodeId) {
    store.updateNodeColor(popup.nodeId, color)
  }
}

function buildD3Tree(data) {
  function clone(node) {
    const n = { ...node, _children: node.children || [] }
    n.children = node.collapsed ? null : (node.children || []).map(clone)
    return n
  }
  return clone(data)
}

function render() {
  if (!svgRef.value || !gRef.value) return
  const isTouch = window.matchMedia('(hover: none)').matches

  const root = d3.hierarchy(buildD3Tree(store.tree), d => d.children)

  const treeLayout = d3.tree().nodeSize([NODE_H + 14, NODE_W + 60])
  treeLayout(root)

  const nodes = root.descendants()
  const links = root.links()

  const gEl = d3.select(gRef.value)
  gEl.selectAll('*').remove()

  // Links
  gEl.selectAll('.link')
    .data(links)
    .enter()
    .append('path')
    .attr('class', 'link')
    .attr('fill', 'none')
    .attr('stroke', 'rgba(255,255,255,0.12)')
    .attr('stroke-width', 1.5)
    .attr('d', d3.linkHorizontal().x(d => d.y).y(d => d.x))

  // Node groups
  const nodeG = gEl.selectAll('.node')
    .data(nodes)
    .enter()
    .append('g')
    .attr('class', 'node')
    .attr('transform', d => `translate(${d.y},${d.x})`)
    .style('cursor', 'pointer')

  // Node rect
  nodeG.append('rect')
    .attr('x', -NODE_W / 2)
    .attr('y', -NODE_H / 2)
    .attr('width', NODE_W)
    .attr('height', NODE_H)
    .attr('rx', NODE_RX)
    .attr('fill', d => d.data.color || '#3b82f6')
    .attr('fill-opacity', 0.18)
    .attr('stroke', d => d.data.color || '#3b82f6')
    .attr('stroke-width', 1.5)

  // Node label
  nodeG.append('text')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'central')
    .attr('fill', d => d.data.color || '#3b82f6')
    .attr('font-size', '12px')
    .attr('font-weight', '600')
    .attr('pointer-events', 'none')
    .text(d => d.data.name.length > 16 ? d.data.name.slice(0, 15) + '\u2026' : d.data.name)

  // Collapse indicator dot
  nodeG.filter(d => d.data._children && d.data._children.length > 0)
    .append('circle')
    .attr('cx', NODE_W / 2)
    .attr('cy', 0)
    .attr('r', 6)
    .attr('fill', d => d.data.color || '#3b82f6')
    .attr('stroke', 'var(--bg, #0f1117)')
    .attr('stroke-width', 2)

  nodeG.filter(d => d.data._children && d.data._children.length > 0)
    .append('text')
    .attr('x', NODE_W / 2)
    .attr('y', 0)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'central')
    .attr('fill', '#fff')
    .attr('font-size', '9px')
    .attr('font-weight', '800')
    .attr('pointer-events', 'none')
    .text(d => d.data.collapsed ? '+' : '\u2212')

  // ── Add child button (+) ───────────────────
  const addBtn = nodeG.append('g')
    .attr('class', 'add-btn')
    .attr('transform', `translate(${NODE_W / 2 + 18}, 0)`)
    .style('opacity', isTouch ? 1 : 0)

  addBtn.append('circle')
    .attr('r', isTouch ? 12 : 9)
    .attr('fill', 'rgba(255,255,255,0.08)')
    .attr('stroke', 'rgba(255,255,255,0.2)')
    .attr('stroke-width', 1)

  addBtn.append('text')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'central')
    .attr('fill', 'rgba(255,255,255,0.7)')
    .attr('font-size', isTouch ? '16px' : '14px')
    .attr('pointer-events', 'none')
    .text('+')

  addBtn.on('click', (event, d) => {
    event.stopPropagation()
    store.addChild(d.data.id)
  })

  addBtn.on('touchend', (event, d) => {
    event.preventDefault()
    event.stopPropagation()
    cancelLongPress()
    store.addChild(d.data.id)
  })

  // ── Delete button (×) — not for root ──────
  const delBtn = nodeG.filter(d => d.data.id !== 'root')
    .append('g')
    .attr('class', 'del-btn')
    .attr('transform', `translate(${-NODE_W / 2 - 18}, 0)`)
    .style('opacity', isTouch ? 1 : 0)

  delBtn.append('circle')
    .attr('r', isTouch ? 12 : 9)
    .attr('fill', 'rgba(239,68,68,0.15)')
    .attr('stroke', 'rgba(239,68,68,0.4)')
    .attr('stroke-width', 1)

  delBtn.append('text')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'central')
    .attr('fill', '#ef4444')
    .attr('font-size', isTouch ? '16px' : '12px')
    .attr('pointer-events', 'none')
    .text('\u00d7')

  delBtn.on('click', (event, d) => {
    event.stopPropagation()
    if (confirm(`Hapus node "${d.data.name}" beserta semua anaknya?`)) {
      store.deleteNode(d.data.id)
    }
  })

  delBtn.on('touchend', (event, d) => {
    event.preventDefault()
    event.stopPropagation()
    cancelLongPress()
    if (confirm(`Hapus node "${d.data.name}" beserta semua anaknya?`)) {
      store.deleteNode(d.data.id)
    }
  })

  // ── Hover show/hide (mouse only) ──────────
  if (!isTouch) {
    nodeG
      .on('mouseenter', function() {
        d3.select(this).select('.add-btn').style('opacity', 1)
        d3.select(this).select('.del-btn').style('opacity', 1)
      })
      .on('mouseleave', function() {
        d3.select(this).select('.add-btn').style('opacity', 0)
        d3.select(this).select('.del-btn').style('opacity', 0)
      })
  }

  // ── Click = toggle collapse (mouse) ───────
  nodeG.on('click', (event, d) => {
    if (d.data._children && d.data._children.length > 0) {
      store.toggleCollapse(d.data.id)
    }
  })

  // ── Right-click = buka popup (mouse) ──────
  nodeG.on('contextmenu', (event, d) => {
    openPopup(event, d)
  })

  // ── Touch: long-press = buka popup, tap = collapse ──
  nodeG
    .on('touchstart', (event, d) => {
      if (event.target.closest('.add-btn') || event.target.closest('.del-btn')) return
      startLongPress(event, d)
    })
    .on('touchend', (event, d) => {
      const wasLP = longPressTimer === null && !popup.show
      cancelLongPress()
      if (!wasLP && !popup.show) {
        if (d.data._children && d.data._children.length > 0) {
          event.preventDefault()
          store.toggleCollapse(d.data.id)
        }
      }
    })
    .on('touchmove', () => {
      cancelLongPress()
    })
}

function fitView() {
  if (!svgRef.value || !gRef.value || !zoom) return
  const svgEl = d3.select(svgRef.value)
  const bounds = gRef.value.getBBox()
  const w = svgRef.value.clientWidth
  const h = svgRef.value.clientHeight
  const scale = Math.min(0.9, Math.min(w / (bounds.width + 80), h / (bounds.height + 80)))
  const tx = (w - bounds.width * scale) / 2 - bounds.x * scale
  const ty = (h - bounds.height * scale) / 2 - bounds.y * scale
  svgEl.transition().duration(500).call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale))
}

defineExpose({ fitView })

onMounted(() => {
  const svgEl = d3.select(svgRef.value)
  const gEl   = d3.select(gRef.value)

  zoom = d3.zoom()
    .scaleExtent([0.1, 3])
    .on('zoom', e => gEl.attr('transform', e.transform))

  svgEl.call(zoom)
  svgEl.on('dblclick.zoom', null)

  render()
  nextTick(() => fitView())

  const handleOutsideClick = (e) => {
    if (!e.target.closest('.node-popup') && !e.target.closest('.node')) {
      closePopup()
    }
  }
  document.addEventListener('click', handleOutsideClick)
  document.addEventListener('touchstart', handleOutsideClick)

  onUnmounted(() => {
    document.removeEventListener('click', handleOutsideClick)
    document.removeEventListener('touchstart', handleOutsideClick)
    cancelLongPress()
  })
})

watch(() => JSON.stringify(store.tree), () => {
  render()
})
</script>

<style scoped>
.tree-wrap {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  background: var(--bg, #0f1117);
  border-radius: 10px;
  border: 1px solid var(--border, #1e2330);
}
.tree-svg {
  width: 100%;
  height: 100%;
  display: block;
}

/* Touch hint */
.touch-hint {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0,0,0,0.55);
  color: rgba(255,255,255,0.55);
  font-size: 0.65rem;
  padding: 4px 10px;
  border-radius: 20px;
  pointer-events: none;
  white-space: nowrap;
  backdrop-filter: blur(4px);
}

/* ── Node Popup (default / desktop) ───────── */
.node-popup {
  position: absolute;
  z-index: 200;
  background: var(--bg2, #161b2e);
  border: 1px solid var(--border, #1e2330);
  border-radius: 12px;
  padding: 12px;
  min-width: 220px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.55);
  animation: popupIn 0.12s ease;
}
@keyframes popupIn {
  from { opacity: 0; transform: scale(0.94) translateY(-4px); }
  to   { opacity: 1; transform: none; }
}

/* ── Popup compact di mobile ───────────────── */
@media (max-width: 480px) {
  .node-popup {
    width: min(90vw, 210px);
    min-width: 0;
    max-width: calc(100vw - 20px);
    padding: 10px;
    border-radius: 10px;
  }
  .popup-header    { margin-bottom: 7px; }
  .popup-title     { font-size: 0.7rem; }
  .popup-section   { margin-bottom: 7px; }
  .popup-label     { font-size: 0.6rem; margin-bottom: 4px; letter-spacing: 0.05em; }
  .rename-row      { gap: 5px; }
  .rename-input    { padding: 6px 8px; }
  .rename-apply    { min-width: 36px; min-height: 36px; padding: 5px 9px; }
  .popup-divider   { margin: 5px 0; }
  .color-swatches  { gap: 5px; margin-bottom: 5px; }
  .swatch          { width: 30px; height: 30px; border-radius: 7px; }
  .color-custom    { height: 28px; }
  .popup-close-btn { min-height: 38px; padding: 7px; font-size: 0.72rem; margin-top: 3px; }
}

.popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.popup-title {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text, #e2e8f0);
}
.popup-close-x {
  background: none;
  border: none;
  color: var(--muted, #6b7280);
  font-size: 1.1rem;
  cursor: pointer;
  line-height: 1;
  padding: 4px 6px;
  min-width: 32px;
  min-height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.popup-close-x:hover { color: var(--text, #e2e8f0); }

.popup-section { margin-bottom: 10px; }
.popup-label {
  display: block;
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--muted, #6b7280);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  margin-bottom: 6px;
}

/* Rename row */
.rename-row {
  display: flex;
  gap: 6px;
  align-items: center;
}
.rename-input {
  flex: 1;
  padding: 8px 9px;
  border-radius: 6px;
  border: 1px solid var(--border, #1e2330);
  background: var(--bg, #0f1117);
  color: var(--text, #e2e8f0);
  outline: none;
  transition: border-color 0.15s;
  /* Prevent iOS auto-zoom on focus */
  font-size: max(16px, 0.85rem);
}
.rename-input:focus { border-color: rgba(59,130,246,0.5); }
.rename-apply {
  padding: 8px 12px;
  min-width: 40px;
  min-height: 40px;
  border-radius: 6px;
  background: rgba(59,130,246,0.15);
  border: 1px solid rgba(59,130,246,0.3);
  color: #3b82f6;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.rename-apply:hover { background: rgba(59,130,246,0.28); }

.popup-divider {
  height: 1px;
  background: var(--border, #1e2330);
  margin: 8px 0;
}

/* Color swatches */
.color-swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}
.swatch {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.1s;
}
/* Desktop hover: swatch sedikit lebih besar saat hover */
.swatch:hover  { transform: scale(1.2); border-color: rgba(255,255,255,0.4); }
.swatch.active { border-color: #fff; transform: scale(1.15); }

/* Touch (non-mobile override — handled by max-width 480px above) */
@media (hover: none) and (min-width: 481px) {
  .swatch { width: 36px; height: 36px; border-radius: 8px; }
}

.color-custom {
  width: 100%;
  height: 36px;
  border-radius: 6px;
  border: 1px solid var(--border, #1e2330);
  background: transparent;
  cursor: pointer;
}

.popup-close-btn {
  width: 100%;
  margin-top: 4px;
  padding: 10px;
  min-height: 44px;
  border-radius: 6px;
  background: rgba(255,255,255,0.05);
  border: none;
  color: var(--text2, #9ca3af);
  font-size: 0.8rem;
  cursor: pointer;
  transition: background 0.15s;
}
.popup-close-btn:hover { background: rgba(255,255,255,0.12); }
</style>
