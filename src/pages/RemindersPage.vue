<template>
  <div>
    <div class="page-header">
      <div>
        <div class="page-title">Reminder Manager</div>
        <div class="page-sub">{{ store.reminders.length }} reminder terdaftar</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" @click="store.loadAll()">🔄 Refresh</button>
        <button class="btn btn-primary" @click="openAdd">＋ Reminder Baru</button>
      </div>
    </div>

    <!-- Filter tabs -->
    <div class="filter-bar">
      <button
        v-for="f in FILTERS" :key="f.value"
        :class="['filter-btn', { active: activeFilter === f.value }]"
        @click="activeFilter = f.value"
      >{{ f.label }} <span class="f-count">{{ countFor(f.value) }}</span></button>
    </div>

    <!-- List -->
    <div v-if="!filtered.length" class="empty-state">
      <div class="empty-icon">⏰</div>
      <div class="empty-text">Belum ada reminder di kategori ini</div>
    </div>

    <div v-else class="reminder-grid">
      <div v-for="r in filtered" :key="r.id" class="reminder-card card">
        <!-- Sent badge -->
        <div v-if="r.sent" class="sent-ribbon">TERKIRIM</div>

        <div class="rc-top">
          <span :class="['badge type-badge', typeBadgeCls(r.type)]">{{ TYPE_LABELS[r.type] || r.type }}</span>
          <div class="rc-actions">
            <button class="icon-btn" title="Edit" @click="openEdit(r)">✏️</button>
            <button class="icon-btn danger" title="Hapus" @click="askDelete(r)">🗑️</button>
          </div>
        </div>

        <!-- Task name -->
        <div class="rc-task">
          <span class="mono" style="font-size:0.65rem;color:var(--muted)">TASK</span>
          <div class="rc-task-name">{{ getTaskName(r.taskId) }}</div>
        </div>

        <!-- Send time -->
        <div class="rc-time">
          <span>📅</span>
          <span class="mono">{{ formatSendAt(r.sendAt) }}</span>
          <span v-if="!r.sent" :class="['badge', timeUrgency(r.sendAt).cls]">{{ timeUrgency(r.sendAt).text }}</span>
        </div>

        <!-- Message preview -->
        <div v-if="r.message" class="rc-msg">{{ r.message }}</div>

        <!-- Webhook indicator -->
        <div class="rc-footer">
          <span class="mono" style="font-size:0.65rem;color:var(--muted)" :title="r.webhookUrl || 'Default webhook'">
            🔗 {{ r.webhookUrl ? 'Custom URL' : 'Default webhook' }}
          </span>
          <div style="display:flex;align-items:center;gap:6px">
            <button
              v-if="!r.sent"
              class="btn btn-ghost btn-sm"
              style="font-size:0.68rem;padding:3px 8px;color:var(--green);border-color:rgba(16,185,129,0.3)"
              :disabled="markingId === r.id"
              @click.stop="markAsSent(r)"
              title="Tandai sudah terkirim manual"
            >{{ markingId === r.id ? '⏳' : '✓ Mark Sent' }}</button>
            <span v-if="r.sent" class="badge badge-done" style="font-size:0.62rem">✅ Terkirim</span>
            <span v-else class="badge badge-progress" style="font-size:0.62rem">⏳ Pending</span>
          </div>
        </div>
      </div>
    </div>

    <!-- GAS Status banner -->
    <div class="gas-banner">
      <div class="gas-icon">⚡</div>
      <div style="flex:1">
        <div style="font-weight:700;font-size:0.88rem">Google Apps Script Scheduler</div>
        <div style="font-size:0.78rem;color:var(--text2);margin-top:2px;line-height:1.5">
          GAS berjalan otomatis di server Google — cek reminder setiap menit dan kirim ke n8n.
          Setup ada di folder <code style="background:var(--bg2);padding:1px 5px;border-radius:4px;font-size:0.75rem">gas/</code>
          ikuti panduan <code style="background:var(--bg2);padding:1px 5px;border-radius:4px;font-size:0.75rem">SETUP_GAS.md</code>.
        </div>
      </div>
      <button class="btn btn-secondary btn-sm" style="flex-shrink:0" @click="sendAllPending">
        📤 Kirim Manual
      </button>
    </div>

    <ReminderFormModal v-model="showForm" :reminder="editTarget" @saved="store.loadAll()" />
    <ConfirmModal v-model="showConfirm" :item-name="`reminder untuk '${deleteTarget?.taskId ? getTaskName(deleteTarget.taskId) : ''}'`" @confirm="doDelete" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useTasksStore }   from '@/stores/tasks'
