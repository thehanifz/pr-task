<template>
  <div>
    <div class="page-header">
      <div>
        <div class="page-title">Reminder Manager</div>
        <div class="page-sub">{{ store.reminders.length }} reminder terdaftar</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" @click="store.loadAll()">🔄 Refresh</button>
        <button class="btn btn-gas" @click="showGasModal = true" title="Copy script GAS ke Apps Script">⚡ GAS Script</button>
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
          Klik <strong style="color:var(--yellow)">⚡ GAS Script</strong> di atas untuk copy script langsung ke clipboard.
        </div>
      </div>
      <button class="btn btn-gas btn-sm" style="flex-shrink:0" @click="showGasModal = true">
        ⚡ Copy GAS Script
      </button>
    </div>

    <!-- ============ GAS MODAL ============ -->
    <div v-if="showGasModal" class="gas-overlay" @click.self="showGasModal = false">
      <div class="gas-modal">
        <!-- Header -->
        <div class="gm-header">
          <div>
            <div class="gm-title">⚡ Google Apps Script</div>
            <div class="gm-sub">Paste script ini ke Google Apps Script untuk scheduler otomatis</div>
          </div>
          <button class="icon-btn" @click="showGasModal = false">✕</button>
        </div>

        <!-- Info injected -->
        <div class="gm-info">
          <div class="gm-info-row">
            <span class="gm-info-label">📊 Sheet ID</span>
            <span class="gm-info-val mono">{{ auth.sheetId || '(belum diset)' }}</span>
          </div>
          <div class="gm-info-row">
            <span class="gm-info-label">🔗 Webhook</span>
            <span class="gm-info-val mono">{{ auth.webhookUrl || '(belum diset)' }}</span>
          </div>
          <div v-if="!auth.sheetId || !auth.webhookUrl" class="gm-warn">
            ⚠️ Sheet ID / Webhook belum diset. Isi dulu di <strong>Pengaturan</strong> agar ter-inject otomatis.
          </div>
        </div>

        <!-- Steps -->
        <div class="gm-steps">
          <div class="gm-step"><span class="step-num">1</span> Buka <a href="https://script.google.com" target="_blank" rel="noopener">script.google.com</a> → Buat project baru</div>
          <div class="gm-step"><span class="step-num">2</span> Hapus kode default, paste script ini</div>
          <div class="gm-step"><span class="step-num">3</span> Simpan (Ctrl+S), lalu jalankan <code>setupTriggers()</code></div>
          <div class="gm-step"><span class="step-num">4</span> Izinkan akses Google Sheets saat diminta</div>
        </div>

        <!-- Code block -->
        <div class="gm-code-wrap">
          <div class="gm-code-header">
            <span class="mono" style="font-size:0.72rem;color:var(--muted)">scheduler.gs</span>
            <div style="display:flex;gap:8px">
              <button
                class="btn btn-gas btn-sm"
                @click="copyGasScript"
              >
                {{ copied ? '✅ Tersalin!' : '📋 Copy Semua' }}
              </button>
            </div>
          </div>
          <pre class="gm-code"><code>{{ gasScriptWithConfig }}</code></pre>
        </div>
      </div>
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
const showGasModal  = ref(false)
const editTarget    = ref(null)
const deleteTarget  = ref(null)
const markingId     = ref(null)
const copied        = ref(false)

