<template>
  <div>
    <div class="page-header">
      <div>
        <div class="page-title">Dashboard</div>
        <div class="page-sub">{{ dateStr }}</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" :disabled="store.loading" @click="store.loadAll()">
          {{ store.loading ? '⏳' : '🔄' }} Refresh
        </button>
        <button class="btn btn-primary" @click="showTaskForm = true">＋ Task Baru</button>
      </div>
    </div>

    <!-- KPI stat row -->
    <div class="stat-grid">
      <div class="stat-card c-blue" @click="$router.push('/tasks')">
        <div class="stat-icon">📋</div>
        <div class="stat-num">{{ store.totalTasks }}</div>
        <div class="stat-label">Total Task</div>
      </div>
      <div class="stat-card c-yellow" @click="$router.push('/tasks?status=progress')">
        <div class="stat-icon">🔄</div>
        <div class="stat-num">{{ store.inProgressCount }}</div>
        <div class="stat-label">Sedang Jalan</div>
      </div>
      <div class="stat-card c-green" @click="$router.push('/tasks?status=done')">
        <div class="stat-icon">✅</div>
        <div class="stat-num">{{ store.doneCount }}</div>
        <div class="stat-label">Selesai</div>
      </div>
      <div class="stat-card c-red" @click="$router.push('/tasks?status=todo')">
        <div class="stat-icon">⏳</div>
        <div class="stat-num">{{ store.todoCount }}</div>
        <div class="stat-label">Belum Mulai</div>
      </div>
      <div class="stat-card c-orange" @click="$router.push('/tasks?status=paused')">
        <div class="stat-icon">⏸️</div>
        <div class="stat-num">{{ store.pausedCount }}</div>
        <div class="stat-label">Ditunda</div>
      </div>
      <div class="stat-card c-pink" @click="$router.push('/tasks')">
        <div class="stat-icon">🚨</div>
        <div class="stat-num">{{ overdueCount }}</div>
        <div class="stat-label">Overdue</div>
      </div>
    </div>

    <!-- Overdue alert banner -->
    <div v-if="overdueCount > 0" class="overdue-alert" @click="$router.push('/tasks')">
      <span class="pulse-dot" />
      <strong>{{ overdueCount }} task melewati deadline!</strong>
      <span style="margin-left:4px;color:var(--text2);font-size:0.82rem">Klik untuk lihat.</span>
      <span class="alert-arrow">→</span>
    </div>

    <!-- Charts row -->
    <div class="charts-row">
      <!-- Donut: status -->
      <div class="card chart-card">
        <div class="section-title">Status Distribusi</div>
        <DonutChart :status-breakdown="store.statusBreakdown" :height="220" />
      </div>

      <!-- Donut / pills: kategori -->
      <div class="card chart-card">
        <div class="section-title">Task per Kategori</div>
        <CategoryChart :cat-breakdown="store.catBreakdown" />
      </div>

      <!-- Priority distribution -->
      <div class="card chart-card">
        <div class="section-title">Distribusi Prioritas</div>
        <div class="priority-dist">
          <div v-for="p in priorityDist" :key="p.key" class="pdist-row">
            <div class="pdist-label">
              <span :class="['pil', `pil-${p.key}`]">{{ p.short }}</span>
              {{ p.label }}
            </div>
            <div class="pdist-bar-wrap">
              <div class="pdist-bar" :style="{ width: p.pct + '%', background: p.color }" />
            </div>
            <div class="pdist-count mono">{{ p.count }}</div>
          </div>
        </div>
        <!-- completion rate -->
        <div class="completion-rate">
          <div class="cr-label">Completion Rate</div>
          <div class="cr-value" :style="{ color: completionColor }">{{ completionRate }}%</div>
          <div class="cr-sub">{{ store.doneCount }} dari {{ store.totalTasks }} selesai</div>
        </div>
      </div>
    </div>

    <!-- Bottom row -->
    <div class="bottom-row">
      <!-- Deadlines -->
      <div class="card">
        <div class="section-title">Deadline Terdekat</div>
        <div v-if="!upcomingDeadlines.length" class="muted small mono" style="padding:12px 0">
          Tidak ada deadline aktif
        </div>
        <div v-else>
          <div
            v-for="t in upcomingDeadlines" :key="t.id"
            class="deadline-item"
            @click="$router.push('/tasks/' + t.id)"
          >
            <div class="dl-dot" :style="{ background: dlDotColor(t.diffDays) }" />
            <div class="dl-info">
              <div class="dl-name">{{ t.name }}</div>
              <div style="display:flex;align-items:center;gap:6px;margin-top:3px">
                <span :class="['priority-pill-sm', `pp-${t.priority}`]">{{ PSHORT[t.priority] }}</span>
                <span class="mono" style="font-size:0.67rem;color:var(--muted)">{{ t.target }}</span>
              </div>
            </div>
            <span :class="['badge', dlBadgeCls(t.diffDays)]">{{ dlBadgeText(t.diffDays) }}</span>
          </div>
        </div>
      </div>

      <!-- High priority tasks -->
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
          <div class="section-title" style="margin-bottom:0">🔥 Prioritas Tinggi</div>
          <button class="btn btn-ghost btn-sm" @click="$router.push('/tasks')">Lihat Semua →</button>
        </div>
        <div v-if="!highPriorityTasks.length" class="muted small mono" style="padding:12px 0">
          Tidak ada task prioritas tinggi aktif
        </div>
        <div v-else class="hp-list">
          <div
            v-for="t in highPriorityTasks" :key="t.id"
            class="hp-item"
            @click="$router.push('/tasks/' + t.id)"
          >
            <div class="hp-info">
              <div class="hp-name">{{ t.name }}</div>
              <div class="hp-meta">
                <span :class="['badge', STATUS_BADGE[t.status]]">{{ STATUS_LABELS[t.status] }}</span>
                <span v-if="t.target" class="mono" style="font-size:0.67rem;color:var(--muted)">📅 {{ t.target }}</span>
              </div>
            </div>
            <div class="hp-arrow">›</div>
          </div>
        </div>
      </div>

      <!-- Active reminders -->
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <div class="section-title" style="margin-bottom:0">Reminder Aktif</div>
          <button class="btn btn-ghost btn-sm" @click="showReminderForm = true">＋ Tambah</button>
        </div>
        <div v-if="!activeReminders.length" class="muted small mono" style="padding:12px 0">
          Belum ada reminder aktif
        </div>
        <div v-else class="reminder-list">
          <div v-for="r in activeReminders" :key="r.id" class="reminder-item">
            <div class="ri-left">
              <div class="ri-type">{{ REMINDER_TYPE_LABELS[r.type] || r.type }}</div>
              <div class="ri-task mono">{{ getTaskName(r.taskId) }}</div>
            </div>
            <div class="ri-right">
              <div class="mono" style="font-size:0.68rem;color:var(--text2)">{{ formatSendAt(r.sendAt) }}</div>
              <button class="icon-btn danger" style="width:22px;height:22px;font-size:0.7rem" @click.stop="deleteReminder(r)">✕</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <TaskFormModal v-model="showTaskForm" :task="null" @saved="store.loadAll()" />
    <ReminderFormModal v-model="showReminderForm" @saved="store.loadAll()" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useTasksStore }    from '@/stores/tasks'
