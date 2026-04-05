<template>
  <div>
    <div class="page-header">
      <div>
        <div class="page-title">Atur Prioritas</div>
        <div class="page-sub">Drag &amp; drop untuk ubah urutan · {{ visibleList.length }} task ditampilkan</div>
      </div>
      <div class="page-actions">
        <button v-if="isDirty" class="btn btn-secondary btn-sm" @click="resetOrder">↺ Batal</button>
        <button v-if="isDirty" class="btn btn-primary" :disabled="saving" @click="saveOrder">
          {{ saving ? '⏳ Menyimpan...' : '💾 Simpan Urutan' }}
        </button>
      </div>
    </div>

    <!-- Filter status -->
    <div class="filter-tabs">
      <button
        v-for="f in FILTERS" :key="f.value"
        :class="['filter-btn', { active: filterStatus === f.value }]"
        @click="setFilter(f.value)"
      >
        {{ f.label }}
        <span class="filter-count">{{ countByFilter(f.value) }}</span>
      </button>
    </div>

    <!-- Empty -->
    <div v-if="!visibleList.length" class="empty-state">
      <div class="empty-icon">📋</div>
      <div class="empty-text">Tidak ada task di kategori ini</div>
    </div>

    <!-- Drag list -->
    <draggable
      v-else
      v-model="visibleList"
      item-key="id"
      handle=".drag-handle"
      ghost-class="drag-ghost"
      chosen-class="drag-chosen"
      animation="200"
      @change="onReorder"
    >
      <template #item="{ element: t, index: i }">
        <div class="priority-row card">
          <!-- Rank + drag -->
          <div class="pr-rank">
            <span class="rank-num mono">{{ i + 1 }}</span>
            <button class="drag-handle" title="Drag untuk reorder">⣿</button>
          </div>

          <!-- Info -->
          <div class="pr-info">
            <div class="pr-name">{{ t.name }}</div>
            <div class="pr-meta">
              <span :class="['badge', CAT_BADGE[t.cat] || 'cat-other']" style="font-size:0.62rem">{{ CAT_LABELS[t.cat] || t.cat }}</span>
              <span :class="['badge', STATUS_BADGE[t.status]]" style="font-size:0.62rem">{{ STATUS_LABELS[t.status] }}</span>
              <span v-if="t.target" class="deadline-info" :class="{ overdue: isOverdue(t) }">
                📅 {{ t.target }}
              </span>
            </div>
          </div>

          <!-- Progress bar (hidden on small mobile) -->
          <div class="pr-progress">
            <div class="prog-num mono">{{ t.progress }}%</div>
            <div class="progress-bar" style="width:70px;height:5px">
              <div :class="['progress-fill', progressFillClass(t.progress)]" :style="{ width: t.progress + '%' }" />
            </div>
          </div>

          <!-- Priority changer -->
          <div class="pr-priority">
            <div class="priority-pills">
              <button
                v-for="p in PRIORITIES" :key="p.value"
                :class="['prio-btn', `prio-${p.value}`, { active: t.priority === p.value }]"
                :title="p.label"
                :disabled="saving"
                @click.stop="changePriority(t, p.value)"
              >{{ p.short }}</button>
            </div>
          </div>
        </div>
      </template>
    </draggable>

    <!-- Sticky save bar -->
    <transition name="slide-up">
      <div v-if="isDirty" class="save-bar">
        <span class="save-bar-hint">⚠️ Urutan belum disimpan</span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" @click="resetOrder">↺ Batal</button>
          <button class="btn btn-primary btn-sm" :disabled="saving" @click="saveOrder">
            {{ saving ? '⏳...' : '💾 Simpan' }}
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import draggable from 'vuedraggable'
import { useTasksStore } from '@/stores/tasks'
import { useToast } from '@/composables/useToast'
import {
  CAT_LABELS, CAT_BADGE,
  STATUS_LABELS, STATUS_BADGE,
  progressFillClass, deadlineDiff
} from '@/composables/useTaskHelpers'

const store = useTasksStore()
const toast = useToast()

