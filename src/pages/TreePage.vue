<template>
  <div class="tree-page">
    <!-- Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">🌳 Tree Diagram</h1>
        <p class="page-sub">Klik = expand/collapse · Klik kanan = edit nama & warna · Hover = tombol +/×</p>
      </div>
      <div class="view-switch" role="tablist" aria-label="Tampilan Tree">
        <button :class="['view-mode-btn', { active: viewMode === 'explorer' }]" type="button" @click="viewMode = 'explorer'">☷ Explorer</button>
        <button :class="['view-mode-btn', { active: viewMode === 'map' }]" type="button" @click="setMapMode">⌘ Map</button>
      </div>
      <div class="header-actions">
        <!-- Import JSON -->
        <label class="btn btn-ghost" title="Import JSON">
          <span>📂 Import</span>
          <input type="file" accept=".json" style="display:none" @change="handleImport" />
        </label>
        <!-- Export JSON -->
        <button class="btn btn-ghost" @click="treeStore.exportJSON()" title="Export JSON">💾 Export</button>
        <!-- Export PNG -->
        <button class="btn btn-ghost" @click="exportPNG" title="Export PNG">🖼️ PNG</button>

        <!-- Sheets Load -->
        <button
          class="btn btn-sheets"
          :disabled="sheetsLoading"
          @click="handleLoadSheets"
          title="Load dari Google Sheets"
        >
          <span v-if="treeStore.sheetsStatus === 'loading'">⏳ Loading...</span>
          <span v-else>☁️ Load</span>
        </button>

        <!-- Sheets Save -->
        <button
          class="btn btn-sheets-save"
          :disabled="sheetsSaving"
          @click="handleSaveSheets"
          title="Save ke Google Sheets"
        >
          <span v-if="treeStore.sheetsStatus === 'saving'">⏳ Saving...</span>
          <span v-else>☁️ Save</span>
        </button>

        <!-- Fit View -->
        <button class="btn btn-ghost" @click="diagram?.fitView()" title="Fit to screen">⊡ Fit</button>
      </div>
    </div>

    <!-- Mobile app actions: separate from map navigation -->
    <div class="mobile-tree-actions" aria-label="Aksi Tree">
      <label class="btn btn-ghost mobile-action-btn" title="Import JSON">
        <span>📂 Import</span>
        <input type="file" accept=".json" style="display:none" @change="handleImport" />
      </label>
      <button class="btn btn-ghost mobile-action-btn" type="button" @click="treeStore.exportJSON()" title="Export JSON">💾 Export</button>
      <button class="btn btn-ghost mobile-action-btn" type="button" @click="exportPNG" title="Export PNG">🖼️ PNG</button>
      <button class="btn btn-sheets mobile-action-btn" type="button" :disabled="sheetsLoading" @click="handleLoadSheets" title="Load dari Google Sheets">
        <span v-if="treeStore.sheetsStatus === 'loading'">⏳ Loading...</span>
        <span v-else>☁️ Load</span>
      </button>
      <button class="btn btn-sheets-save mobile-action-btn" type="button" :disabled="sheetsSaving" @click="handleSaveSheets" title="Save ke Google Sheets">
        <span v-if="treeStore.sheetsStatus === 'saving'">⏳ Saving...</span>
        <span v-else>☁️ Save</span>
      </button>
    </div>

    <!-- Shortcuts -->
    <div class="shortcuts">
      <span>🖱️ <b>Click</b> = expand/collapse</span>
      <span>🖱️ <b>Klik kanan</b> = edit nama & warna</span>
      <span>➕ <b>Hover</b> = tampil tombol +/×</span>
      <span>🔍 <b>Scroll</b> = zoom</span>
      <span>✋ <b>Drag</b> = pan</span>
    </div>

    <!-- Notification -->
    <div v-if="notif.show" :class="['notif', notif.type]">
      {{ notif.msg }}
    </div>

    <!-- Auto-load status -->
    <div v-if="autoLoadStatus" class="notif" :class="autoLoadStatus.type">
      {{ autoLoadStatus.msg }}
    </div>

    <!-- Tree views: same data, two presentations -->
    <div :class="['tree-canvas', 'map-view', { 'map-active': viewMode === 'map' }]">
      <div class="map-shell">
        <div class="map-nav" aria-label="Navigasi peta">
          <button class="btn btn-ghost map-fit-btn" type="button" @click="diagram?.fitView()" title="Fit to screen">⊡ Fit</button>
        </div>
        <TreeDiagram ref="diagram" />
      </div>
    </div>

    <div :class="['tree-explorer-view', { 'explorer-active': viewMode === 'explorer' }]">
      <TreeExplorer
        @map="setMapMode"
        @notify="showNotif"
      />
    </div>

    <!-- Bottom bar -->
    <div class="bottom-bar">
      <div class="stat-chips">
        <span class="chip">📦 {{ totalNodes }} nodes</span>
        <span class="chip">🔗 {{ totalLinks }} links</span>
        <!-- Sheets status chip -->
        <span
          v-if="treeStore.sheetsStatus !== 'idle'"
          :class="['chip', 'chip-sheets', treeStore.sheetsStatus]"
        >
          {{ treeStore.sheetsMsg }}
        </span>
        <!-- Auto-save indicator -->
        <span v-if="autoSaveIndicator" class="chip chip-autosave">
          {{ autoSaveIndicator }}
        </span>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn-sm" @click="addRootChild">+ Tambah Node Utama</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useTreeStore } from '@/stores/tree'
