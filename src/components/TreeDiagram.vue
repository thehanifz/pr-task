<template>
  <div class="tree-wrap" ref="wrapRef">
    <svg ref="svgRef" class="tree-svg">
      <g ref="gRef" />
    </svg>

    <!-- Color Picker Popup -->
    <div v-if="colorPicker.show" class="color-popup" :style="{ top: colorPicker.y + 'px', left: colorPicker.x + 'px' }">
      <div class="color-popup-title">Node Color</div>
      <div class="color-swatches">
        <button v-for="c in swatches" :key="c" class="swatch" :style="{ background: c }" @click="applyColor(c)" />
      </div>
      <input type="color" class="color-custom" :value="colorPicker.current" @input="applyColor($event.target.value)" />
      <button class="color-close" @click="colorPicker.show = false">✕ Tutup</button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, reactive, nextTick } from 'vue'
import * as d3 from 'd3'
import { useTreeStore } from '@/stores/tree'

const store = useTreeStore()
const svgRef = ref(null)
const gRef   = ref(null)
const wrapRef = ref(null)

const colorPicker = reactive({ show: false, nodeId: null, current: '#3b82f6', x: 0, y: 0 })

const swatches = [
  '#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6',
  '#ec4899','#06b6d4','#84cc16','#f97316','#6366f1',
  '#14b8a6','#a855f7','#e11d48','#0ea5e9','#ffffff'
]

const NODE_W  = 140
const NODE_H  = 36
const NODE_RX = 8

let svg, g, zoom

function buildD3Tree(data) {
  // flatten collapsed subtrees
  function clone(node) {
    const n = { ...node, _children: node.children || [] }
    n.children = node.collapsed ? null : (node.children || []).map(clone)
    return n
  }
  return clone(data)
}

function render() {
  if (!svgRef.value || !gRef.value) return
  const root = d3.hierarchy(buildD3Tree(store.tree), d => d.children)

  const treeLayout = d3.tree().nodeSize([NODE_H + 14, NODE_W + 60])
  treeLayout(root)

  const nodes = root.descendants()
  const links = root.links()

  const svgEl = d3.select(svgRef.value)
  const gEl   = d3.select(gRef.value)

  // Clear
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
    .text(d => d.data.name.length > 16 ? d.data.name.slice(0, 15) + '…' : d.data.name)

  // Collapse indicator (dot at right edge)
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
    .text(d => d.data.collapsed ? '+' : '−')

  // Add child button (+)
  const addBtn = nodeG.append('g')
    .attr('class', 'add-btn')
    .attr('transform', `translate(${NODE_W / 2 + 18}, 0)`)
    .style('opacity', 0)

  addBtn.append('circle')
    .attr('r', 9)
    .attr('fill', 'rgba(255,255,255,0.08)')
    .attr('stroke', 'rgba(255,255,255,0.2)')
    .attr('stroke-width', 1)

  addBtn.append('text')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'central')
    .attr('fill', 'rgba(255,255,255,0.7)')
    .attr('font-size', '14px')
    .attr('pointer-events', 'none')
    .text('+')

  addBtn.on('click', (event, d) => {
    event.stopPropagation()
    store.addChild(d.data.id)
  })

  // Delete button (×) — not for root
  const delBtn = nodeG.filter(d => d.data.id !== 'root')
    .append('g')
    .attr('class', 'del-btn')
    .attr('transform', `translate(${-NODE_W / 2 - 18}, 0)`)
    .style('opacity', 0)

  delBtn.append('circle')
    .attr('r', 9)
    .attr('fill', 'rgba(239,68,68,0.15)')
    .attr('stroke', 'rgba(239,68,68,0.4)')
    .attr('stroke-width', 1)

  delBtn.append('text')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'central')
    .attr('fill', '#ef4444')
    .attr('font-size', '12px')
    .attr('pointer-events', 'none')
    .text('×')

  delBtn.on('click', (event, d) => {
    event.stopPropagation()
    if (confirm(`Hapus node "${d.data.name}" beserta semua anaknya?`)) {
      store.deleteNode(d.data.id)
    }
  })

  // Hover show/hide buttons
  nodeG
    .on('mouseenter', function() {
      d3.select(this).select('.add-btn').style('opacity', 1)
      d3.select(this).select('.del-btn').style('opacity', 1)
    })
    .on('mouseleave', function() {
      d3.select(this).select('.add-btn').style('opacity', 0)
      d3.select(this).select('.del-btn').style('opacity', 0)
    })

  // Click = toggle collapse
  nodeG.on('click', (event, d) => {
    if (d.data._children && d.data._children.length > 0) {
      store.toggleCollapse(d.data.id)
    }
  })

  // Right-click = color picker
  nodeG.on('contextmenu', (event, d) => {
    event.preventDefault()
    const rect = wrapRef.value.getBoundingClientRect()
    colorPicker.show   = true
    colorPicker.nodeId = d.data.id
    colorPicker.current = d.data.color || '#3b82f6'
    colorPicker.x = event.clientX - rect.left
    colorPicker.y = event.clientY - rect.top
  })

  // Double-click = rename
  nodeG.on('dblclick', (event, d) => {
    event.stopPropagation()
    const newName = prompt('Rename node:', d.data.name)
    if (newName && newName.trim()) {
      store.updateNodeName(d.data.id, newName.trim())
    }
  })
}

function applyColor(color) {
  colorPicker.current = color
  if (colorPicker.nodeId) {
    store.updateNodeColor(colorPicker.nodeId, color)
  }
}

function fitView() {
  if (!svgRef.value || !gRef.value || !zoom) return
  const svgEl = d3.select(svgRef.value)
  const gEl   = d3.select(gRef.value)
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

  // Close color picker on outside click
  document.addEventListener('click', () => { colorPicker.show = false })
})

onUnmounted(() => {
  document.removeEventListener('click', () => { colorPicker.show = false })
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
.color-popup {
  position: absolute;
  z-index: 200;
  background: var(--bg2, #161b2e);
  border: 1px solid var(--border, #1e2330);
  border-radius: 10px;
  padding: 12px;
  min-width: 190px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}
.color-popup-title {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--muted, #6b7280);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 8px;
}
.color-swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}
.swatch {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.1s;
}
.swatch:hover { transform: scale(1.2); border-color: rgba(255,255,255,0.4); }
.color-custom {
  width: 100%;
  height: 32px;
  border-radius: 6px;
  border: 1px solid var(--border, #1e2330);
  background: transparent;
  cursor: pointer;
  margin-bottom: 8px;
}
.color-close {
  width: 100%;
  padding: 5px;
  border-radius: 6px;
  background: rgba(255,255,255,0.06);
  border: none;
  color: var(--text2, #9ca3af);
  font-size: 0.75rem;
  cursor: pointer;
}
.color-close:hover { background: rgba(255,255,255,0.12); }
</style>
