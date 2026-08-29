<template>
  <section class="tree-explorer" aria-label="Tree Explorer">
    <div class="explorer-search">
      <span class="search-icon">🔍</span>
      <input
        v-model="searchQuery"
        type="search"
        placeholder="Cari node..."
        autocomplete="off"
        @keydown.esc="searchQuery = ''"
      />
      <button v-if="searchQuery" type="button" class="search-clear" aria-label="Hapus pencarian" @click="searchQuery = ''">×</button>
    </div>

    <div v-if="!searchQuery.trim()" class="desktop-explorer">
      <aside class="desktop-tree-pane" aria-label="Navigasi hierarchy">
        <div class="desktop-pane-head">
          <div>
            <div class="desktop-pane-kicker">HIERARCHY</div>
            <strong>Semua Node</strong>
          </div>
          <span class="desktop-node-count">{{ flatNodes.length }}</span>
        </div>
        <div class="desktop-tree-list">
          <button
            v-for="item in flatNodes"
            :key="item.node.id"
            type="button"
            :class="['desktop-tree-item', { active: item.node.id === currentNode?.id }]"
            :style="{ '--depth': item.depth, '--node-color': item.node.color || '#3b82f6' }"
            @click="selectDesktopNode(item.node)"
          >
            <span class="desktop-tree-rail" />
            <span class="desktop-tree-dot" />
            <span class="desktop-tree-copy">
              <strong>{{ item.node.name }}</strong>
              <small>{{ item.childCount }} {{ item.childCount === 1 ? 'child' : 'children' }}</small>
            </span>
            <span v-if="item.node.id === currentNode?.id" class="desktop-tree-current">●</span>
          </button>
        </div>
      </aside>

      <main class="desktop-detail-pane">
        <div class="desktop-detail-head">
          <div class="explorer-breadcrumb">
            <button
              v-if="breadcrumb.length > 1"
              type="button"
              class="back-btn"
              aria-label="Kembali ke parent"
              @click="goToParent"
            >‹</button>
            <div class="breadcrumb-scroll">
              <button
                v-for="(item, index) in breadcrumb"
                :key="item.id"
                type="button"
                :class="['crumb', { current: index === breadcrumb.length - 1 }]"
                @click="goToNode(item.id)"
              >
                {{ item.name }}
              </button>
            </div>
          </div>

          <div class="current-node">
            <div class="current-node-icon" :style="{ color: currentNode?.color || '#3b82f6', borderColor: currentNode?.color || '#3b82f6' }">🌳</div>
            <div class="current-node-copy">
              <div class="current-node-name">{{ currentNode?.name || 'Tree' }}</div>
              <div class="current-node-meta">{{ childCount }} {{ childCount === 1 ? 'child' : 'children' }}</div>
            </div>
            <button type="button" class="current-action" aria-label="Aksi node" @click="openActions(currentNode)">⋮</button>
          </div>
        </div>

        <div class="desktop-detail-content">
          <div class="desktop-section-head">
            <div>
              <div class="desktop-pane-kicker">CHILDREN</div>
              <strong>Node di bawah {{ currentNode?.name || 'Tree' }}</strong>
            </div>
            <span>{{ childCount }}</span>
          </div>

          <div class="child-list desktop-child-list">
            <div v-if="!children.length" class="empty-state empty-state-card">
              <div class="empty-icon">📭</div>
              <strong>Belum ada child</strong>
              <span>Tambahkan node pertama di bawah {{ currentNode?.name }}.</span>
            </div>

            <article
              v-for="child in children"
              :key="child.id"
              class="node-card"
              :style="{ '--node-color': child.color || '#3b82f6' }"
            >
              <button type="button" class="node-open" @click="openNode(child)">
                <span class="node-color-dot" />
                <span class="node-copy">
                  <strong>{{ child.name }}</strong>
                  <small>{{ countDescendants(child) }} {{ countDescendants(child) === 1 ? 'child' : 'children' }}</small>
                </span>
                <span v-if="hasChildren(child)" class="node-chevron">›</span>
                <span v-else class="node-leaf">•</span>
              </button>
              <button type="button" class="node-more" aria-label="Aksi node" @click.stop="openActions(child)">⋮</button>
            </article>
          </div>
        </div>

        <div class="explorer-footer desktop-detail-footer">
          <button type="button" class="add-node-btn" @click="addChildToCurrent">＋ Tambah Node</button>
          <button type="button" class="map-btn" @click="$emit('map')">⌘ Buka Map</button>
        </div>
      </main>
    </div>

    <div v-if="searchQuery.trim()" class="search-results">
      <div class="section-label">Hasil pencarian · {{ searchResults.length }}</div>
      <button
        v-for="result in searchResults"
        :key="result.node.id"
        type="button"
        class="search-result"
        @click="openSearchResult(result)"
      >
        <span class="result-dot" :style="{ background: result.node.color || '#3b82f6' }" />
        <span class="result-copy">
          <strong>{{ result.node.name }}</strong>
          <small>{{ result.path }}</small>
        </span>
        <span class="result-arrow">›</span>
      </button>
      <div v-if="!searchResults.length" class="empty-state">Node tidak ditemukan.</div>
    </div>

    <template v-else>
      <div class="explorer-mobile-layout">
      <div class="explorer-breadcrumb">
        <button
          v-if="breadcrumb.length > 1"
          type="button"
          class="back-btn"
          aria-label="Kembali ke parent"
          @click="goToParent"
        >‹</button>
        <div class="breadcrumb-scroll">
          <button
            v-for="(item, index) in breadcrumb"
            :key="item.id"
            type="button"
            :class="['crumb', { current: index === breadcrumb.length - 1 }]"
            @click="goToNode(item.id)"
          >
            {{ item.name }}
          </button>
        </div>
      </div>

      <div class="current-node">
        <div class="current-node-icon" :style="{ color: currentNode?.color || '#3b82f6', borderColor: currentNode?.color || '#3b82f6' }">🌳</div>
        <div class="current-node-copy">
          <div class="current-node-name">{{ currentNode?.name || 'Tree' }}</div>
          <div class="current-node-meta">{{ childCount }} {{ childCount === 1 ? 'child' : 'children' }}</div>
        </div>
        <button type="button" class="current-action" aria-label="Aksi node" @click="openActions(currentNode)">⋮</button>
      </div>

      <div class="child-list">
        <div v-if="!children.length" class="empty-state empty-state-card">
          <div class="empty-icon">📭</div>
          <strong>Belum ada child</strong>
          <span>Tambahkan node pertama di bawah {{ currentNode?.name }}.</span>
        </div>

        <article
          v-for="child in children"
          :key="child.id"
          class="node-card"
          :style="{ '--node-color': child.color || '#3b82f6' }"
        >
          <button type="button" class="node-open" @click="openNode(child)">
            <span class="node-color-dot" />
            <span class="node-copy">
              <strong>{{ child.name }}</strong>
              <small>{{ countDescendants(child) }} {{ countDescendants(child) === 1 ? 'child' : 'children' }}</small>
            </span>
            <span v-if="hasChildren(child)" class="node-chevron">›</span>
            <span v-else class="node-leaf">•</span>
          </button>
          <button type="button" class="node-more" aria-label="Aksi node" @click.stop="openActions(child)">⋮</button>
        </article>
      </div>

      <div class="explorer-footer">
        <button type="button" class="add-node-btn" @click="addChildToCurrent">＋ Tambah Node</button>
        <button type="button" class="map-btn" @click="$emit('map')">⌘ Buka Map</button>
      </div>
      </div>
    </template>

    <Transition name="sheet">
      <div v-if="actions.show" class="sheet-backdrop" @click.self="closeActions">
        <section class="action-sheet" role="dialog" aria-modal="true" :aria-label="`Aksi ${actions.node?.name || 'node'}`">
          <div class="sheet-handle" />
          <div class="sheet-head">
            <div>
              <div class="sheet-kicker">NODE</div>
              <h2>{{ actions.node?.name }}</h2>
            </div>
            <button type="button" class="sheet-close" aria-label="Tutup" @click="closeActions">×</button>
          </div>

          <div class="sheet-actions">
            <button type="button" class="sheet-action" @click="startRename">
              <span>✏️</span><span>Edit Nama</span>
            </button>
            <button type="button" class="sheet-action" @click="addChildFromActions">
              <span>＋</span><span>Tambah Child</span>
            </button>
            <button v-if="hasChildren(actions.node)" type="button" class="sheet-action" @click="openNodeFromActions">
              <span>📂</span><span>Buka Children</span>
            </button>
            <button v-if="actions.node?.id !== 'root'" type="button" class="sheet-action danger" @click="removeNode">
              <span>🗑️</span><span>Hapus Node</span>
            </button>
          </div>

          <div class="sheet-section">
            <div class="sheet-label">Warna Node</div>
            <div class="color-swatches">
              <button
                v-for="color in swatches"
                :key="color"
                type="button"
                :class="['color-swatch', { active: actions.color === color }]"
                :style="{ background: color }"
                :aria-label="`Pilih warna ${color}`"
                @click="setColor(color)"
              />
            </div>
            <input class="color-picker" type="color" :value="actions.color" aria-label="Warna custom" @input="setColor($event.target.value)" />
          </div>

          <div v-if="actions.renaming" class="rename-panel">
            <label class="sheet-label" for="tree-node-name">Nama</label>
            <div class="rename-row">
              <input id="tree-node-name" ref="renameInput" v-model="actions.name" maxlength="40" autocomplete="off" @keydown.enter="applyRename" @keydown.esc="actions.renaming = false" />
              <button type="button" @click="applyRename">Simpan</button>
            </div>
          </div>
        </section>
      </div>
    </Transition>
  </section>