import TreeDiagram from '@/components/TreeDiagram.vue'
import TreeExplorer from '@/components/TreeExplorer.vue'

const treeStore = useTreeStore()
const diagram   = ref(null)
const viewMode = ref('map')

const notif = ref({ show: false, msg: '', type: 'success' })
const autoLoadStatus  = ref(null)
const autoSaveIndicator = ref('')
let notifTimer = null

function showNotif(msg, type = 'success') {
  clearTimeout(notifTimer)
  notif.value = { show: true, msg, type }
  notifTimer = setTimeout(() => { notif.value.show = false }, 3500)
}

function setMapMode() {
  viewMode.value = 'map'
  $nextTick(() => diagram.value?.fitView())
}

// Watch sheetsStatus untuk update auto-save indicator di bottom bar
watch(
  () => treeStore.sheetsStatus,
  (status) => {
    if (status === 'saving') {
      autoSaveIndicator.value = '💾 Saving...'
    } else if (status === 'ok') {
      autoSaveIndicator.value = '✅ Saved'
      setTimeout(() => { autoSaveIndicator.value = '' }, 3000)
    } else if (status === 'error') {
      autoSaveIndicator.value = '❌ Save gagal'
    } else {
      autoSaveIndicator.value = ''
    }
  }
)

// ── Auto-load saat halaman dibuka ───────────────
onMounted(async () => {
  autoLoadStatus.value = { msg: '☁️ Memuat tree dari Google Sheets...', type: 'warning' }
  const result = await treeStore.loadFromSheets()
  if (result.ok && !result.empty) {
    autoLoadStatus.value = { msg: '✅ Tree berhasil dimuat dari Google Sheets', type: 'success' }
    setTimeout(() => {
      autoLoadStatus.value = null
      diagram.value?.fitView()
    }, 2000)
  } else if (result.ok && result.empty) {
    autoLoadStatus.value = null
    setTimeout(() => diagram.value?.fitView(), 300)
  } else {
    autoLoadStatus.value = null
    setTimeout(() => diagram.value?.fitView(), 300)
  }
})

// Count nodes/links recursively
function countNodes(node) {
  if (!node) return 0
  let count = 1
  if (node.children) count += node.children.reduce((s, c) => s + countNodes(c), 0)
  return count
}
function countLinks(node) {
  if (!node || !node.children) return 0
  return node.children.length + node.children.reduce((s, c) => s + countLinks(c), 0)
}

const totalNodes = computed(() => countNodes(treeStore.tree))
const totalLinks = computed(() => countLinks(treeStore.tree))

const sheetsLoading = computed(() => treeStore.sheetsStatus === 'loading')
const sheetsSaving  = computed(() => treeStore.sheetsStatus === 'saving')

function addRootChild() {
  treeStore.addChild('root')
  showNotif('Node baru ditambahkan ke root')
}

