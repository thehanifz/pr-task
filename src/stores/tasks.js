import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from './auth'
import {
  loadAllData,
  rowToTask, rowToLog, rowToReminder,
  createTask, updateTask, deleteTask, updateTaskProgress,
  createLog, deleteLog,
  createReminder, updateReminder, deleteReminder, markReminderSent,
  batchUpdateTasks
} from '@/services/googleSheets'

export const useTasksStore = defineStore('tasks', () => {
  const auth = useAuthStore()

  const tasks      = ref([])
  const logs       = ref([])
  const reminders  = ref([])
  const loading    = ref(false)
  const connStatus = ref('idle')
  const connMsg    = ref('')

  const totalTasks      = computed(() => tasks.value.length)
  const inProgressCount = computed(() => tasks.value.filter(t => t.status === 'progress').length)
  const doneCount       = computed(() => tasks.value.filter(t => t.status === 'done').length)
  const todoCount       = computed(() => tasks.value.filter(t => t.status === 'todo').length)
  const pausedCount     = computed(() => tasks.value.filter(t => t.status === 'paused').length)
  const avgProgress     = computed(() => {
    if (!tasks.value.length) return 0
    return Math.round(tasks.value.reduce((s, t) => s + t.progress, 0) / tasks.value.length)
  })
  const statusBreakdown = computed(() => ({
    todo: todoCount.value, progress: inProgressCount.value,
    done: doneCount.value, paused:   pausedCount.value
  }))
  const catBreakdown = computed(() => {
    const map = {}
    tasks.value.forEach(t => { map[t.cat] = (map[t.cat] || 0) + 1 })
    return map
  })

  function getTaskById(id)        { return tasks.value.find(t => t.id === id) }
  function getLogsByTask(taskId)  { return logs.value.filter(l => l.taskId === taskId).sort((a, b) => b.date.localeCompare(a.date)) }
  function getRemindersByTask(id) { return reminders.value.filter(r => r.taskId === id) }

  const sortedTasks = computed(() => [...tasks.value].sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999)))

  const upcomingDeadlines = computed(() => {
    const today = new Date(); today.setHours(0,0,0,0)
    return tasks.value
      .filter(t => t.target && t.status !== 'done')
      .map(t => { const d = new Date(t.target); d.setHours(0,0,0,0); return { ...t, diffDays: Math.ceil((d - today) / 86_400_000) } })
      .sort((a, b) => a.diffDays - b.diffDays).slice(0, 8)
  })

  async function loadAll() {
    if (!auth.sheetId || !auth.isOAuthReady) {
      connStatus.value = 'error'
      connMsg.value    = !auth.isOAuthReady ? 'Belum login Google' : 'Sheet ID belum diisi'
      return
    }
    loading.value    = true
    connStatus.value = 'loading'
    connMsg.value    = 'Memuat data...'
    try {
      const ranges = await loadAllData(auth.sheetId)
      tasks.value = (ranges[0]?.values || []).slice(1).map((r, i) => rowToTask(r, i + 2)).filter(t => t.id)
      logs.value  = (ranges[1]?.values || []).slice(1).map((r, i) => rowToLog(r,  i + 2)).filter(l => l.id)
      reminders.value = (ranges[2]?.values || []).slice(1).map((r, i) => rowToReminder(r, i + 2)).filter(r => r.id)
      connStatus.value = 'ok'
      connMsg.value    = '● Sheets Connected'
    } catch (e) {
      connStatus.value = 'error'
      connMsg.value    = e.message || 'Gagal memuat data'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function addTask(taskData) {
    const task = { id: genId('T'), sortOrder: tasks.value.length, ...taskData, progress: taskData.progress ?? 0, doneDate: taskData.status === 'done' ? today() : '' }
    await createTask(task, auth.sheetId)
    await loadAll()
    return task
  }

  async function editTask(taskData) {
    const existing = getTaskById(taskData.id)
    if (!existing) throw new Error('Task tidak ditemukan')
    const updated = { ...existing, ...taskData, doneDate: taskData.status === 'done' && !existing.doneDate ? today() : (taskData.doneDate || existing.doneDate) }
    await updateTask(updated, auth.sheetId)
    await loadAll()
    return updated
  }

  async function removeTask(taskId) {
    const task = getTaskById(taskId)
    if (!task) throw new Error('Task tidak ditemukan')
    await deleteTask(task, auth.sheetId)
    await loadAll()
  }

  async function setProgress(taskId, progress) {
    const task = getTaskById(taskId)
    if (!task) throw new Error('Task tidak ditemukan')
    await updateTaskProgress(task, progress, auth.sheetId)
    task.progress = progress
    if (progress === 100) { task.status = 'done'; task.doneDate = today(); await updateTask(task, auth.sheetId) }
    await loadAll()
  }

  async function reorderTasks(newOrderedTasks) {
    tasks.value = newOrderedTasks.map((t, i) => ({ ...t, sortOrder: i }))
    try { await batchUpdateTasks(tasks.value, auth.sheetId) }
    catch(e) { await loadAll(); throw e }
  }

  async function addLog(logData) {
    const log = { id: genId('L'), ...logData, date: logData.date || today() }
    await createLog(log, auth.sheetId)
    if (logData.progress !== undefined) {
      const task = getTaskById(logData.taskId)
      if (task) await updateTaskProgress(task, logData.progress, auth.sheetId)
    }
    await loadAll()
    return log
  }

  async function removeLog(logId) {
    const log = logs.value.find(l => l.id === logId)
    if (!log) throw new Error('Log tidak ditemukan')
    await deleteLog(log, auth.sheetId)
    await loadAll()
  }

  async function addReminder(reminderData) {
    const reminder = { id: genId('R'), ...reminderData, sent: false }
    await createReminder(reminder, auth.sheetId)
    await loadAll()
    return reminder
  }

  async function editReminder(reminderData) {
    const existing = reminders.value.find(r => r.id === reminderData.id)
    if (!existing) throw new Error('Reminder tidak ditemukan')
    await updateReminder({ ...existing, ...reminderData }, auth.sheetId)
    await loadAll()
  }

  async function removeReminder(reminderId) {
    const reminder = reminders.value.find(r => r.id === reminderId)
    if (!reminder) throw new Error('Reminder tidak ditemukan')
    await deleteReminder(reminder, auth.sheetId)
    await loadAll()
  }

  async function markSent(reminderId) {
    const reminder = reminders.value.find(r => r.id === reminderId)
    if (!reminder) throw new Error('Reminder tidak ditemukan')
    await markReminderSent(reminder, auth.sheetId)
    reminder.sent = true
  }

  return {
    tasks, logs, reminders, loading, connStatus, connMsg,
    totalTasks, inProgressCount, doneCount, todoCount, pausedCount, avgProgress,
    statusBreakdown, catBreakdown, sortedTasks, upcomingDeadlines,
    getTaskById, getLogsByTask, getRemindersByTask,
    loadAll,
    addTask, editTask, removeTask, setProgress, reorderTasks,
    addLog, removeLog,
    addReminder, editReminder, removeReminder, markSent
  }
})

function genId(prefix = 'X') {
  return prefix + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase()
}
function today() {
  return new Date().toISOString().split('T')[0]
}