</template>

<script setup>
import { computed, nextTick, reactive, ref } from 'vue'
import { useTreeStore } from '@/stores/tree'

const emit = defineEmits(['map', 'notify'])
const store = useTreeStore()
const searchQuery = ref('')
const renameInput = ref(null)
const currentNodeId = ref('root')

const swatches = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1', '#14b8a6', '#a855f7', '#e11d48', '#0ea5e9', '#ffffff']

const actions = reactive({ show: false, node: null, name: '', color: '#3b82f6', renaming: false })

function walk(node, callback, path = []) {
  if (!node) return
  const nextPath = [...path, node]
  callback(node, nextPath)
  ;(node.children || []).forEach(child => walk(child, callback, nextPath))
}

function findNode(node, id) {
  if (!node) return null
  if (node.id === id) return node
  for (const child of node.children || []) {
    const found = findNode(child, id)
    if (found) return found
  }
  return null
}

function findPath(node, id, path = []) {
  if (!node) return null
  const next = [...path, node]
  if (node.id === id) return next
  for (const child of node.children || []) {
    const found = findPath(child, id, next)
    if (found) return found
  }
  return null
}

const currentNode = computed(() => findNode(store.tree, currentNodeId.value) || store.tree)
const children = computed(() => currentNode.value?.children || [])
const childCount = computed(() => children.value.length)
const breadcrumb = computed(() => findPath(store.tree, currentNode.value?.id) || [store.tree])