async function handleImport(e) {
  const file = e.target.files[0]
  if (!file) return
  const text = await file.text()
  const result = treeStore.importJSON(text)
  if (result.ok) {
    showNotif(`✅ Import berhasil: ${file.name}`)
    setTimeout(() => diagram.value?.fitView(), 300)
  } else {
    showNotif(`❌ Gagal import: ${result.error}`, 'error')
  }
  e.target.value = ''
}

async function handleSaveSheets() {
  const result = await treeStore.saveToSheets()
  if (result.ok) {
    showNotif('✅ Tree tersimpan ke Google Sheets')
  } else {
    showNotif(`❌ Gagal save: ${result.error}`, 'error')
  }
}

async function handleLoadSheets() {
  const result = await treeStore.loadFromSheets()
  if (result.ok) {
    if (result.empty) {
      showNotif('⚠️ Sheet tree_nodes masih kosong', 'warning')
    } else {
      showNotif('✅ Tree dimuat dari Google Sheets')
      setTimeout(() => diagram.value?.fitView(), 300)
    }
  } else {
    showNotif(`❌ Gagal load: ${result.error}`, 'error')
  }
}

function exportPNG() {
  try {
    const svgEl = document.querySelector('.tree-svg')
    if (!svgEl) return
    const serializer = new XMLSerializer()
    const svgStr = serializer.serializeToString(svgEl)
    const canvas = document.createElement('canvas')
    const rect = svgEl.getBoundingClientRect()
    canvas.width  = rect.width  * 2
    canvas.height = rect.height * 2
    const ctx = canvas.getContext('2d')
    ctx.scale(2, 2)
    ctx.fillStyle = '#0f1117'
    ctx.fillRect(0, 0, rect.width, rect.height)
    const img = new Image()
    const blob = new Blob([svgStr], { type: 'image/svg+xml' })
    const url  = URL.createObjectURL(blob)
    img.onload = () => {
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      const a = document.createElement('a')
      a.href = canvas.toDataURL('image/png')
      a.download = `tree-diagram-${Date.now()}.png`
      a.click()
      showNotif('✅ Export PNG berhasil')
    }
    img.src = url
  } catch(err) {
    showNotif('❌ Gagal export PNG', 'error')
  }
}
</script>

<style scoped>
.tree-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 60px);
  gap: 12px;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}
.page-title { font-size: 1.3rem; font-weight: 800; margin-bottom: 2px; }
.page-sub   { font-size: 0.75rem; color: var(--muted); }