import { useAuthStore }    from '@/stores/auth'
import { useToast }        from '@/composables/useToast'
import { sendWebhook }     from '@/services/webhook'
import ReminderFormModal   from '@/components/ReminderFormModal.vue'
import ConfirmModal        from '@/components/ConfirmModal.vue'

const store = useTasksStore()
const auth  = useAuthStore()
const toast = useToast()

const FILTERS = [
  { value: 'all',     label: 'Semua' },
  { value: 'pending', label: 'Pending' },
  { value: 'sent',    label: 'Terkirim' }
]

const TYPE_LABELS = {
  deadline_h3: '⏰ H-3 Deadline',
  deadline_h1: '🔴 H-1 Deadline',
  deadline_d0: '🚨 Hari-H',
  custom:      '🎯 Custom'
}

const activeFilter  = ref('all')
const showForm      = ref(false)
const showConfirm   = ref(false)
const editTarget    = ref(null)
const deleteTarget  = ref(null)
const markingId     = ref(null)

const filtered = computed(() => {
  let list = [...store.reminders]
  if (activeFilter.value === 'pending') list = list.filter(r => !r.sent)
  if (activeFilter.value === 'sent')    list = list.filter(r => r.sent)
  return list.sort((a,b) => a.sendAt.localeCompare(b.sendAt))
})

function countFor(f) {
  if (f === 'all')     return store.reminders.length
  if (f === 'pending') return store.reminders.filter(r => !r.sent).length
  if (f === 'sent')    return store.reminders.filter(r => r.sent).length
  return 0
}

function getTaskName(id) { return store.getTaskById(id)?.name || '—' }

function formatSendAt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

function timeUrgency(iso) {
  if (!iso) return { cls: '', text: '' }
  const diffH = (new Date(iso) - Date.now()) / 3_600_000
  if (diffH < 0)   return { cls: 'badge-urgent', text: 'Lewat' }
  if (diffH < 24)  return { cls: 'badge-soon',   text: '< 24 jam' }
  if (diffH < 72)  return { cls: 'badge-soon',   text: '< 3 hari' }
  return { cls: 'badge-ok', text: 'OK' }
}

function typeBadgeCls(type) {
  return { deadline_h3:'type-h3', deadline_h1:'type-h1', deadline_d0:'type-d0', custom:'type-custom' }[type] || ''
}

function openAdd()  { editTarget.value = null; showForm.value = true }
function openEdit(r){ editTarget.value = { ...r }; showForm.value = true }
function askDelete(r){ deleteTarget.value = r; showConfirm.value = true }

async function doDelete() {
  if (!deleteTarget.value) return
  try { await store.removeReminder(deleteTarget.value.id); toast.success('Reminder dihapus') }
  catch(e) { toast.error(e.message) }
}

async function markAsSent(r) {
  markingId.value = r.id
  try {
    await store.markSent(r.id)
    toast.success('Reminder ditandai terkirim ✅')
  } catch(e) {
    toast.error('Gagal: ' + e.message)
  } finally {
    markingId.value = null
  }
}