import { useToast }         from '@/composables/useToast'
import DonutChart           from '@/components/charts/DonutChart.vue'
import CategoryChart        from '@/components/charts/CategoryChart.vue'
import TaskFormModal        from '@/components/TaskFormModal.vue'
import ReminderFormModal    from '@/components/ReminderFormModal.vue'
import { STATUS_LABELS, STATUS_BADGE } from '@/composables/useTaskHelpers'

const store = useTasksStore()
const toast = useToast()
const showTaskForm     = ref(false)
const showReminderForm = ref(false)

const PSHORT = { high: 'H', med: 'M', low: 'L' }
const REMINDER_TYPE_LABELS = {
  deadline_h3: '⏰ H-3', deadline_h1: '🔴 H-1', deadline_d0: '🚨 Hari-H', custom: '🎯 Custom'
}

const dateStr = new Date().toLocaleDateString('id-ID', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
})

// ── Computed ────────────────────────────────────────────────
const activeTasks = computed(() => store.tasks.filter(t => t.status !== 'done'))

const overdueCount = computed(() => {
  const now = new Date(); now.setHours(0,0,0,0)
  return store.tasks.filter(t => {
    if (!t.target || t.status === 'done') return false
    return new Date(t.target) < now
  }).length
})

const completionRate = computed(() => {
  if (!store.totalTasks) return 0
  return Math.round((store.doneCount / store.totalTasks) * 100)
})
const completionColor = computed(() => {
  const r = completionRate.value
  if (r >= 70) return 'var(--green)'
  if (r >= 40) return 'var(--yellow)'
  return 'var(--red)'
})