const FILTERS = [
  { value: 'all',      label: 'Semua' },
  { value: 'progress', label: 'Jalan' },
  { value: 'todo',     label: 'Belum' },
  { value: 'paused',   label: 'Ditunda' }
]

const PRIORITIES = [
  { value: 'high', label: 'Tinggi', short: 'H' },
  { value: 'med',  label: 'Sedang', short: 'M' },
  { value: 'low',  label: 'Rendah', short: 'L' }
]

const filterStatus = ref('all')
const saving   = ref(false)
const isDirty  = ref(false)

// Master ordered list — selalu semua task, sorted
const masterList = ref([])

// Visible (filtered) — dua arah dengan draggable
const visibleList = ref([])

// Sync master dari store
watch(() => store.sortedTasks, (tasks) => {
  masterList.value = tasks.map(t => ({ ...t }))
  syncVisible()
  isDirty.value = false
}, { immediate: true, deep: true })

function syncVisible() {
  if (filterStatus.value === 'all') {
    visibleList.value = [...masterList.value]
  } else {
    visibleList.value = masterList.value.filter(t => t.status === filterStatus.value)
  }
}

function setFilter(f) {
  filterStatus.value = f
  syncVisible()
}

function countByFilter(f) {
  if (f === 'all') return store.tasks.filter(t => t.status !== 'done').length
  return store.tasks.filter(t => t.status === f).length
}

function isOverdue(t) {
  const d = deadlineDiff(t.target)
  return d !== null && d < 0 && t.status !== 'done'
}

function onReorder() {
  // Rebuild masterList: replace posisi visible items sesuai drag baru
  if (filterStatus.value === 'all') {
    masterList.value = [...visibleList.value]
  } else {
    // Ambil index dari master untuk items yang visible, re-assign posisi
    const visibleIds = visibleList.value.map(t => t.id)
    // Ambil non-visible dari master (urutan relative tetap)
    const nonVisible = masterList.value.filter(t => !visibleIds.includes(t.id))
    // Sisipkan visible dalam master sesuai urutan baru
    const newMaster = []
    let vi = 0, ni = 0
    masterList.value.forEach(t => {
      if (visibleIds.includes(t.id)) {
        newMaster.push(visibleList.value[vi++])
      } else {
        newMaster.push(nonVisible[ni++])
      }
    })
    masterList.value = newMaster
  }
  isDirty.value = true
}

async function changePriority(task, newPriority) {
  if (task.priority === newPriority) return
  // Update di masterList & visibleList secara lokal dulu
  const mi = masterList.value.findIndex(t => t.id === task.id)
  if (mi >= 0) masterList.value[mi] = { ...masterList.value[mi], priority: newPriority }
  const vi = visibleList.value.findIndex(t => t.id === task.id)
  if (vi >= 0) visibleList.value[vi] = { ...visibleList.value[vi], priority: newPriority }
  try {
    await store.editTask({ ...task, priority: newPriority })
    toast.success(`Prioritas "${task.name}" → ${newPriority.toUpperCase()}`)
  } catch(e) {
    toast.error('Gagal: ' + e.message)
  }
}

async function saveOrder() {
  saving.value = true
  try {
    const newOrdered = masterList.value.map((t, i) => ({ ...t, sortOrder: i }))
    await store.reorderTasks(newOrdered)
    isDirty.value = false
    toast.success('Urutan prioritas disimpan ✅')
  } catch(e) {
    toast.error('Gagal menyimpan: ' + e.message)
  } finally {
    saving.value = false
  }
}

function resetOrder() {
  masterList.value = store.sortedTasks.map(t => ({ ...t }))
  syncVisible()
  isDirty.value = false
}
</script>

