<template>
  <div>
    <div class="page-header">
      <div>
        <div class="page-title">{{ pageTitle }}</div>
        <div class="page-sub">{{ filtered.length }} task</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" :disabled="store.loading" @click="store.loadAll()">Refresh</button>
        <button class="btn btn-primary" @click="openAdd">＋ Task Baru</button>
      </div>
    </div>

    <!-- Filter & Search -->
    <div class="filter-bar">
      <!-- Row 1: status tabs -->
      <div class="filter-tabs">
        <button
          v-for="f in FILTERS" :key="f.value"
          :class="['filter-btn', { active: activeFilter === f.value }]"
          @click="setFilter(f.value)"
        >
          {{ f.label }}
          <span class="filter-count">{{ statusCount(f.value) }}</span>
        </button>
      </div>

      <!-- Row 2: sort controls -->
      <div class="sort-bar">
        <span class="sort-label">Urutkan:</span>
        <div class="sort-group">
          <button
            v-for="s in SORTS" :key="s.value"
            :class="['sort-btn', { active: sortBy === s.value }]"
            @click="toggleSort(s.value)"
          >
            {{ s.label }}
            <span v-if="sortBy === s.value" class="sort-dir">{{ sortDir === 'asc' ? '↑' : '↓' }}</span>
          </button>
        </div>
        <input v-model="search" class="search-input" placeholder="Cari task..." />
      </div>
    </div>

    <!-- Task Grid -->
    <div v-if="store.loading" class="empty-state">
      <div class="empty-icon">⏳</div>
      <div class="empty-text">Memuat data...</div>
    </div>
    <div v-else-if="!filtered.length" class="empty-state">
      <div class="empty-icon">📭</div>
      <div class="empty-text">Tidak ada task yang cocok</div>
    </div>
    <div v-else class="task-grid">
      <TaskCard
        v-for="t in filtered"
        :key="t.id"
        :task="t"
        @click="router.push('/tasks/' + t.id)"
        @edit="openEdit(t)"
        @delete="askDelete(t)"
      />
    </div>

    <TaskFormModal v-model="showForm" :task="editTarget" @saved="store.loadAll()" />
    <ConfirmModal v-model="showConfirm" :item-name="deleteTarget?.name" @confirm="doDelete" />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTasksStore } from '@/stores/tasks'
import { useToast } from '@/composables/useToast'
import TaskCard      from '@/components/TaskCard.vue'
import TaskFormModal from '@/components/TaskFormModal.vue'
import ConfirmModal  from '@/components/ConfirmModal.vue'

const store  = useTasksStore()
const route  = useRoute()
const router = useRouter()
const toast  = useToast()

const FILTERS = [
  { value: 'active', label: 'Aktif' },
  { value: 'todo',     label: 'Belum' },
  { value: 'progress', label: 'Jalan' },
  { value: 'paused',   label: 'Ditunda' },
  { value: 'done',     label: 'Selesai' }
]

// Sort options: name, priority, deadline — each toggles asc/desc
const SORTS = [
  { value: 'name',     label: 'Nama' },
  { value: 'priority', label: 'Prioritas' },
  { value: 'deadline', label: 'Deadline' }
]

const PRIORITY_ORDER = { high: 0, med: 1, low: 2 }

const activeFilter = ref('active') // default: sembunyikan done
const search   = ref('')
const sortBy   = ref('priority')   // default sort: prioritas
const sortDir  = ref('asc')        // asc | desc
const showForm = ref(false)
const editTarget = ref(null)
const showConfirm = ref(false)
const deleteTarget = ref(null)

// Sync filter dari URL query ?status=xxx
watch(() => route.query.status, (s) => {
  if (!s) { activeFilter.value = 'active'; return }
  // Map status query ke filter value
  activeFilter.value = s
}, { immediate: true })

const pageTitle = computed(() => {
  const map = {
    active: 'Semua Task Aktif',
    todo: 'Belum Mulai',
    progress: 'Sedang Jalan',
    paused: 'Ditunda',
    done: 'Selesai'
  }
  return map[activeFilter.value] || 'Semua Task'
})

function statusCount(f) {
  if (f === 'active') return store.tasks.filter(t => t.status !== 'done').length
  return store.tasks.filter(t => t.status === f).length
}

function toggleSort(val) {
  if (sortBy.value === val) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = val
    sortDir.value = 'asc'
  }
}