// ── GAS Script dengan config ter-inject ──
const GAS_TEMPLATE = `/**
 * PR Task Manager — Google Apps Script Scheduler
 * ================================================
 * Mendukung one-shot dan recurring reminders.
 *
 * Kolom reminders:
 * A: id | B: task_id | C: tipe | D: waktu_kirim | E: pesan
 * F: terkirim | G: webhook_url | H: recurring | I: recurring_type
 * J: recurring_days | K: recurring_time | L: recurring_end
 */

const CONFIG = {
  SPREADSHEET_ID: '__SHEET_ID__',
  DEFAULT_WEBHOOK: '__WEBHOOK__',
  SHEET_TASKS:     'tasks',
  SHEET_REMINDERS: 'reminders',

  COL_REM: {
    ID: 0, TASK_ID: 1, TYPE: 2, SEND_AT: 3, MESSAGE: 4,
    SENT: 5, WEBHOOK_URL: 6,
    RECURRING: 7, RECURRING_TYPE: 8, RECURRING_DAYS: 9,
    RECURRING_TIME: 10, RECURRING_END: 11
  },

  COL_TASK: {
    ID: 0, NAME: 1, CAT: 3, STATUS: 7, PROGRESS: 8, TARGET: 6
  }
}

// =============================================
// ENTRY POINT
// =============================================
function checkAndSendReminders() {
  try {
    const ss        = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
    const remSheet  = ss.getSheetByName(CONFIG.SHEET_REMINDERS)
    const taskSheet = ss.getSheetByName(CONFIG.SHEET_TASKS)
    if (!remSheet || !taskSheet) { Logger.log('Sheet tidak ditemukan'); return }

    const now      = new Date()
    const remData  = remSheet.getDataRange().getValues()
    const taskData = taskSheet.getDataRange().getValues()

    const taskMap = {}
    for (let i = 1; i < taskData.length; i++) {
      const r = taskData[i]
      if (r[CONFIG.COL_TASK.ID]) taskMap[r[CONFIG.COL_TASK.ID]] = r
    }

    let sentCount = 0

    for (let i = 1; i < remData.length; i++) {
      const row       = remData[i]
      const id        = row[CONFIG.COL_REM.ID]
      const taskId    = row[CONFIG.COL_REM.TASK_ID]
      const type      = row[CONFIG.COL_REM.TYPE]
      const sendAt    = row[CONFIG.COL_REM.SEND_AT]
      const msg       = row[CONFIG.COL_REM.MESSAGE]
      const sentRaw   = row[CONFIG.COL_REM.SENT]
      const sent      = sentRaw === true || sentRaw === 'TRUE'
      const wh        = row[CONFIG.COL_REM.WEBHOOK_URL]
      const recurring      = row[CONFIG.COL_REM.RECURRING] === true || row[CONFIG.COL_REM.RECURRING] === 'TRUE'
      const recurringType  = (row[CONFIG.COL_REM.RECURRING_TYPE] || 'daily').toString().trim().toLowerCase()
      const recurringDays  = row[CONFIG.COL_REM.RECURRING_DAYS] || ''
      const recurringTime  = row[CONFIG.COL_REM.RECURRING_TIME] || '08:00'
      const recurringEnd   = row[CONFIG.COL_REM.RECURRING_END]  || ''

      if (!id) continue
      if (!recurring && sent) continue

      if (recurring && sent) {
        const endDate = recurringEnd ? new Date(recurringEnd) : null
        if (!endDate || new Date() <= endDate) {
          remSheet.getRange(i + 1, CONFIG.COL_REM.SENT + 1).setValue(false)
          Logger.log('🔄 Reset sent→FALSE untuk recurring: ' + id)
        } else {
          Logger.log('⏹️ Recurring sudah berakhir: ' + id)
          continue
        }
      }

      const sendTime = sendAt instanceof Date ? sendAt : new Date(sendAt)
      if (isNaN(sendTime.getTime())) continue
      if (sendTime > now) continue

      if (recurring && recurringEnd) {
        const endDate = new Date(recurringEnd)
        endDate.setHours(23, 59, 59)
        if (now > endDate) {
          remSheet.getRange(i + 1, CONFIG.COL_REM.SENT + 1).setValue(true)
          Logger.log('⏹️ Recurring berakhir saat kirim: ' + id)
          continue
        }
      }

      const task      = taskMap[taskId] || null
      const taskName  = task ? task[CONFIG.COL_TASK.NAME]     : taskId
      const progress  = task ? task[CONFIG.COL_TASK.PROGRESS] : 0
      const deadline  = task ? task[CONFIG.COL_TASK.TARGET]   : ''
      const category  = task ? task[CONFIG.COL_TASK.CAT]      : ''
      const status    = task ? task[CONFIG.COL_TASK.STATUS]   : ''
      const message   = msg || buildMessage(type, taskName, progress, deadline, recurring)
      const webhookUrl = (wh && wh.toString().startsWith('http')) ? wh.toString() : CONFIG.DEFAULT_WEBHOOK

      if (!webhookUrl) { Logger.log('Webhook kosong: ' + id); continue }

      const success = sendToWebhook(webhookUrl, {
        event:          'task_reminder',
        reminder_id:    id,
        reminder_type:  type,
        recurring:      recurring,
        recurring_type: recurringType,
        task_id:        taskId,
        task_name:      taskName,
        task_category:  category,
        task_status:    status,
        progress:       progress,
        deadline:       deadline,
        message:        message,
        sent_at:        now.toISOString(),
        source:         'PR Task Manager GAS'
      })

      if (success) {
        sentCount++
        if (recurring) {
          const nextSendAt = calcNextSendAt(sendTime, recurringType, recurringDays, recurringTime)
          if (nextSendAt) {
            remSheet.getRange(i + 1, CONFIG.COL_REM.SEND_AT + 1).setValue(nextSendAt.toISOString())
            Logger.log('✅ Recurring terkirim: ' + id + ' | Next: ' + nextSendAt.toISOString())
          }
        } else {
          remSheet.getRange(i + 1, CONFIG.COL_REM.SENT + 1).setValue(true)
          Logger.log('✅ One-shot terkirim: ' + id + ' → ' + taskName)
        }
      } else {
        Logger.log('❌ Gagal kirim: ' + id)
      }

      Utilities.sleep(300)
    }

    Logger.log('Selesai. Total terkirim: ' + sentCount)
  } catch(e) {
    Logger.log('ERROR: ' + e.toString())
  }
}

// =============================================
// HITUNG NEXT SEND AT
// =============================================
function calcNextSendAt(fromDate, type, days, time) {
  const d = new Date(fromDate)
  let hh = 8, mm = 0
  if (time instanceof Date) {
    hh = time.getHours(); mm = time.getMinutes()
  } else {
    const parts = (time ? time.toString() : '08:00').split(':')
    hh = parseInt(parts[0]) || 8; mm = parseInt(parts[1]) || 0
  }
  if (type === 'daily') { d.setDate(d.getDate() + 1); d.setHours(hh, mm, 0, 0); return d }
  if (type === 'interval') { d.setDate(d.getDate() + (parseInt(days) || 7)); d.setHours(hh, mm, 0, 0); return d }
  if (type === 'weekly') {
    const dayList = days ? days.toString().split(',').map(Number).sort() : [1]
    const curDay  = d.getDay()
    const nextDay = dayList.find(x => x > curDay) ?? dayList[0]
    const diff    = nextDay > curDay ? nextDay - curDay : 7 - curDay + nextDay
    d.setDate(d.getDate() + diff); d.setHours(hh, mm, 0, 0); return d
  }
  if (type === 'monthly') { d.setMonth(d.getMonth() + 1); d.setDate(parseInt(days) || 1); d.setHours(hh, mm, 0, 0); return d }
  return null
}

// =============================================
// BUILD PESAN
// =============================================
function buildMessage(type, taskName, progress, deadline, recurring) {
  const recTag = recurring ? ' 🔁' : ''
  const msgs = {
    'deadline_h3': '⏰ Reminder' + recTag + ': "' + taskName + '" deadline dalam 3 hari (' + deadline + ') — progress ' + progress + '%',
    'deadline_h1': '🔴 Deadline besok!' + recTag + ' "' + taskName + '" — progress ' + progress + '%',
    'deadline_d0': '🚨 HARI INI deadline: "' + taskName + '" — progress ' + progress + '%',
    'custom':      '📌 Reminder' + recTag + ': "' + taskName + '" — progress ' + progress + '%'
  }
  return msgs[type] || msgs['custom']
}

// =============================================
// KIRIM KE WEBHOOK
// =============================================
function sendToWebhook(url, payload) {
  try {
    const res  = UrlFetchApp.fetch(url, {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify(payload), muteHttpExceptions: true
    })
    const code = res.getResponseCode()
    Logger.log('Webhook ' + code + ': ' + res.getContentText().slice(0, 80))
    return code >= 200 && code < 300
  } catch(e) {
    Logger.log('Webhook error: ' + e.toString())
    return false
  }
}

// =============================================
// DAILY DIGEST
// =============================================
function sendDailyDigest() {
  try {
    const ss        = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
    const taskSheet = ss.getSheetByName(CONFIG.SHEET_TASKS)
    if (!taskSheet || !CONFIG.DEFAULT_WEBHOOK) return
    const taskData = taskSheet.getDataRange().getValues()
    const tasks    = taskData.slice(1).filter(r => r[0])
    const today    = new Date(); today.setHours(0,0,0,0)
    const inProgress = tasks.filter(r => r[CONFIG.COL_TASK.STATUS] === 'progress')
    const overdue    = tasks.filter(r => {
      if (!r[CONFIG.COL_TASK.TARGET] || r[CONFIG.COL_TASK.STATUS] === 'done') return false
      const d = new Date(r[CONFIG.COL_TASK.TARGET]); d.setHours(0,0,0,0)
      return d < today
    })
    const dueToday = tasks.filter(r => {
      if (!r[CONFIG.COL_TASK.TARGET] || r[CONFIG.COL_TASK.STATUS] === 'done') return false
      const d = new Date(r[CONFIG.COL_TASK.TARGET]); d.setHours(0,0,0,0)
      return d.getTime() === today.getTime()
    })
    sendToWebhook(CONFIG.DEFAULT_WEBHOOK, {
      event:  'daily_digest',
      date:   today.toISOString().split('T')[0],
      summary: { total: tasks.length, in_progress: inProgress.length, overdue: overdue.length, due_today: dueToday.length },
      overdue_tasks:   overdue.map(r  => ({ name: r[1], deadline: r[6], progress: r[8] })),
      due_today_tasks: dueToday.map(r => ({ name: r[1], deadline: r[6], progress: r[8] })),
      message: '📋 Daily Digest | Total: ' + tasks.length + ' | Jalan: ' + inProgress.length + ' | Deadline hari ini: ' + dueToday.length + ' | Terlambat: ' + overdue.length,
      source:  'PR Task Manager GAS'
    })
    Logger.log('Daily digest terkirim')
  } catch(e) { Logger.log('ERROR digest: ' + e.toString()) }
}

// =============================================
// SETUP TRIGGER
// =============================================
function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t))
  ScriptApp.newTrigger('checkAndSendReminders').timeBased().everyMinutes(1).create()
  ScriptApp.newTrigger('sendDailyDigest').timeBased().everyDays(1).atHour(7).create()
  Logger.log('✅ Triggers terpasang: checkAndSendReminders (1 menit) + sendDailyDigest (07:00)')
}

function removeTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t))
  Logger.log('Semua trigger dihapus.')
}

function testConnection() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
    Logger.log('✅ Spreadsheet: ' + ss.getName())
    const remSheet  = ss.getSheetByName(CONFIG.SHEET_REMINDERS)
    const taskSheet = ss.getSheetByName(CONFIG.SHEET_TASKS)
    Logger.log(remSheet  ? '✅ Sheet reminders: ' + (remSheet.getLastRow()-1)  + ' baris' : '❌ Sheet reminders tidak ada')
    Logger.log(taskSheet ? '✅ Sheet tasks: '    + (taskSheet.getLastRow()-1)  + ' baris' : '❌ Sheet tasks tidak ada')
    if (CONFIG.DEFAULT_WEBHOOK && !CONFIG.DEFAULT_WEBHOOK.includes('GANTI')) {
      const ok = sendToWebhook(CONFIG.DEFAULT_WEBHOOK, { event: 'test_connection', message: '✅ GAS Scheduler siap!', source: 'PR Task Manager GAS' })
      Logger.log(ok ? '✅ Webhook test OK' : '❌ Webhook test gagal')
    }
  } catch(e) { Logger.log('❌ Error: ' + e.toString()) }
}`

