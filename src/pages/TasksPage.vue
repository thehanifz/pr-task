<template>
  <div>
    <div class="page-header">
      <div>
        <div class="page-title">{{ pageTitle }}</div>
        <div class="page-sub">{{ filtered.length }} task</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" :disabled="store.loading" @click="store.loadAll()">🔄 Refresh</button>
        <button class="btn btn-primary" @click="openAdd">＋ Task Baru</button>
      </div>
    </div>

    <!-- Filter & Search -->
    <div class="filter-bar">
      <button
        v-for="f in FILTERS" :key="f.value"
        :class="['filter-btn', { active: activeFilter === f.value }]"
        @click="setFilter(f.value)"
      >{{ f.label }}</button>
      <select v-model="sortBy" class="sort-select">
        <option value="order">Urutan Prioritas</option>
        <option value="progress_desc">Progress ↓</option>
        <option value="progress_asc">Progress ↑</option>
        <option value="deadline">Deadline Terdekat</option>
        <option value="name">Nama A-Z</option>
        <option value="priority">Prioritas</option>
      </select>
      <input v-model="search" class="search-input" placeholder="🔍 Cari task..." />
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
  { value: 'all',      label: 'Semua' },
  { value: 'todo',     label: 'Belum Mulai' },
  { value: 'progress', label: 'Sedang Jalan' },
  { value: 'done',     label: 'Selesai' },
  { value: 'paused',   label: 'Ditunda' }
]

const PRIORITY_ORDER = { high: 0, med: 1, low: 2 }

const activeFilter = ref('all')
const search   = ref('')
const sortBy   = ref('order')
const showForm = ref(false)
const editTarget = ref(null)
const showConfirm = ref(false)
const deleteTarget = ref(null)

watch(() => route.query.status, (s) => { activeFilter.value = s || 'all' }, { immediate: true })

const pageTitle = computed(() => {
  const f = FILTERS.find(f => f.value === activeFilter.value)
  return f?.value === 'all' ? 'Semua Task' : f?.label || 'Task'
})

const filtered = computed(() => {
  const q = search.value.toLowerCase()
  let list = store.tasks.filter(t => {
    if (activeFilter.value !== 'all' && t.status !== activeFilter.value) return false
    if (q && !t.name.toLowerCase().includes(q) && !t.desc.toLowerCase().includes(q)) return false
    return true
  })

  // Sort
  const today = new Date(); today.setHours(0,0,0,0)
  switch (sortBy.value) {
    case 'order':
      list = list.sort((a,b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999))
      break
    case 'progress_desc':
      list = list.sort((a,b) => b.progress - a.progress)
      break
    case 'progress_asc':
      list = list.sort((a,b) => a.progress - b.progress)
      break
    case 'deadline':
      list = list.sort((a,b) => {
        if (!a.target) return 1; if (!b.target) return -1
        return new Date(a.target) - new Date(b.target)
      })
      break
    case 'name':
      list = list.sort((a,b) => a.name.localeCompare(b.name))
      break
    case 'priority':
      list = list.sort((a,b) => (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1))
      break
  }
  return list
})

function setFilter(f) {
  activeFilter.value = f
  router.replace({ query: f !== 'all' ? { status: f } : {} })
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
.filter-bar {
  display: flex; gap: 8px; flex-wrap: wrap;
  align-items: center; margin-bottom: 20px;
}
.filter-btn {
  padding: 6px 14px; border-radius: 99px;
  font-size: 0.75rem; font-weight: 700;
  border: 1px solid var(--border); background: transparent; color: var(--text2);
  transition: all 0.15s;
}
.filter-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }
.filter-btn:hover:not(.active) { border-color: var(--border2); color: var(--text); }

.sort-select {
  background: var(--surface); border: 1px solid var(--border);
  color: var(--text); font-size: 0.78rem; font-weight: 600;
  padding: 6px 10px; border-radius: var(--radius); outline: none;
  cursor: pointer; font-family: var(--font-body); transition: border-color 0.15s;
}
.sort-select:focus { border-color: var(--accent); }

.search-input {
  margin-left: auto; background: var(--surface); border: 1px solid var(--border);
  color: var(--text); font-size: 0.82rem; padding: 7px 14px;
  border-radius: var(--radius); outline: none; width: 210px;
  transition: border-color 0.18s; font-family: var(--font-body);
}
.search-input:focus { border-color: var(--accent); }
.search-input::placeholder { color: var(--muted); }

.task-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }

@media (max-width: 600px) {
  .search-input { width: 100%; margin-left: 0; }
  .task-grid { grid-template-columns: 1fr; }
  .sort-select { width: 100%; }
}
</style>
