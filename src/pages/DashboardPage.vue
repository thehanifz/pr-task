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

    <!-- Stats row -->
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
      <div class="stat-card c-purple">
        <div class="stat-icon">📈</div>
        <div class="stat-num">{{ store.avgProgress }}%</div>
        <div class="stat-label">Avg Progres</div>
      </div>
    </div>

    <!-- Charts row -->
    <div class="charts-row">
      <div class="card chart-card">
        <div class="section-title">Status Distribusi</div>
        <DonutChart :status-breakdown="store.statusBreakdown" :height="230" />
      </div>
      <div class="card chart-card">
        <div class="section-title">Task per Kategori</div>
        <CategoryChart :cat-breakdown="store.catBreakdown" />
      </div>
      <div class="card chart-card wide">
        <div class="section-title">Progress per Task (Top 10)</div>
        <ProgressBarChart :tasks="store.tasks" />
      </div>
    </div>

    <!-- Bottom row -->
    <div class="bottom-row">
      <!-- Deadlines -->
      <div class="card">
        <div class="section-title">Deadline Terdekat</div>
        <div v-if="!store.upcomingDeadlines.length" class="muted small mono" style="padding:12px 0">
          Tidak ada deadline aktif
        </div>
        <div v-else>
          <div
            v-for="t in store.upcomingDeadlines" :key="t.id"
            class="deadline-item"
            @click="$router.push('/tasks/' + t.id)"
          >
            <div class="dl-dot" :style="{ background: dlDotColor(t.diffDays) }" />
            <div class="dl-info">
              <div class="dl-name">{{ t.name }}</div>
              <div class="mono" style="font-size:0.67rem;color:var(--muted);margin-top:2px">{{ t.target }}</div>
            </div>
            <div style="display:flex;align-items:center;gap:6px">
              <span :class="['badge', dlBadgeCls(t.diffDays)]">{{ dlBadgeText(t.diffDays) }}</span>
              <span class="mono" style="font-size:0.72rem;color:var(--text2)">{{ t.progress }}%</span>
            </div>
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
              <button class="icon-btn danger" style="width:22px;height:22px;font-size:0.7rem" @click="deleteReminder(r)">✕</button>
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
import ProgressBarChart     from '@/components/charts/ProgressBarChart.vue'
import CategoryChart        from '@/components/charts/CategoryChart.vue'
import TaskFormModal        from '@/components/TaskFormModal.vue'
import ReminderFormModal    from '@/components/ReminderFormModal.vue'

const store = useTasksStore()
const toast = useToast()
const showTaskForm     = ref(false)
const showReminderForm = ref(false)

const dateStr = new Date().toLocaleDateString('id-ID', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
})

const REMINDER_TYPE_LABELS = {
  deadline_h3: '⏰ H-3', deadline_h1: '🔴 H-1', deadline_d0: '🚨 Hari-H', custom: '🎯 Custom'
}

const activeReminders = computed(() =>
  store.reminders.filter(r => !r.sent).sort((a,b) => a.sendAt.localeCompare(b.sendAt)).slice(0, 6)
)

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
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px,1fr));
  gap: 12px; margin-bottom: 20px;
}
.stat-card {
  background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);
  padding:16px 18px;position:relative;overflow:hidden;transition:all 0.2s;cursor:pointer;
}
.stat-card::before { content:'';position:absolute;top:0;left:0;right:0;height:3px;border-radius:3px 3px 0 0; }
.stat-card:hover { border-color:var(--border2);transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,0.25); }
.stat-card.c-blue::before   { background:var(--accent); }
.stat-card.c-yellow::before { background:var(--yellow); }
.stat-card.c-green::before  { background:var(--green); }
.stat-card.c-red::before    { background:var(--red); }
.stat-card.c-purple::before { background:var(--purple); }
.stat-icon { font-size:1.2rem;margin-bottom:8px; }
.stat-num  { font-size:1.9rem;font-weight:800;font-family:var(--font-mono);line-height:1; }
.stat-card.c-blue .stat-num   { color:var(--accent); }
.stat-card.c-yellow .stat-num { color:var(--yellow); }
.stat-card.c-green .stat-num  { color:var(--green); }
.stat-card.c-red .stat-num    { color:var(--red); }
.stat-card.c-purple .stat-num { color:var(--purple); }
.stat-label { font-size:0.66rem;color:var(--text2);margin-top:4px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em; }

.charts-row {
  display:grid;grid-template-columns:240px 240px 1fr;
  gap:14px;margin-bottom:16px;align-items:start;
}
.chart-card { padding:18px; }
.chart-card.wide { grid-column:3; }

.bottom-row { display:grid;grid-template-columns:1fr 1fr;gap:14px; }

.deadline-item {
  display:flex;align-items:center;gap:10px;padding:9px 0;
  border-bottom:1px solid var(--border);cursor:pointer;transition:opacity 0.15s;
}
.deadline-item:last-child { border-bottom:none; }
.deadline-item:hover { opacity:0.8; }
.dl-dot { width:8px;height:8px;border-radius:50%;flex-shrink:0; }
.dl-info { flex:1;min-width:0; }
.dl-name { font-size:0.82rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }

.reminder-list { display:flex;flex-direction:column;gap:8px; }
.reminder-item {
  display:flex;align-items:center;justify-content:space-between;
  background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:10px 12px;gap:10px;
}
.ri-left { flex:1;min-width:0; }
.ri-type { font-size:0.78rem;font-weight:700; }
.ri-task { font-size:0.67rem;color:var(--text2);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
.ri-right { display:flex;align-items:center;gap:8px;flex-shrink:0; }

.badge-urgent { background:rgba(239,68,68,0.15);color:var(--red); }
.badge-soon   { background:rgba(245,158,11,0.15);color:var(--yellow); }
.badge-ok     { background:rgba(16,185,129,0.15);color:var(--green); }

@media(max-width:1100px) { .charts-row { grid-template-columns:1fr 1fr; } .chart-card.wide { grid-column:1/-1; } }
@media(max-width:700px)  { .charts-row { grid-template-columns:1fr; } .chart-card.wide { grid-column:1; } .bottom-row { grid-template-columns:1fr; } }
</style>
