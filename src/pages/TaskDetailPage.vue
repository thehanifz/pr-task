<template>
  <div v-if="!task">
    <div class="empty-state">
      <div class="empty-icon">🔍</div>
      <div class="empty-text">Task tidak ditemukan</div>
    </div>
  </div>
  <div v-else>
    <!-- Header -->
    <div class="detail-header">
      <button class="btn btn-ghost btn-sm back-btn" @click="router.back()">← Kembali</button>
      <div class="detail-title-wrap">
        <div class="page-title" style="font-size:1.3rem;line-height:1.3">{{ task.name }}</div>
        <div class="detail-badges">
          <span :class="['badge', STATUS_BADGE[task.status]]">{{ STATUS_LABELS[task.status] }}</span>
          <span :class="['badge', CAT_BADGE[task.cat] || 'cat-other']">{{ CAT_LABELS[task.cat] || task.cat }}</span>
          <span :class="['priority-pill', `priority-${task.priority}`]">
            {{ PSHORT[task.priority] }} · {{ PRIORITY_LABELS[task.priority] }}
          </span>
        </div>
      </div>
    </div>

    <!-- Action bar -->
    <div class="detail-actions">
      <button class="btn btn-ghost btn-sm" @click="showReminderForm = true">⏰ Reminder</button>
      <button class="btn btn-secondary btn-sm" @click="openEdit">✏️ Edit</button>
      <button class="btn btn-primary btn-sm" @click="showLogForm = true">＋ Log</button>
    </div>

    <!-- Info card -->
    <div class="card" style="margin-bottom:14px">
      <p v-if="task.desc" style="color:var(--text2);font-size:0.85rem;line-height:1.7;margin-bottom:14px">
        {{ task.desc }}
      </p>

      <!-- Info grid: tanggal + durasi -->
      <div class="info-grid">
        <div v-if="task.start" class="info-item">
          <div class="info-label">Tanggal Mulai</div>
          <div class="info-val">📅 {{ task.start }}</div>
        </div>
        <div v-if="task.target" class="info-item">
          <div class="info-label">Target Selesai</div>
          <div class="info-val" :style="{ color: deadlineColor }">
            🎯 {{ task.target }}
            <span v-if="diff !== null" class="deadline-sub">
              {{ diff < 0 ? `Lewat ${Math.abs(diff)} hari` : diff === 0 ? 'Hari ini!' : `H-${diff}` }}
            </span>
          </div>
        </div>
        <div v-if="task.doneDate" class="info-item">
          <div class="info-label">Tanggal Selesai</div>
          <div class="info-val" style="color:var(--green)">✅ {{ task.doneDate }}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Durasi Aktif</div>
          <div class="info-val">⏱️ {{ durationText }}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Log Entries</div>
          <div class="info-val">📝 {{ taskLogs.length }} catatan</div>
        </div>
      </div>
    </div>

    <!-- Daily logs -->
    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div class="section-title" style="margin-bottom:0">Log Harian ({{ taskLogs.length }})</div>
        <button class="btn btn-primary btn-sm" @click="showLogForm = true">＋ Tambah Log</button>
      </div>

      <div v-if="!taskLogs.length" class="no-log mono">Belum ada log. Tambah log pertama kamu!</div>
      <div v-else class="log-list">
        <div v-for="l in taskLogs" :key="l.id" class="log-entry">
          <div class="log-top">
            <span class="log-date mono">📅 {{ l.date }}</span>
            <button class="icon-btn danger" style="width:24px;height:24px;font-size:0.7rem" @click="askDeleteLog(l)" title="Hapus log">✕</button>
          </div>
          <div v-if="l.note" style="font-size:0.83rem;color:var(--text2);line-height:1.6;margin-top:6px">{{ l.note }}</div>
        </div>
      </div>
    </div>

    <!-- Modals -->
    <TaskFormModal    v-model="showEditForm"     :task="editTask"              @saved="reload" />
    <LogFormModal     v-model="showLogForm"      :task-id="task.id"            @saved="reload" />
    <ReminderFormModal v-model="showReminderForm" :fixed-task-id="props.id"   @saved="reload" />
    <ConfirmModal     v-model="showDeleteLog"    item-name="log ini"           @confirm="doDeleteLog" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTasksStore } from '@/stores/tasks'