const gasScriptWithConfig = computed(() => {
  return GAS_TEMPLATE
    .replace('__SHEET_ID__', auth.sheetId || 'GANTI_DENGAN_SPREADSHEET_ID')
    .replace('__WEBHOOK__', auth.webhookUrl || 'GANTI_DENGAN_WEBHOOK_URL')
})

async function copyGasScript() {
  try {
    await navigator.clipboard.writeText(gasScriptWithConfig.value)
    copied.value = true
    toast.success('✅ Script GAS tersalin ke clipboard!')
    setTimeout(() => { copied.value = false }, 3000)
  } catch (e) {
    toast.error('Gagal copy: ' + e.message)
  }
}

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

/* GAS BUTTON */
.btn-gas {
  background: rgba(245,158,11,0.12);
  color: #f59e0b;
  border: 1px solid rgba(245,158,11,0.3);
  padding: 7px 14px;
  border-radius: var(--radius, 8px);
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  gap: 6px;
}
.btn-gas:hover { background: rgba(245,158,11,0.22); }
.btn-gas.btn-sm { padding: 5px 10px; font-size: 0.72rem; }

/* GAS MODAL */
.gas-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.65);
  z-index: 1000;
  display: flex; align-items: center; justify-content: center;
  padding: 16px;
}
.gas-modal {
  background: var(--bg, #0f1117);
  border: 1px solid var(--border, #1e2330);
  border-radius: 14px;
  width: 100%; max-width: 860px;
  max-height: 90vh;
  overflow-y: auto;
  display: flex; flex-direction: column;
  gap: 0;
}
.gm-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  padding: 20px 24px 14px;
  border-bottom: 1px solid var(--border);
}
.gm-title { font-size: 1.05rem; font-weight: 800; }
.gm-sub   { font-size: 0.76rem; color: var(--muted); margin-top: 3px; }

.gm-info {
  padding: 14px 24px;
  background: var(--surface, #1a2035);
  border-bottom: 1px solid var(--border);
  display: flex; flex-direction: column; gap: 8px;
}
.gm-info-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.gm-info-label { font-size: 0.72rem; font-weight: 700; color: var(--muted); width: 80px; flex-shrink: 0; }
.gm-info-val { font-size: 0.75rem; color: var(--text2); word-break: break-all; }
.gm-warn {
  font-size: 0.73rem; color: #f59e0b;
  background: rgba(245,158,11,0.08);
  border: 1px solid rgba(245,158,11,0.2);
  border-radius: 6px; padding: 8px 12px;
  margin-top: 4px;
}

.gm-steps {
  padding: 14px 24px;
  display: flex; flex-direction: column; gap: 8px;
  border-bottom: 1px solid var(--border);
}
.gm-step {
  display: flex; align-items: center; gap: 10px;
  font-size: 0.8rem; color: var(--text2);
}
.gm-step a { color: var(--accent); text-decoration: none; }
.gm-step a:hover { text-decoration: underline; }
.gm-step code { background: var(--bg2, #1a1f2e); padding: 1px 6px; border-radius: 4px; font-size: 0.73rem; color: var(--green); }
.step-num {
  width: 22px; height: 22px; border-radius: 50%;
  background: rgba(245,158,11,0.15); color: #f59e0b;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.7rem; font-weight: 800; flex-shrink: 0;
}

.gm-code-wrap { padding: 0 0 4px; }
.gm-code-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 24px;
  background: var(--surface, #1a2035);
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  position: sticky; top: 0; z-index: 1;
}
.gm-code {
  margin: 0;
  padding: 16px 24px;
  font-family: var(--font-mono, monospace);
  font-size: 0.72rem;
  line-height: 1.6;
  color: var(--text2, #9ca3af);
  white-space: pre;
  overflow-x: auto;
  background: transparent;
  max-height: 400px;
  overflow-y: auto;
}

@media (max-width: 600px) {
  .gas-modal { max-height: 100vh; border-radius: 0; }
  .gm-code { font-size: 0.65rem; }
}
</style>
