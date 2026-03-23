<template>
  <div>
    <div class="page-header">
      <div>
        <div class="page-title">Atur Prioritas</div>
        <div class="page-sub">Drag & drop untuk ubah urutan prioritas task</div>
      </div>
      <div class="page-actions">
        <button v-if="isDirty" class="btn btn-primary" :disabled="saving" @click="saveOrder">
          {{ saving ? '⏳ Menyimpan...' : '💾 Simpan Urutan' }}
        </button>
        <button v-if="isDirty" class="btn btn-secondary" @click="resetOrder">↺ Reset</button>
      </div>
    </div>

    <!-- Filter by status -->
    <div class="filter-bar" style="margin-bottom:20px">
      <button
        v-for="f in FILTERS" :key="f.value"
        :class="['filter-btn', { active: filterStatus === f.value }]"
        @click="filterStatus = f.value"
      >{{ f.label }}</button>
    </div>

    <!-- Drag list -->
    <div v-if="!filteredList.length" class="empty-state">
      <div class="empty-icon">📋</div>
      <div class="empty-text">Tidak ada task di kategori ini</div>
    </div>

    <draggable
      v-else
      v-model="orderedList"
      item-key="id"
      handle=".drag-handle"
      ghost-class="drag-ghost"
      chosen-class="drag-chosen"
      animation="180"
      @change="onReorder"
    >
      <template #item="{ element: t, index: i }">
        <div class="priority-row card">
          <div class="pr-rank">
            <span class="rank-num mono">{{ i + 1 }}</span>
            <button class="drag-handle" title="Drag untuk reorder">⠿</button>
          </div>
          <div class="pr-info">
            <div class="pr-name">{{ t.name }}</div>
            <div class="pr-meta">
              <span :class="['badge', CAT_BADGE[t.cat] || 'cat-other']" style="font-size:0.62rem">{{ CAT_LABELS[t.cat] || t.cat }}</span>
              <span :class="['badge', STATUS_BADGE[t.status]]" style="font-size:0.62rem">{{ STATUS_LABELS[t.status] }}</span>
              <span class="mono" style="font-size:0.68rem;color:var(--text2)">{{ t.progress }}%</span>
            </div>
          </div>
          <div class="pr-progress">
            <div class="progress-bar" style="width:80px">
              <div :class="['progress-fill', progressFillClass(t.progress)]" :style="{ width: t.progress + '%' }" />
            </div>
          </div>
          <div class="pr-priority">
            <select
              :value="t.priority"
              class="form-select"
              style="padding:5px 8px;font-size:0.75rem;width:auto;background:var(--bg2)"
              @change="changePriority(t, $event.target.value)"
            >
              <option value="high">🔴 Tinggi</option>
              <option value="med">🟡 Sedang</option>
              <option value="low">🟢 Rendah</option>
            </select>
          </div>
        </div>
      </template>
    </draggable>

    <div v-if="isDirty" class="save-hint">
      <span>💡 Ada perubahan urutan yang belum disimpan</span>
      <button class="btn btn-primary btn-sm" :disabled="saving" @click="saveOrder">
        {{ saving ? '⏳' : '💾 Simpan Sekarang' }}
      </button>
    </div>
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
  progressFillClass
} from '@/composables/useTaskHelpers'

const store = useTasksStore()
const toast = useToast()

const FILTERS = [
  { value: 'all',      label: 'Semua' },
  { value: 'progress', label: 'Sedang Jalan' },
  { value: 'todo',     label: 'Belum Mulai' },
  { value: 'paused',   label: 'Ditunda' }
]

const filterStatus = ref('all')
const saving   = ref(false)
const isDirty  = ref(false)

// Local copy for drag
const orderedList = ref([])

const filteredList = computed(() =>
  store.sortedTasks.filter(t =>
    filterStatus.value === 'all' || t.status === filterStatus.value
  )
)

// Sync from store when filter changes
watch([filteredList, filterStatus], () => {
  orderedList.value = [...filteredList.value]
  isDirty.value = false
}, { immediate: true })

function onReorder() {
  isDirty.value = true
}

async function changePriority(task, newPriority) {
  try {
    await store.editTask({ ...task, priority: newPriority })
    toast.success('Prioritas diupdate')
  } catch(e) {
    toast.error('Gagal: ' + e.message)
  }
}

async function saveOrder() {
  saving.value = true
  try {
    // Assign sortOrder based on current drag position
    const newOrdered = orderedList.value.map((t, i) => ({ ...t, sortOrder: i }))
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
  orderedList.value = [...filteredList.value]
  isDirty.value = false
}
</script>

<style scoped>
.filter-bar { display:flex;gap:8px;flex-wrap:wrap; }
.filter-btn {
  padding:6px 14px;border-radius:99px;font-size:0.75rem;font-weight:700;
  border:1px solid var(--border);background:transparent;color:var(--text2);transition:all 0.15s;
}
.filter-btn.active { background:var(--accent);color:#fff;border-color:var(--accent); }
.filter-btn:hover:not(.active) { border-color:var(--border2);color:var(--text); }

.priority-row {
  display:flex;align-items:center;gap:14px;
  margin-bottom:8px;padding:14px 16px;
  transition:all 0.15s;
}
.priority-row:hover { border-color:var(--border2); }

.drag-ghost { opacity:0.35;background:var(--surface2) !important; }
.drag-chosen { box-shadow:0 8px 24px rgba(0,0,0,0.4) !important;border-color:var(--accent) !important;z-index:10; }

.pr-rank {
  display:flex;flex-direction:column;align-items:center;
  gap:4px;flex-shrink:0;width:32px;
}
.rank-num { font-size:0.72rem;color:var(--muted); }
.drag-handle {
  background:none;border:none;color:var(--muted);
  font-size:1.1rem;cursor:grab;padding:2px;
  transition:color 0.15s;line-height:1;
}
.drag-handle:hover { color:var(--accent); }
.drag-handle:active { cursor:grabbing; }

.pr-info { flex:1;min-width:0; }
.pr-name { font-size:0.88rem;font-weight:700;margin-bottom:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
.pr-meta { display:flex;align-items:center;gap:6px;flex-wrap:wrap; }

.pr-progress { flex-shrink:0; }
.pr-priority { flex-shrink:0; }

.save-hint {
  display:flex;align-items:center;justify-content:space-between;
  background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);
  border-radius:var(--radius);padding:12px 16px;margin-top:16px;
  font-size:0.82rem;color:var(--text2);
}

@media(max-width:600px) {
  .pr-progress { display:none; }
  .priority-row { gap:10px; }
}
</style>