import { useToast } from '@/composables/useToast'
import {
  STATUS_LABELS, STATUS_BADGE,
  CAT_LABELS, CAT_BADGE,
  PRIORITY_LABELS,
  deadlineDiff
} from '@/composables/useTaskHelpers'
import TaskFormModal     from '@/components/TaskFormModal.vue'
import LogFormModal      from '@/components/LogFormModal.vue'
import ConfirmModal      from '@/components/ConfirmModal.vue'
import ReminderFormModal from '@/components/ReminderFormModal.vue'

const PSHORT = { high: 'H', med: 'M', low: 'L' }

const props  = defineProps({ id: String })
const store  = useTasksStore()
const router = useRouter()
const toast  = useToast()

const showEditForm     = ref(false)
const showLogForm      = ref(false)
const showReminderForm = ref(false)
const showDeleteLog    = ref(false)
const editTask         = ref(null)
const deleteLogTarget  = ref(null)

const task     = computed(() => store.getTaskById(props.id))
const taskLogs = computed(() => store.getLogsByTask(props.id))

const diff = computed(() => task.value ? deadlineDiff(task.value.target) : null)

const deadlineColor = computed(() => {
  const d = diff.value
  if (d === null) return ''
  if (d <= 0)  return 'var(--red)'
  if (d <= 3)  return 'var(--yellow)'
  return 'var(--text)'
})

const durationText = computed(() => {
  if (!task.value?.start) return '—'
  const start = new Date(task.value.start)
  const end   = task.value.doneDate ? new Date(task.value.doneDate) : new Date()
  const days  = Math.ceil((end - start) / 86_400_000)
  if (days < 0)  return '—'
  if (days === 0) return 'Hari ini'
  if (days < 7)  return `${days} hari`
  if (days < 30) return `${Math.floor(days / 7)} minggu`
  return `${Math.floor(days / 30)} bulan`
})

function openEdit() { editTask.value = { ...task.value }; showEditForm.value = true }
function askDeleteLog(l) { deleteLogTarget.value = l; showDeleteLog.value = true }
async function doDeleteLog() {
  if (!deleteLogTarget.value) return
  try {
    await store.removeLog(deleteLogTarget.value.id)
    toast.success('Log dihapus')
  } catch (e) {
    toast.error('Gagal hapus log: ' + e.message)
  }
}
async function reload() { await store.loadAll() }

onMounted(() => { if (!store.tasks.length) store.loadAll() })
</script>

<style scoped>
.detail-header {
  display: flex; align-items: flex-start; gap: 12px;
  margin-bottom: 12px;
}
.back-btn { flex-shrink: 0; margin-top: 4px; }
.detail-title-wrap { flex: 1; min-width: 0; }
.detail-badges { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }

.detail-actions {
  display: flex; gap: 8px; flex-wrap: wrap;
  margin-bottom: 18px;
}

/* Priority pill — konsisten dengan TaskCard */
.priority-pill {
  display: inline-flex; align-items: center;
  padding: 3px 10px; border-radius: 99px;
  font-size: 0.68rem; font-weight: 800;
  letter-spacing: 0.03em;
}
.priority-high { background: rgba(239,68,68,0.15); color: var(--red); }
.priority-med  { background: rgba(245,158,11,0.15); color: var(--yellow); }
.priority-low  { background: rgba(107,114,128,0.15); color: var(--muted); }

/* Info grid */
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
}
.info-item {
  background: var(--bg2); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 11px 14px;
}
.info-label {
  font-size: 0.63rem; color: var(--muted);
  text-transform: uppercase; letter-spacing: 0.08em;
  font-family: var(--font-mono); margin-bottom: 4px;
}
.info-val { font-size: 0.86rem; font-weight: 700; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.deadline-sub {
  font-size: 0.7rem; font-weight: 600;
  background: rgba(239,68,68,0.1);
  padding: 1px 6px; border-radius: 99px;
}

/* Log list */
.log-list { display: flex; flex-direction: column; gap: 10px; }
.log-entry {
  background: var(--bg2); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 13px 15px;
}
.log-top {
  display: flex; justify-content: space-between;
  align-items: center;
}
.log-date { font-size: 0.68rem; color: var(--muted); }
.no-log { text-align: center; color: var(--muted); font-size: 0.82rem; padding: 28px; }

@media (max-width: 600px) {
  .detail-actions { gap: 6px; }
  .detail-actions .btn { flex: 1; justify-content: center; }
  .info-grid { grid-template-columns: 1fr 1fr; }
}
</style>