.header-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.btn {
  padding: 7px 14px;
  border-radius: var(--radius, 8px);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  gap: 6px;
}
.btn-ghost {
  background: var(--surface, #1a2035);
  color: var(--text2, #9ca3af);
  border: 1px solid var(--border, #1e2330);
}
.btn-ghost:hover { background: var(--surface2, #1e2844); color: var(--text, #e2e8f0); }

.btn-sheets {
  background: rgba(16,185,129,0.1);
  color: #10b981;
  border: 1px solid rgba(16,185,129,0.25);
}
.btn-sheets:hover:not(:disabled) { background: rgba(16,185,129,0.2); }
.btn-sheets:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-sheets-save {
  background: rgba(59,130,246,0.1);
  color: #3b82f6;
  border: 1px solid rgba(59,130,246,0.25);
}
.btn-sheets-save:hover:not(:disabled) { background: rgba(59,130,246,0.2); }
.btn-sheets-save:disabled { opacity: 0.5; cursor: not-allowed; }

.shortcuts {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  font-size: 0.7rem;
  color: var(--muted, #6b7280);
  background: var(--surface, #1a2035);
  border: 1px solid var(--border, #1e2330);
  border-radius: var(--radius, 8px);
  padding: 8px 14px;
}
.shortcuts b { color: var(--text2, #9ca3af); }

.notif {
  padding: 9px 14px;
  border-radius: var(--radius, 8px);
  font-size: 0.8rem;
  font-weight: 600;
  animation: fadeIn 0.2s ease;
}
.notif.success { background: rgba(16,185,129,0.15); color: #10b981; border: 1px solid rgba(16,185,129,0.25); }
.notif.error   { background: rgba(239,68,68,0.15);  color: #ef4444; border: 1px solid rgba(239,68,68,0.25); }
.notif.warning { background: rgba(245,158,11,0.15); color: #f59e0b; border: 1px solid rgba(245,158,11,0.25); }

.tree-canvas {
  flex: 1;
  min-height: 0;
  border-radius: 10px;
  overflow: hidden;
}

.bottom-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  background: var(--surface, #1a2035);
  border: 1px solid var(--border, #1e2330);
  border-radius: var(--radius, 8px);
  flex-wrap: wrap;
  gap: 8px;
}
.stat-chips { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.chip {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 99px;
  background: var(--surface2, #1e2844);
  color: var(--text2, #9ca3af);
  font-family: var(--font-mono, monospace);
}
.chip-sheets.ok      { background: rgba(16,185,129,0.12); color: #10b981; }
.chip-sheets.error   { background: rgba(239,68,68,0.12);  color: #ef4444; }
.chip-sheets.loading,
.chip-sheets.saving  { background: rgba(245,158,11,0.12); color: #f59e0b; }
.chip-autosave       { background: rgba(99,102,241,0.12); color: #818cf8; }

.btn-sm {
  padding: 6px 12px;
  border-radius: var(--radius, 8px);
  font-size: 0.75rem;
  font-weight: 600;
  background: var(--accent-glow, rgba(59,130,246,0.12));
  color: var(--accent, #3b82f6);
  border: 1px solid rgba(59,130,246,0.2);
  cursor: pointer;
  transition: all 0.15s;
}
.btn-sm:hover { background: rgba(59,130,246,0.22); }

@keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }


 .view-switch {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  background: var(--surface, #1a2035);
  border: 1px solid var(--border, #1e2330);
  border-radius: 10px;
  flex-shrink: 0;
}
.view-mode-btn {
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--text2);
  font-size: .72rem;
  font-weight: 800;
  cursor: pointer;
}
.view-mode-btn.active {
  background: var(--accent-glow);
  color: var(--accent);
  border-color: rgba(59,130,246,.22);
}
.tree-canvas, .tree-explorer-view { flex: 1; min-height: 0; min-width: 0; }
.mobile-tree-actions { display: none; }
.map-shell { width: 100%; height: 100%; min-height: 0; position: relative; }
.map-nav { display: none; }
.map-view { display: none; }
.map-view.map-active { display: block; }
.tree-explorer-view { display: none; overflow: hidden; }
.tree-explorer-view.explorer-active { display: block; }

@media (max-width: 768px) {
  .tree-page { height: calc(100vh - 76px); gap: 8px; min-width: 0; }
  .page-header { flex-direction: row; align-items: center; gap: 8px; }
  .page-title { font-size: 1.05rem; }
  .page-sub { display: none; }
  .header-actions, .shortcuts, .bottom-bar { display: none; }
  .view-switch { flex: 1; }

  .mobile-tree-actions {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
    padding: 6px;
    background: var(--surface, #1a2035);
    border: 1px solid var(--border, #1e2330);
    border-radius: 10px;
    flex-shrink: 0;
  }
  .mobile-action-btn {
    min-width: 0;
    min-height: 36px;
    justify-content: center;
    padding: 6px 4px;
    font-size: .68rem;
    white-space: nowrap;
  }
  .mobile-action-btn:disabled { opacity: .5; cursor: not-allowed; }

  .map-view.map-active {
    display: block;
    min-height: 0;
    padding: 0 8px 10px;
    box-sizing: border-box;
  }
  .map-shell {
    border: 1px solid var(--border, #1e2330);
    border-radius: 12px;
    overflow: hidden;
    background: var(--bg, #080c15);
  }
  .map-nav {
    display: flex;
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 10;
    padding: 3px;
    border: 1px solid var(--border, #1e2330);
    border-radius: 9px;
    background: rgba(15,17,23,.88);
    backdrop-filter: blur(6px);
  }
  .map-fit-btn {
    min-height: 32px;
    padding: 5px 9px;
    font-size: .68rem;
  }
  .view-mode-btn { flex: 1; min-height: 38px; }
  .map-view { display: none; }
  .map-view.map-active { display: block; }
  .tree-explorer-view { display: none; }
  .tree-explorer-view.explorer-active { display: block; }
}

@media (max-width: 600px) {
  .page-header { flex-direction: row; }
  .view-switch { width: 100%; }
  .shortcuts { display: none; }
}
</style>