const flatNodes = computed(() => {
  const result = []
  walk(store.tree, (node, path) => {
    result.push({
      node,
      depth: Math.max(0, path.length - 1),
      childCount: node.children?.length || 0,
    })
  })
  return result
})

const searchResults = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return []
  const results = []
  walk(store.tree, (node, path) => {
    if (node.name?.toLowerCase().includes(query)) {
      results.push({ node, path: path.map(item => item.name).join(' › ') })
    }
  })
  return results.slice(0, 30)
})

function hasChildren(node) {
  return !!node?.children?.length
}

function countDescendants(node) {
  if (!node) return 0
  return (node.children || []).reduce((sum, child) => sum + 1 + countDescendants(child), 0)
}

function openNode(node) {
  if (hasChildren(node)) {
    currentNodeId.value = node.id
    return
  }
  openActions(node)
}

function openSearchResult(result) {
  if (hasChildren(result.node)) {
    currentNodeId.value = result.node.id
  } else {
    const parent = findPath(store.tree, result.node.id)?.at(-2)
    currentNodeId.value = parent?.id || 'root'
  }
  searchQuery.value = ''
}

function goToNode(id) {
  currentNodeId.value = id
}

function selectDesktopNode(node) {
  if (!node) return
  currentNodeId.value = node.id
}