const filtered = computed(() => {
  const q = search.value.toLowerCase()

  let list = store.tasks.filter(t => {
    // Filter by tab
    if (activeFilter.value === 'active') {
      if (t.status === 'done') return false
    } else if (activeFilter.value !== 'all') {
      if (t.status !== activeFilter.value) return false
    }
    // Search
    if (q && !t.name.toLowerCase().includes(q) && !(t.desc || '').toLowerCase().includes(q)) return false
    return true
  })

  // Sort
  const dir = sortDir.value === 'asc' ? 1 : -1
  list = [...list].sort((a, b) => {
    if (sortBy.value === 'name') {
      return dir * a.name.localeCompare(b.name)
    }
    if (sortBy.value === 'priority') {
      const pa = PRIORITY_ORDER[a.priority] ?? 1
      const pb = PRIORITY_ORDER[b.priority] ?? 1
      if (pa !== pb) return dir * (pa - pb)
      // secondary: sort order
      return (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999)
    }
    if (sortBy.value === 'deadline') {
      const da = a.target ? new Date(a.target).getTime() : (dir > 0 ? Infinity : -Infinity)
      const db = b.target ? new Date(b.target).getTime() : (dir > 0 ? Infinity : -Infinity)
      return dir * (da - db)
    }
    return 0
  })

  // Task done selalu di akhir (kecuali filter done aktif)
  if (activeFilter.value !== 'done') {
    list.sort((a, b) => {
      if (a.status === 'done' && b.status !== 'done') return 1
      if (a.status !== 'done' && b.status === 'done') return -1
      return 0
    })
  }

  return list
})

function setFilter(f) {
  activeFilter.value = f
  const statusMap = { active: undefined, todo: 'todo', progress: 'progress', paused: 'paused', done: 'done' }
  const q = statusMap[f]
  router.replace({ query: q ? { status: q } : {} })
}

function openAdd()  { editTarget.value = null; showForm.value = true }
function openEdit(t){ editTarget.value = { ...t }; showForm.value = true }
function askDelete(t){ deleteTarget.value = t; showConfirm.value = true }

async function doDelete() {
  if (!deleteTarget.value) return
  try {
    await store.removeTask(deleteTarget.value.id)
    toast.success('Task dihapus')
  } catch(e) { toast.error('Gagal: ' + e.message) }
}

onMounted(() => { if (!store.tasks.length) store.loadAll() })
</script>

<style scoped>
.filter-bar { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }

/* Row 1: status tabs */
.filter-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
.filter-btn {
  display: flex; align-items: center; gap: 5px;
  padding: 6px 12px; border-radius: 99px;
  font-size: 0.75rem; font-weight: 700;
  border: 1px solid var(--border); background: transparent; color: var(--text2);
  transition: all 0.15s; cursor: pointer;
}
.filter-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }
.filter-btn:hover:not(.active) { border-color: var(--border2); color: var(--text); }
.filter-count {
  background: rgba(255,255,255,0.15); border-radius: 99px;
  padding: 1px 5px; font-size: 0.65rem; font-family: var(--font-mono);
  min-width: 18px; text-align: center;
}
.filter-btn:not(.active) .filter-count { background: var(--surface2); color: var(--muted); }

/* Row 2: sort bar */
.sort-bar {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
}
.sort-label {
  font-size: 0.72rem; font-weight: 700; color: var(--muted);
  text-transform: uppercase; letter-spacing: 0.06em; flex-shrink: 0;
}
.sort-group { display: flex; gap: 4px; }
.sort-btn {
  display: flex; align-items: center; gap: 3px;
  padding: 5px 10px; border-radius: var(--radius);
  font-size: 0.75rem; font-weight: 700;
  border: 1px solid var(--border); background: transparent; color: var(--text2);
  transition: all 0.15s; cursor: pointer;
}
.sort-btn.active {
  background: var(--surface2); color: var(--text);
  border-color: var(--border2);
}
.sort-btn:hover:not(.active) { border-color: var(--border2); color: var(--text); }
.sort-dir { font-size: 0.8rem; font-weight: 900; }

.search-input {
  flex: 1; min-width: 140px;
  background: var(--surface); border: 1px solid var(--border);
  color: var(--text); font-size: 0.82rem; padding: 7px 14px;
  border-radius: var(--radius); outline: none;
  transition: border-color 0.18s; font-family: var(--font-body);
}
.search-input:focus { border-color: var(--accent); }
.search-input::placeholder { color: var(--muted); }

.task-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }

@media (max-width: 600px) {
  .sort-bar { flex-direction: column; align-items: stretch; }
  .sort-group { flex-wrap: wrap; }
  .search-input { width: 100%; }
  .task-grid { grid-template-columns: 1fr; }
}
</style>
