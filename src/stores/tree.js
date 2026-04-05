import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useAuthStore } from './auth'
import { saveTree, loadTree } from '@/services/googleSheets'

const DEFAULT_TREE = {
  id: 'root',
  name: 'Root Node',
  color: '#3b82f6',
  collapsed: false,
  children: []
}

function loadFromStorage() {
  try {
    const saved = localStorage.getItem('pr-task-tree')
    return saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(DEFAULT_TREE))
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_TREE))
  }
}

function saveToStorage(tree) {
  try { localStorage.setItem('pr-task-tree', JSON.stringify(tree)) } catch {}
}

function generateId() {
  return 'node-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7)
}

function findNode(node, id) {
  if (node.id === id) return node
  if (node.children) {
    for (const child of node.children) {
      const found = findNode(child, id)
      if (found) return found
    }
  }
  return null
}

function findParent(node, id) {
  if (node.children) {
    for (const child of node.children) {
      if (child.id === id) return node
      const found = findParent(child, id)
      if (found) return found
    }
  }
  return null
}

export const useTreeStore = defineStore('tree', () => {
  const auth = useAuthStore()
  const tree = ref(loadFromStorage())

  const sheetsStatus  = ref('idle')
  const sheetsMsg     = ref('')

  function save() { saveToStorage(tree.value) }

  function toggleCollapse(nodeId) {
    const node = findNode(tree.value, nodeId)
    if (node) { node.collapsed = !node.collapsed; save() }
  }

  function updateNodeColor(nodeId, color) {
    const node = findNode(tree.value, nodeId)
    if (node) { node.color = color; save() }
  }

  function updateNodeName(nodeId, name) {
    const node = findNode(tree.value, nodeId)
    if (node) { node.name = name; save() }
  }

  function addChild(parentId) {
    const parent = findNode(tree.value, parentId)
    if (parent) {
      if (!parent.children) parent.children = []
      parent.children.push({
        id: generateId(),
        name: 'New Node',
        color: parent.color,
        collapsed: false,
        children: []
      })
      parent.collapsed = false
      save()
    }
  }

  function deleteNode(nodeId) {
    if (nodeId === 'root') return
    const parent = findParent(tree.value, nodeId)
    if (parent) {
      parent.children = parent.children.filter(c => c.id !== nodeId)
      save()
    }
  }

  function resetTree() {
    tree.value = JSON.parse(JSON.stringify(DEFAULT_TREE))
    save()
  }

  function exportJSON() {
    const data = {
      version: '1.0',
      name: 'Tree Diagram Export',
      createdAt: new Date().toISOString(),
      tree: JSON.parse(JSON.stringify(tree.value))
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tree-diagram-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function importJSON(jsonData) {
    try {
      const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData
      if (data.tree) {
        tree.value = data.tree
      } else if (data.id) {
        tree.value = data
      } else {
        throw new Error('Invalid format')
      }
      save()
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  }

  // ── Google Sheets sync ──────────────────────
  async function saveToSheets() {
    if (!auth.sheetId) {
      sheetsStatus.value = 'error'
      sheetsMsg.value    = 'Sheet ID belum diisi di Settings'
      return { ok: false, error: sheetsMsg.value }
    }
    sheetsStatus.value = 'saving'
    sheetsMsg.value    = 'Menyimpan ke Sheets...'
    try {
      await saveTree(tree.value, auth.sheetId)
      sheetsStatus.value = 'ok'
      sheetsMsg.value    = '✅ Tersimpan ke Google Sheets'
      return { ok: true }
    } catch (e) {
      sheetsStatus.value = 'error'
      sheetsMsg.value    = e.message || 'Gagal menyimpan'
      return { ok: false, error: sheetsMsg.value }
    }
  }

  async function loadFromSheets() {
    if (!auth.sheetId) {
      sheetsStatus.value = 'error'
      sheetsMsg.value    = 'Sheet ID belum diisi di Settings'
      return { ok: false, error: sheetsMsg.value }
    }
    sheetsStatus.value = 'loading'
    sheetsMsg.value    = 'Memuat dari Sheets...'
    try {
      const loaded = await loadTree(auth.sheetId)
      if (loaded) {
        tree.value = loaded
        save()
        sheetsStatus.value = 'ok'
        sheetsMsg.value    = '✅ Tree dimuat dari Google Sheets'
        return { ok: true }
      } else {
        sheetsStatus.value = 'ok'
        sheetsMsg.value    = 'Sheet kosong, tree tidak berubah'
        return { ok: true, empty: true }
      }
    } catch (e) {
      sheetsStatus.value = 'error'
      sheetsMsg.value    = e.message || 'Gagal memuat'
      return { ok: false, error: sheetsMsg.value }
    }
  }

  return {
    tree,
    sheetsStatus,
    sheetsMsg,
    toggleCollapse,
    updateNodeColor,
    updateNodeName,
    addChild,
    deleteNode,
    resetTree,
    exportJSON,
    importJSON,
    saveToSheets,
    loadFromSheets
  }
})