function goToParent() {
  if (breadcrumb.value.length > 1) currentNodeId.value = breadcrumb.value.at(-2).id
}

function openActions(node) {
  if (!node) return
  actions.show = true
  actions.node = node
  actions.name = node.name || ''
  actions.color = node.color || '#3b82f6'
  actions.renaming = false
}

function closeActions() {
  actions.show = false
  actions.renaming = false
}

function startRename() {
  actions.renaming = true
  nextTick(() => {
    renameInput.value?.focus()
    renameInput.value?.select()
  })
}

function applyRename() {
  const name = actions.name.trim()
  if (!name || !actions.node) return
  store.updateNodeName(actions.node.id, name)
  actions.node.name = name
  actions.renaming = false
  emit('notify', '✅ Nama node diperbarui')
}

function setColor(color) {
  actions.color = color
  if (actions.node) store.updateNodeColor(actions.node.id, color)
}

function addChildToCurrent() {
  if (!currentNode.value) return
  store.addChild(currentNode.value.id)
  emit('notify', `✅ Node baru ditambahkan ke ${currentNode.value.name}`)
}

function addChildFromActions() {
  if (!actions.node) return
  const parentId = actions.node.id
  const parentName = actions.node.name
  store.addChild(parentId)
  currentNodeId.value = parentId
  closeActions()
  emit('notify', `✅ Node baru ditambahkan ke ${parentName}`)
}

function openNodeFromActions() {
  if (!actions.node) return
  currentNodeId.value = actions.node.id
  closeActions()
}

function removeNode() {
  if (!actions.node || actions.node.id === 'root') return
  const nodeName = actions.node.name
  if (!confirm(`Hapus node "${nodeName}" beserta semua anaknya?`)) return
  const parent = findPath(store.tree, actions.node.id)?.at(-2)
  store.deleteNode(actions.node.id)
  currentNodeId.value = parent?.id || 'root'
  closeActions()
  emit('notify', `🗑️ ${nodeName} dihapus`)
}
</script>