const priorityDist = computed(() => {
  const all = activeTasks.value
  const total = all.length || 1
  const high = all.filter(t => t.priority === 'high').length
  const med  = all.filter(t => t.priority === 'med').length
  const low  = all.filter(t => t.priority === 'low').length
  return [
    { key: 'high', short: 'H', label: 'Tinggi', count: high, pct: Math.round(high/total*100), color: 'var(--red)' },
    { key: 'med',  short: 'M', label: 'Sedang', count: med,  pct: Math.round(med/total*100),  color: 'var(--yellow)' },
    { key: 'low',  short: 'L', label: 'Rendah', count: low,  pct: Math.round(low/total*100),  color: 'var(--muted)' }
  ]
})

const upcomingDeadlines = computed(() => {
  const now = new Date(); now.setHours(0,0,0,0)
  return store.tasks
    .filter(t => t.target && t.status !== 'done')
    .map(t => {
      const diff = Math.ceil((new Date(t.target) - now) / 86400000)
      return { ...t, diffDays: diff }
    })
    .sort((a,b) => a.diffDays - b.diffDays)
    .slice(0, 7)
})

const highPriorityTasks = computed(() =>
  activeTasks.value
    .filter(t => t.priority === 'high')
    .sort((a,b) => {
      const statusOrder = { progress: 0, todo: 1, paused: 2 }
      return (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3)
    })
    .slice(0, 6)
)

const activeReminders = computed(() =>
  store.reminders.filter(r => !r.sent).sort((a,b) => a.sendAt.localeCompare(b.sendAt)).slice(0, 5)
)

// ── Helpers ─────────────────────────────────────────────────
function getTaskName(id) { return store.getTaskById(id)?.name || id }
function formatSendAt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
}
async function deleteReminder(r) {
  try { await store.removeReminder(r.id); toast.success('Reminder dihapus') }
  catch(e) { toast.error(e.message) }
}
function dlDotColor(d) { return d <= 0 ? 'var(--red)' : d <= 3 ? 'var(--yellow)' : 'var(--green)' }
function dlBadgeCls(d)  { return d <= 0 ? 'badge-urgent' : d <= 3 ? 'badge-soon' : 'badge-ok' }
function dlBadgeText(d) { return d < 0 ? `Lewat ${Math.abs(d)}h` : d === 0 ? 'HARI INI' : `H-${d}` }

onMounted(() => { if (!store.tasks.length) store.loadAll() })
</script>

<style scoped>
/* ── KPI grid ── */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 12px; margin-bottom: 14px;
}
.stat-card {
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg);
  padding: 16px 18px; position: relative; overflow: hidden; transition: all 0.2s; cursor: pointer;
}
.stat-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; border-radius: 3px 3px 0 0; }
.stat-card:hover { border-color: var(--border2); transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.25); }
.stat-card.c-blue::before   { background: var(--accent); }
.stat-card.c-yellow::before { background: var(--yellow); }
.stat-card.c-green::before  { background: var(--green); }
.stat-card.c-red::before    { background: var(--red); }
.stat-card.c-orange::before { background: #f97316; }
.stat-card.c-pink::before   { background: #ec4899; }
.stat-icon { font-size: 1.2rem; margin-bottom: 8px; }
.stat-num  { font-size: 1.9rem; font-weight: 800; font-family: var(--font-mono); line-height: 1; }
.stat-card.c-blue .stat-num   { color: var(--accent); }
.stat-card.c-yellow .stat-num { color: var(--yellow); }
.stat-card.c-green .stat-num  { color: var(--green); }
.stat-card.c-red .stat-num    { color: var(--red); }
.stat-card.c-orange .stat-num { color: #f97316; }
.stat-card.c-pink .stat-num   { color: #ec4899; }
.stat-label { font-size: 0.66rem; color: var(--text2); margin-top: 4px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; }

/* ── Overdue alert ── */
.overdue-alert {
  display: flex; align-items: center; gap: 8px;
  background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.35);
  border-radius: var(--radius); padding: 10px 16px;
  margin-bottom: 14px; cursor: pointer; transition: opacity 0.15s;
  font-size: 0.84rem; color: var(--red);
}
.overdue-alert:hover { opacity: 0.8; }
.pulse-dot {
  width: 8px; height: 8px; border-radius: 50%; background: var(--red); flex-shrink: 0;
  animation: pulse 1.5s ease-in-out infinite;
}
@keyframes pulse { 0%,100% { opacity:1; transform:scale(1) } 50% { opacity:0.5; transform:scale(1.4) } }
.alert-arrow { margin-left: auto; font-size: 1rem; }

/* ── Charts row ── */
.charts-row {
  display: grid; grid-template-columns: 230px 230px 1fr;
  gap: 14px; margin-bottom: 16px; align-items: start;
}
.chart-card { padding: 18px; }

/* Priority distribution */
.priority-dist { display: flex; flex-direction: column; gap: 14px; margin-top: 8px; }
.pdist-row { display: flex; align-items: center; gap: 10px; }
.pdist-label {
  display: flex; align-items: center; gap: 7px;
  font-size: 0.78rem; font-weight: 700; width: 80px; flex-shrink: 0;
}
.pil {
  display: inline-flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; border-radius: 99px;
  font-size: 0.68rem; font-weight: 900; flex-shrink: 0;
}
.pil-high { background: rgba(239,68,68,0.2); color: var(--red); }
.pil-med  { background: rgba(245,158,11,0.2); color: var(--yellow); }
.pil-low  { background: rgba(107,114,128,0.2); color: var(--muted); }
.pdist-bar-wrap {
  flex: 1; height: 8px; background: var(--surface2);
  border-radius: 99px; overflow: hidden;
}
.pdist-bar { height: 100%; border-radius: 99px; transition: width 0.5s ease; }
.pdist-count { font-size: 0.75rem; font-weight: 800; font-family: var(--font-mono); width: 24px; text-align: right; }

.completion-rate {
  margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border);
  text-align: center;
}
.cr-label { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); font-weight: 700; }
.cr-value { font-size: 2rem; font-weight: 900; font-family: var(--font-mono); line-height: 1.1; margin: 4px 0 2px; }
.cr-sub { font-size: 0.7rem; color: var(--text2); }

/* ── Bottom row ── */
.bottom-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }

.deadline-item {
  display: flex; align-items: center; gap: 10px; padding: 9px 0;
  border-bottom: 1px solid var(--border); cursor: pointer; transition: opacity 0.15s;
}
.deadline-item:last-child { border-bottom: none; }
.deadline-item:hover { opacity: 0.8; }
.dl-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.dl-info { flex: 1; min-width: 0; }
.dl-name { font-size: 0.82rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* Priority pill small */
.priority-pill-sm {
  display: inline-flex; align-items: center; justify-content: center;
  width: 16px; height: 16px; border-radius: 99px;
  font-size: 0.6rem; font-weight: 900; flex-shrink: 0;
}
.pp-high { background: rgba(239,68,68,0.2); color: var(--red); }
.pp-med  { background: rgba(245,158,11,0.2); color: var(--yellow); }
.pp-low  { background: rgba(107,114,128,0.2); color: var(--muted); }

/* High priority list */
.hp-list { display: flex; flex-direction: column; gap: 6px; }
.hp-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: var(--radius);
  background: var(--bg2); border: 1px solid var(--border);
  cursor: pointer; transition: all 0.15s;
}
.hp-item:hover { border-color: var(--red); background: rgba(239,68,68,0.05); }
.hp-info { flex: 1; min-width: 0; }
.hp-name { font-size: 0.82rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px; }
.hp-meta { display: flex; align-items: center; gap: 8px; }
.hp-arrow { font-size: 1.1rem; color: var(--muted); }

/* Reminders */
.reminder-list { display: flex; flex-direction: column; gap: 8px; }
.reminder-item {
  display: flex; align-items: center; justify-content: space-between;
  background: var(--bg2); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 10px 12px; gap: 10px;
}
.ri-left { flex: 1; min-width: 0; }
.ri-type { font-size: 0.78rem; font-weight: 700; }
.ri-task { font-size: 0.67rem; color: var(--text2); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ri-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

.badge-urgent { background: rgba(239,68,68,0.15); color: var(--red); }
.badge-soon   { background: rgba(245,158,11,0.15); color: var(--yellow); }
.badge-ok     { background: rgba(16,185,129,0.15); color: var(--green); }

@media (max-width: 1200px) {
  .charts-row { grid-template-columns: 1fr 1fr; }
  .bottom-row { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 900px) {
  .charts-row { grid-template-columns: 1fr; }
  .bottom-row { grid-template-columns: 1fr; }
}
@media (max-width: 600px) {
  .stat-grid { grid-template-columns: repeat(3, 1fr); }
}
</style>