<style scoped>
.filter-tabs { display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px; }
.filter-btn {
  display:flex;align-items:center;gap:5px;
  padding:6px 12px;border-radius:99px;font-size:0.75rem;font-weight:700;
  border:1px solid var(--border);background:transparent;color:var(--text2);
  transition:all 0.15s;cursor:pointer;
}
.filter-btn.active { background:var(--accent);color:#fff;border-color:var(--accent); }
.filter-btn:hover:not(.active) { border-color:var(--border2);color:var(--text); }
.filter-count {
  background:rgba(255,255,255,0.15);border-radius:99px;
  padding:1px 5px;font-size:0.65rem;font-family:var(--font-mono);
  min-width:18px;text-align:center;
}
.filter-btn:not(.active) .filter-count { background:var(--surface2);color:var(--muted); }

.priority-row {
  display:flex;align-items:center;gap:12px;
  margin-bottom:8px;padding:12px 14px;
  transition:border-color 0.15s;
}
.priority-row:hover { border-color:var(--border2); }

.drag-ghost  { opacity:0.3;background:var(--surface2) !important; }
.drag-chosen { box-shadow:0 8px 28px rgba(0,0,0,0.5) !important;border-color:var(--accent) !important;z-index:10; }

.pr-rank { display:flex;flex-direction:column;align-items:center;gap:4px;flex-shrink:0;width:28px; }
.rank-num { font-size:0.68rem;color:var(--muted);font-family:var(--font-mono); }
.drag-handle {
  background:none;border:none;color:var(--muted);
  font-size:1.1rem;cursor:grab;padding:2px;transition:color 0.15s;line-height:1;
}
.drag-handle:hover { color:var(--accent); }
.drag-handle:active { cursor:grabbing; }

.pr-info { flex:1;min-width:0; }
.pr-name {
  font-size:0.88rem;font-weight:700;margin-bottom:4px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
.pr-meta { display:flex;align-items:center;gap:6px;flex-wrap:wrap; }
.deadline-info { font-size:0.68rem;color:var(--text2); }
.deadline-info.overdue { color:var(--red);font-weight:700; }

.pr-progress { flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:4px; }
.prog-num { font-size:0.68rem;color:var(--text2); }

/* Priority pill buttons */
.pr-priority { flex-shrink:0; }
.priority-pills { display:flex;gap:4px; }
.prio-btn {
  width:26px;height:26px;border-radius:6px;border:1px solid var(--border);
  background:transparent;color:var(--text2);font-size:0.7rem;font-weight:800;
  cursor:pointer;transition:all 0.13s;display:flex;align-items:center;justify-content:center;
}
.prio-btn:hover { border-color:var(--border2);color:var(--text); }
.prio-btn:disabled { opacity:0.5;cursor:not-allowed; }
/* Active states per priority */
.prio-high.active { background:rgba(239,68,68,0.2);color:var(--red);border-color:var(--red); }
.prio-med.active  { background:rgba(245,158,11,0.2);color:var(--yellow);border-color:var(--yellow); }
.prio-low.active  { background:rgba(107,114,128,0.18);color:var(--muted);border-color:var(--muted); }
/* Hover tint per priority */
.prio-high:not(.active):hover { background:rgba(239,68,68,0.1);color:var(--red); }
.prio-med:not(.active):hover  { background:rgba(245,158,11,0.1);color:var(--yellow); }
.prio-low:not(.active):hover  { background:rgba(107,114,128,0.1);color:var(--muted); }

/* Sticky save bar */
.save-bar {
  position:fixed;bottom:20px;left:50%;transform:translateX(-50%);
  display:flex;align-items:center;gap:14px;
  background:var(--surface);border:1px solid rgba(59,130,246,0.3);
  border-radius:var(--radius);padding:12px 18px;
  box-shadow:0 8px 32px rgba(0,0,0,0.4);
  font-size:0.82rem;color:var(--text2);
  z-index:50;white-space:nowrap;
}
.save-bar-hint { font-weight:600; }

.slide-up-enter-active,.slide-up-leave-active { transition:all 0.25s ease; }
.slide-up-enter-from,.slide-up-leave-to { opacity:0;transform:translateX(-50%) translateY(12px); }

@media(max-width:600px) {
  .pr-progress { display:none; }
  .priority-row { gap:8px;padding:10px 12px; }
  .save-bar { left:14px;right:14px;transform:none;bottom:14px; }
  .slide-up-enter-from,.slide-up-leave-to { transform:translateY(12px); }
}
</style>