<style scoped>
.tree-explorer { display:flex; flex-direction:column; height:100%; min-height:0; position:relative; }
.tree-explorer .desktop-explorer { display:none; }
.tree-explorer .explorer-mobile-layout { display:flex; flex-direction:column; flex:1; min-height:0; }
.tree-explorer .explorer-search { display:flex; align-items:center; gap:8px; background:var(--surface,#111827); border:1px solid var(--border,#1e2d45); border-radius:12px; padding:0 11px; min-height:44px; flex-shrink:0; }
.tree-explorer .search-icon { font-size:.9rem; opacity:.8; }
.tree-explorer .explorer-search input { flex:1; min-width:0; border:0; outline:0; background:transparent; color:var(--text,#e2e8f0); font-size:16px; }
.tree-explorer .explorer-search input::placeholder { color:var(--muted,#4a5568); }
.tree-explorer .search-clear { border:0; background:transparent; color:var(--text2,#94a3b8); font-size:1.2rem; width:32px; height:32px; }
.tree-explorer .search-results { overflow:auto; padding:10px 0 16px; }
.tree-explorer .section-label,.tree-explorer .sheet-label { color:var(--muted,#64748b); font:600 .64rem var(--font-mono,monospace); text-transform:uppercase; letter-spacing:.08em; margin:2px 4px 8px; }
.tree-explorer .search-result { width:100%; display:flex; align-items:center; gap:10px; text-align:left; padding:12px 8px; background:transparent; border:0; color:var(--text); border-bottom:1px solid rgba(255,255,255,.05); }
.tree-explorer .result-dot { width:9px; height:9px; border-radius:50%; flex-shrink:0; }
.tree-explorer .result-copy { display:flex; flex-direction:column; min-width:0; flex:1; gap:3px; }
.tree-explorer .result-copy strong { font-size:.84rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.tree-explorer .result-copy small { color:var(--muted); font-size:.64rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.tree-explorer .result-arrow { color:var(--muted); font-size:1.2rem; }
.tree-explorer .explorer-breadcrumb { display:flex; align-items:center; gap:6px; padding:12px 0 8px; min-width:0; }
.tree-explorer .back-btn { width:38px; height:38px; flex-shrink:0; border:1px solid var(--border); border-radius:10px; background:var(--surface); color:var(--text); font-size:1.5rem; }
.tree-explorer .breadcrumb-scroll { display:flex; gap:4px; overflow:auto; min-width:0; scrollbar-width:none; }
.tree-explorer .breadcrumb-scroll::-webkit-scrollbar { display:none; }
.tree-explorer .crumb { border:0; background:transparent; color:var(--text2); font-size:.7rem; white-space:nowrap; padding:6px 3px; }
.tree-explorer .crumb:not(:last-child)::after { content:' ›'; color:var(--muted); margin-left:4px; }
.tree-explorer .crumb.current { color:var(--text); font-weight:800; }
.tree-explorer .current-node { display:flex; align-items:center; gap:10px; padding:12px; background:linear-gradient(135deg,rgba(59,130,246,.08),rgba(255,255,255,.025)); border:1px solid var(--border2,var(--border)); border-radius:14px; flex-shrink:0; }
.tree-explorer .current-node-icon { width:38px; height:38px; border:1px solid; border-radius:10px; display:grid; place-items:center; background:rgba(255,255,255,.03); }
.tree-explorer .current-node-copy { min-width:0; flex:1; }
.tree-explorer .current-node-name { font-size:.95rem; font-weight:800; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.tree-explorer .current-node-meta { margin-top:2px; color:var(--muted); font-size:.65rem; font-family:var(--font-mono); }
.tree-explorer .current-action,.tree-explorer .tree-explorer .node-more { border:0; background:transparent; color:var(--text2); width:38px; height:38px; border-radius:10px; font-size:1.15rem; }
.tree-explorer .current-action:active,.tree-explorer .node-more:active { background:var(--surface2); }
.tree-explorer .child-list { overflow:auto; padding:10px 0 12px; min-height:0; flex:1; }
.tree-explorer .node-card { display:flex; align-items:stretch; background:var(--surface); border:1px solid var(--border); border-left:3px solid var(--node-color); border-radius:12px; margin-bottom:8px; min-height:62px; overflow:hidden; }
.tree-explorer .node-open { display:flex; align-items:center; gap:10px; min-width:0; flex:1; border:0; background:transparent; color:var(--text); text-align:left; padding:10px 8px 10px 11px; }
.tree-explorer .node-color-dot { width:10px; height:10px; border-radius:50%; background:var(--node-color); flex-shrink:0; box-shadow:0 0 0 3px color-mix(in srgb,var(--node-color) 14%,transparent); }
.tree-explorer .node-copy { min-width:0; flex:1; display:flex; flex-direction:column; gap:4px; }
.tree-explorer .node-copy strong { font-size:.82rem; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.tree-explorer .node-copy small { color:var(--muted); font-size:.62rem; font-family:var(--font-mono); }
.tree-explorer .node-chevron { color:var(--text2); font-size:1.4rem; }
.tree-explorer .node-leaf { color:var(--muted); font-size:1rem; padding-right:4px; }
.tree-explorer .node-more { flex-shrink:0; margin:11px 5px 11px 0; background:rgba(255,255,255,.03); }
.tree-explorer .explorer-footer { display:flex; gap:8px; padding:8px 0 max(2px,env(safe-area-inset-bottom)); flex-shrink:0; }
.tree-explorer .add-node-btn,.tree-explorer .tree-explorer .map-btn { flex:1; min-height:44px; border-radius:11px; font-size:.76rem; font-weight:800; }
.tree-explorer .add-node-btn { border:1px solid rgba(59,130,246,.3); background:var(--accent-glow,rgba(59,130,246,.12)); color:var(--accent,#3b82f6); }
.tree-explorer .map-btn { border:1px solid var(--border2); background:var(--surface); color:var(--text2); }
.tree-explorer .empty-state { padding:20px 12px; text-align:center; color:var(--muted); font-size:.76rem; }
.tree-explorer .empty-state-card { display:flex; flex-direction:column; gap:5px; align-items:center; margin-top:10px; border:1px dashed var(--border2); border-radius:12px; }
.tree-explorer .empty-state-card strong { color:var(--text2); font-size:.78rem; }
.tree-explorer .empty-icon { font-size:1.4rem; }
.tree-explorer .sheet-backdrop { position:fixed; inset:0; z-index:500; background:rgba(0,0,0,.62); display:flex; align-items:flex-end; }
.tree-explorer .action-sheet { width:100%; max-height:88vh; overflow:auto; background:var(--bg2,#0d1320); border:1px solid var(--border); border-bottom:0; border-radius:18px 18px 0 0; padding:10px 14px max(18px,env(safe-area-inset-bottom)); box-shadow:0 -16px 50px rgba(0,0,0,.5); }
.tree-explorer .sheet-handle { width:40px; height:4px; border-radius:99px; background:var(--border2); margin:2px auto 12px; }
.tree-explorer .sheet-head { display:flex; align-items:flex-start; gap:10px; padding:4px 2px 14px; }
.tree-explorer .sheet-head h2 { font-size:1rem; font-weight:800; overflow-wrap:anywhere; }
.tree-explorer .sheet-kicker { font:600 .58rem var(--font-mono); color:var(--muted); letter-spacing:.1em; margin-bottom:3px; }
.tree-explorer .sheet-close { margin-left:auto; width:40px; height:40px; border:0; border-radius:10px; background:var(--surface); color:var(--text2); font-size:1.3rem; }
.tree-explorer .sheet-actions { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.tree-explorer .sheet-action { min-height:52px; display:flex; align-items:center; gap:9px; padding:10px; border:1px solid var(--border); border-radius:11px; background:var(--surface); color:var(--text); font-size:.75rem; font-weight:700; text-align:left; }
.tree-explorer .sheet-action span:first-child { font-size:1rem; }
.tree-explorer .sheet-action.danger { color:var(--red); border-color:rgba(239,68,68,.22); }
.tree-explorer .sheet-section { margin-top:16px; }
.tree-explorer .color-swatches { display:flex; flex-wrap:wrap; gap:9px; padding:3px 2px 10px; }
.tree-explorer .color-swatch { width:30px; height:30px; border-radius:8px; border:2px solid transparent; }
.tree-explorer .color-swatch.active { border-color:#fff; box-shadow:0 0 0 2px var(--accent); }
.tree-explorer .color-picker { width:100%; height:38px; border:1px solid var(--border); border-radius:9px; background:var(--surface); }
.tree-explorer .rename-panel { margin-top:14px; padding-top:14px; border-top:1px solid var(--border); }
.tree-explorer .rename-row { display:flex; gap:7px; }
.tree-explorer .rename-row input { flex:1; min-width:0; height:44px; border:1px solid var(--border); border-radius:9px; background:var(--surface); color:var(--text); padding:0 11px; font-size:16px; outline:0; }
.tree-explorer .rename-row input:focus { border-color:var(--accent); }
.tree-explorer .rename-row button { min-width:78px; border:1px solid rgba(59,130,246,.3); border-radius:9px; background:var(--accent-glow); color:var(--accent); font-weight:800; }
.tree-explorer .sheet-enter-active,.tree-explorer .sheet-leave-active { transition:opacity .18s ease; }
.sheet-enter-active .action-sheet,.sheet-leave-active .tree-explorer .action-sheet { transition:transform .22s ease; }
.tree-explorer .sheet-enter-from,.tree-explorer .sheet-leave-to { opacity:0; }
.sheet-enter-from .action-sheet,.sheet-leave-to .tree-explorer .action-sheet { transform:translateY(100%); }

/* Desktop explorer: master/detail layout. Mobile keeps the original drill-down explorer. */
@media (min-width: 769px) {
  .tree-explorer {
    display: flex;
    flex-direction: column;
    gap: 12px;
    height: 100%;
    min-height: 0;
    padding: 14px;
    background: var(--bg2, #0d1320);
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
  }

  .tree-explorer > .explorer-search {
    flex: 0 0 auto;
  }

  .tree-explorer > .explorer-mobile-layout {
    display: none;
  }

  .tree-explorer > .desktop-explorer {
    display: grid;
    grid-template-columns: minmax(260px, 31%) minmax(0, 1fr);
    min-height: 0;
    flex: 1;
    gap: 12px;
  }

  .tree-explorer .desktop-tree-pane,
  .tree-explorer .desktop-detail-pane {
    min-width: 0;
    min-height: 0;
    background: rgba(17, 24, 39, .48);
    border: 1px solid var(--border);
    border-radius: 12px;
  }

  .tree-explorer .desktop-tree-pane {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .tree-explorer .desktop-pane-head,
  .tree-explorer .desktop-section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--border);
  }

  .tree-explorer .desktop-pane-head strong,
  .tree-explorer .desktop-section-head strong {
    font-size: .78rem;
    color: var(--text);
  }

  .tree-explorer .desktop-node-count,
  .tree-explorer .desktop-section-head > span {
    min-width: 26px;
    padding: 3px 7px;
    border: 1px solid var(--border);
    border-radius: 999px;
    color: var(--text2);
    font: 600 .62rem var(--font-mono, monospace);
    text-align: center;
  }

  .tree-explorer .desktop-pane-kicker {
    margin-bottom: 3px;
    color: var(--muted);
    font: 700 .58rem var(--font-mono, monospace);
    letter-spacing: .1em;
  }

  .tree-explorer .desktop-tree-list {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 7px;
  }

  .tree-explorer .desktop-tree-item {
    position: relative;
    width: 100%;
    min-height: 48px;
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 7px 9px 7px calc(10px + (var(--depth) * 17px));
    border: 1px solid transparent;
    border-radius: 9px;
    background: transparent;
    color: var(--text);
    text-align: left;
  }

  .tree-explorer .desktop-tree-item:hover {
    background: rgba(255,255,255,.035);
    border-color: var(--border);
  }

  .tree-explorer .desktop-tree-item.active {
    background: rgba(59,130,246,.10);
    border-color: rgba(59,130,246,.28);
  }

  .tree-explorer .desktop-tree-rail {
    position: absolute;
    left: calc(8px + ((var(--depth) - 1) * 17px));
    top: 0;
    bottom: 0;
    width: 1px;
    background: var(--border);
    opacity: .7;
  }

  .tree-explorer .desktop-tree-item:first-child .desktop-tree-rail {
    display: none;
  }

  .tree-explorer .desktop-tree-dot {
    width: 8px;
    height: 8px;
    flex: 0 0 auto;
    border-radius: 50%;
    background: var(--node-color);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--node-color) 12%, transparent);
  }

  .tree-explorer .desktop-tree-copy {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }

  .tree-explorer .desktop-tree-copy strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: .72rem;
    font-weight: 700;
  }

  .tree-explorer .desktop-tree-copy small {
    color: var(--muted);
    font: 500 .58rem var(--font-mono, monospace);
  }

  .tree-explorer .desktop-tree-current {
    color: var(--accent, #3b82f6);
    font-size: .55rem;
  }

  .tree-explorer .desktop-detail-pane {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .tree-explorer .desktop-detail-head {
    flex: 0 0 auto;
    padding: 10px 12px 0;
  }

  .tree-explorer .desktop-detail-head .explorer-breadcrumb {
    padding: 0 0 9px;
  }

  .tree-explorer .desktop-detail-head .current-node {
    margin-bottom: 10px;
  }

  .tree-explorer .desktop-detail-content {
    display: flex;
    flex-direction: column;
    min-height: 0;
    flex: 1;
    overflow: hidden;
    border-top: 1px solid var(--border);
  }

  .tree-explorer .desktop-section-head {
    flex: 0 0 auto;
    padding: 10px 14px;
  }

  .tree-explorer .desktop-child-list {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 10px 12px;
  }

  .tree-explorer .desktop-child-list .node-card {
    min-height: 58px;
  }

  .tree-explorer .desktop-detail-footer {
    flex: 0 0 auto;
    padding: 10px 12px 12px;
    border-top: 1px solid var(--border);
  }

  .tree-explorer .desktop-detail-footer .add-node-btn,
  .tree-explorer .desktop-detail-footer .map-btn {
    min-height: 42px;
  }

  .tree-explorer .action-sheet {
    max-width: 520px;
    border: 1px solid var(--border);
    border-radius: 16px;
    margin: auto;
  }

  .tree-explorer .sheet-backdrop {
    align-items: center;
    padding: 24px;
  }
}
</style>