async function sendAllPending() {
  const pending = store.reminders.filter(r => !r.sent)
  if (!pending.length) return toast.info('Tidak ada reminder pending')
  let sent = 0
  for (const r of pending) {
    const url = r.webhookUrl || auth.webhookUrl
    if (!url) continue
    try {
      const task = store.getTaskById(r.taskId)
      await sendWebhook(url, {
        event: 'task_reminder', reminder_type: r.type,
        task_id: r.taskId, task_name: task?.name || r.taskId,
        progress: task?.progress || 0, deadline: task?.target || '',
        message: r.message || `Reminder: ${task?.name || r.taskId}`
      })
      await store.editReminder({ ...r, sent: true })
      sent++
    } catch(e) { /* continue */ }
  }
  toast.success(`${sent} reminder dikirim ke webhook`)
  await store.loadAll()
}

onMounted(() => { if (!store.tasks.length) store.loadAll() })
</script>

<style scoped>
.filter-bar { display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px; }
.filter-btn {
  padding:6px 14px;border-radius:99px;font-size:0.75rem;font-weight:700;
  border:1px solid var(--border);background:transparent;color:var(--text2);
  display:flex;align-items:center;gap:5px;transition:all 0.15s;
}
.filter-btn.active { background:var(--accent);color:#fff;border-color:var(--accent); }
.filter-btn:hover:not(.active) { border-color:var(--border2);color:var(--text); }
.f-count { background:rgba(255,255,255,0.1);border-radius:99px;padding:1px 6px;font-size:0.65rem;font-family:var(--font-mono); }

.reminder-grid {
  display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));
  gap:12px;margin-bottom:16px;
}
.reminder-card { position:relative;overflow:hidden;padding:16px; }

.sent-ribbon {
  position:absolute;top:10px;right:-20px;
  background:var(--green);color:#fff;
  font-size:0.6rem;font-weight:800;letter-spacing:0.1em;
  padding:3px 28px;transform:rotate(15deg);
  font-family:var(--font-mono);
}

.rc-top { display:flex;align-items:center;justify-content:space-between;margin-bottom:12px; }
.rc-actions { display:flex;gap:4px;opacity:0;transition:opacity 0.15s; }
.reminder-card:hover .rc-actions { opacity:1; }
.type-badge { font-size:0.7rem !important; }
.type-h3  { background:rgba(59,130,246,0.15);color:#60a5fa; }
.type-h1  { background:rgba(239,68,68,0.15);color:var(--red); }
.type-d0  { background:rgba(239,68,68,0.25);color:var(--red); }
.type-custom { background:rgba(139,92,246,0.15);color:#a78bfa; }

.rc-task { margin-bottom:10px; }
.rc-task-name { font-size:0.88rem;font-weight:700;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
.rc-time { display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:0.78rem;flex-wrap:wrap; }
.rc-time .mono { color:var(--text2);font-size:0.75rem; }
.rc-msg { font-size:0.78rem;color:var(--text2);line-height:1.5;margin-bottom:10px;padding:8px 10px;background:var(--bg2);border-radius:6px; }
.rc-footer { display:flex;align-items:center;justify-content:space-between;padding-top:8px;border-top:1px solid var(--border); }

.badge-urgent { background:rgba(239,68,68,0.15);color:var(--red); }
.badge-soon   { background:rgba(245,158,11,0.15);color:var(--yellow); }
.badge-ok     { background:rgba(16,185,129,0.15);color:var(--green); }
.badge-done   { background:rgba(16,185,129,0.15);color:var(--green); }
.badge-progress { background:rgba(59,130,246,0.15);color:var(--accent); }

.gas-banner {
  display:flex;align-items:flex-start;gap:14px;
  background:rgba(245,158,11,0.06);
  border:1px solid rgba(245,158,11,0.2);
  border-radius:var(--radius-lg);padding:16px 18px;
  flex-wrap:wrap;
}
.gas-icon { font-size:1.4rem;flex-shrink:0;margin-top:2px; }
</style>
