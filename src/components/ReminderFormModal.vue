<template>
  <AppModal v-model="show" :title="isEdit ? 'Edit Reminder' : '⏰ Tambah Reminder'" max-width="520px">

    <!-- Task -->
    <div class="form-group">
      <label class="form-label">Task</label>
      <select v-model="form.taskId" class="form-select" :disabled="!!fixedTaskId">
        <option value="">— Pilih Task —</option>
        <option v-for="t in store.tasks" :key="t.id" :value="t.id">{{ t.name }}</option>
      </select>
    </div>

    <!-- Tipe -->
    <div class="form-group">
      <label class="form-label">Tipe Reminder</label>
      <select v-model="form.type" class="form-select">
        <option value="deadline_h3">H-3 sebelum deadline</option>
        <option value="deadline_h1">H-1 sebelum deadline</option>
        <option value="deadline_d0">Hari-H deadline</option>
        <option value="custom">🎯 Custom (pilih tanggal & jam)</option>
      </select>
    </div>

    <!-- Custom datetime -->
    <div v-if="form.type === 'custom'" class="two-col">
      <div class="form-group">
        <label class="form-label">Tanggal Mulai</label>
        <input v-model="customDate" type="date" class="form-input" />
      </div>
      <div class="form-group">
        <label class="form-label">Jam</label>
        <input v-model="customTime" type="time" class="form-input" />
      </div>
    </div>

    <!-- Deadline-based info -->
    <div v-else-if="calculatedSendAt" class="info-box">
      <span class="mono" style="font-size:0.72rem;color:var(--text2)">📅 Pertama dikirim:</span>
      <span class="mono" style="font-size:0.82rem;color:var(--accent);font-weight:700">{{ calculatedSendAt }}</span>
    </div>
    <div v-else-if="form.type !== 'custom'" class="info-box warn">
      <span style="font-size:0.78rem;color:var(--yellow)">⚠️ Task belum punya target deadline.</span>
    </div>

    <!-- ══ RECURRING TOGGLE ══ -->
    <div class="recurring-toggle" @click="form.recurring = !form.recurring">
      <div class="toggle-track" :class="{ active: form.recurring }">
        <div class="toggle-thumb" />
      </div>
      <span style="font-size:0.85rem;font-weight:700">🔁 Recurring (berulang)</span>
      <span v-if="form.recurring" class="badge" style="background:rgba(16,185,129,0.15);color:var(--green);font-size:0.65rem">ON</span>
    </div>

    <!-- Recurring options -->
    <div v-if="form.recurring" class="recurring-box">

      <!-- Tipe recurring -->
      <div class="form-group">
        <label class="form-label">Ulangi setiap</label>
        <div class="rec-type-grid">
          <button
            v-for="t in RECURRING_TYPES" :key="t.value"
            :class="['rec-type-btn', { active: form.recurringType === t.value }]"
            @click="form.recurringType = t.value"
          >{{ t.label }}</button>
        </div>
      </div>

      <!-- Daily — hanya pilih jam -->
      <div v-if="form.recurringType === 'daily'" class="form-group">
        <label class="form-label">Jam kirim</label>
        <input v-model="form.recurringTime" type="time" class="form-input" style="max-width:140px" />
      </div>

      <!-- Weekly — pilih hari -->
      <div v-if="form.recurringType === 'weekly'" class="form-group">
        <label class="form-label">Hari</label>
        <div class="day-picker">
          <button
            v-for="d in DAYS_OF_WEEK" :key="d.value"
            :class="['day-btn', { active: selectedDays.includes(d.value) }]"
            @click="toggleDay(d.value)"
          >{{ d.label }}</button>
        </div>
        <div class="form-group" style="margin-top:10px;margin-bottom:0">
          <label class="form-label">Jam kirim</label>
          <input v-model="form.recurringTime" type="time" class="form-input" style="max-width:140px" />
        </div>
      </div>

      <!-- Monthly — pilih tanggal -->
      <div v-if="form.recurringType === 'monthly'" class="form-group">
        <label class="form-label">Tanggal tiap bulan</label>
        <div class="date-picker">
          <button
            v-for="d in 28" :key="d"
            :class="['date-btn', { active: form.recurringDays === String(d) }]"
            @click="form.recurringDays = String(d)"
          >{{ d }}</button>
        </div>
        <div class="form-group" style="margin-top:10px;margin-bottom:0">
          <label class="form-label">Jam kirim</label>
          <input v-model="form.recurringTime" type="time" class="form-input" style="max-width:140px" />
        </div>
      </div>

      <!-- Interval — setiap N hari -->
      <div v-if="form.recurringType === 'interval'" class="form-group">
        <label class="form-label">Setiap berapa hari</label>
        <div style="display:flex;align-items:center;gap:10px">
          <input
            v-model.number="intervalDays"
            type="number" min="1" max="365"
            class="form-input" style="max-width:80px"
          />
          <span style="font-size:0.82rem;color:var(--text2)">hari sekali</span>
        </div>
        <div class="form-group" style="margin-top:10px;margin-bottom:0">
          <label class="form-label">Jam kirim</label>
          <input v-model="form.recurringTime" type="time" class="form-input" style="max-width:140px" />
        </div>
      </div>

      <!-- Tanggal berakhir -->
      <div class="form-group" style="margin-top:4px">
        <label class="form-label">Berakhir pada (kosongkan = selamanya)</label>
        <input v-model="form.recurringEnd" type="date" class="form-input" style="max-width:200px" />
      </div>

      <!-- Preview next runs -->
      <div v-if="nextRuns.length" class="next-runs">
        <div class="mono" style="font-size:0.65rem;color:var(--muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.08em">Jadwal berikutnya</div>
        <div v-for="(r, i) in nextRuns" :key="i" class="next-run-item">
          <span class="mono" style="font-size:0.72rem;color:var(--text2)">{{ i + 1 }}.</span>
          <span class="mono" style="font-size:0.75rem;color:var(--accent)">{{ r }}</span>
        </div>
      </div>
    </div>

    <!-- Pesan & Webhook -->
    <div class="form-group">
      <label class="form-label">Webhook URL (kosong = pakai default)</label>
      <input v-model="form.webhookUrl" type="url" class="form-input" :placeholder="auth.webhookUrl || 'https://n8n...'" />
    </div>

    <div class="form-group">
      <label class="form-label">Pesan Custom (kosong = otomatis)</label>
      <textarea v-model="form.message" class="form-textarea" style="min-height:60px" placeholder="Kosongkan untuk pesan otomatis..." />
    </div>

    <template #footer>
      <button class="btn btn-secondary" @click="show = false">Batal</button>
      <button class="btn btn-primary" :disabled="saving || !canSave" @click="submit">
        {{ saving ? '⏳...' : '💾 Simpan' }}
      </button>
    </template>
  </AppModal>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import AppModal from './AppModal.vue'
import { useTasksStore } from '@/stores/tasks'
import { useAuthStore }  from '@/stores/auth'
import { useToast } from '@/composables/useToast'

const props = defineProps({
  modelValue:  Boolean,
  reminder:    Object,
  fixedTaskId: String
})
const emit = defineEmits(['update:modelValue', 'saved'])

const store = useTasksStore()
const auth  = useAuthStore()
const toast = useToast()
const saving = ref(false)
const isEdit = computed(() => !!props.reminder?.id)

const show = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const RECURRING_TYPES = [
  { value: 'daily',    label: '📅 Harian' },
  { value: 'weekly',   label: '📆 Mingguan' },
  { value: 'monthly',  label: '🗓️ Bulanan' },
  { value: 'interval', label: '⏱️ Interval' }
]

const DAYS_OF_WEEK = [
  { value: '1', label: 'Sen' }, { value: '2', label: 'Sel' },
  { value: '3', label: 'Rab' }, { value: '4', label: 'Kam' },
  { value: '5', label: 'Jum' }, { value: '6', label: 'Sab' },
  { value: '0', label: 'Min' }
]

const emptyForm = () => ({
  taskId:        props.fixedTaskId || '',
  type:          'custom',
  message:       '',
  webhookUrl:    '',
  sent:          false,
  recurring:     false,
  recurringType: 'daily',
  recurringDays: '',
  recurringTime: '08:00',
  recurringEnd:  ''
})

const form        = ref(emptyForm())
const customDate  = ref('')
const customTime  = ref('08:00')
const intervalDays = ref(7)

// Weekly day picker — simpan sebagai array, nanti join ke string
const selectedDays = computed({
  get: () => form.value.recurringDays ? form.value.recurringDays.split(',') : [],
  set: (arr) => { form.value.recurringDays = arr.sort().join(',') }
})

function toggleDay(d) {
  const cur = selectedDays.value
  selectedDays.value = cur.includes(d) ? cur.filter(x => x !== d) : [...cur, d]
}

watch(() => props.modelValue, (v) => {
  if (v) {
    if (props.reminder) {
      form.value = { ...emptyForm(), ...props.reminder }
      intervalDays.value = props.reminder.recurringType === 'interval'
        ? parseInt(props.reminder.recurringDays) || 7 : 7
      if (props.reminder.sendAt) {
        const d = new Date(props.reminder.sendAt)
        customDate.value = d.toISOString().split('T')[0]
        customTime.value = d.toTimeString().slice(0,5)
      }
    } else {
      form.value = emptyForm()
      customDate.value = ''
      customTime.value = '08:00'
      intervalDays.value = 7
    }
  }
})

const selectedTask = computed(() => store.getTaskById(form.value.taskId))

const calculatedSendAt = computed(() => {
  if (!selectedTask.value?.target || form.value.type === 'custom') return null
  const d = new Date(selectedTask.value.target)
  const offsets = { deadline_h3: -3, deadline_h1: -1, deadline_d0: 0 }
  d.setDate(d.getDate() + (offsets[form.value.type] ?? 0))
  d.setHours(8, 0, 0, 0)
  return d.toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })
})

const getSendAt = computed(() => {
  if (form.value.type === 'custom') {
    if (!customDate.value) return ''
    return new Date(`${customDate.value}T${customTime.value}`).toISOString()
  }
  if (!selectedTask.value?.target) return ''
  const d = new Date(selectedTask.value.target)
  const offsets = { deadline_h3: -3, deadline_h1: -1, deadline_d0: 0 }
  d.setDate(d.getDate() + (offsets[form.value.type] ?? 0))
  d.setHours(8, 0, 0, 0)
  return d.toISOString()
})

// Preview 5 jadwal berikutnya
const nextRuns = computed(() => {
  if (!form.value.recurring) return []
  const base = getSendAt.value ? new Date(getSendAt.value) : new Date()
  const runs = []
  const [hh, mm] = (form.value.recurringTime || '08:00').split(':').map(Number)
  const endDate  = form.value.recurringEnd ? new Date(form.value.recurringEnd) : null
  let cur = new Date(base)

  for (let i = 0; i < 5; i++) {
    if (i > 0) cur = nextDate(cur, form.value, intervalDays.value)
    if (!cur) break
    if (endDate && cur > endDate) break
    runs.push(cur.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }))
  }
  return runs
})

function nextDate(from, f, intDays) {
  const d = new Date(from)
  const [hh, mm] = (f.recurringTime || '08:00').split(':').map(Number)
  if (f.recurringType === 'daily') {
    d.setDate(d.getDate() + 1)
    d.setHours(hh, mm, 0, 0)
    return d
  }
  if (f.recurringType === 'interval') {
    d.setDate(d.getDate() + (intDays || 7))
    d.setHours(hh, mm, 0, 0)
    return d
  }
  if (f.recurringType === 'weekly') {
    const days = f.recurringDays ? f.recurringDays.split(',').map(Number).sort() : [1]
    const curDay = d.getDay()
    const next = days.find(x => x > curDay) ?? days[0]
    const diff = next > curDay ? next - curDay : 7 - curDay + next
    d.setDate(d.getDate() + diff)
    d.setHours(hh, mm, 0, 0)
    return d
  }
  if (f.recurringType === 'monthly') {
    const tgl = parseInt(f.recurringDays) || 1
    d.setMonth(d.getMonth() + 1)
    d.setDate(tgl)
    d.setHours(hh, mm, 0, 0)
    return d
  }
  return null
}

const canSave = computed(() => {
  if (!form.value.taskId) return false
  if (form.value.type === 'custom' && !customDate.value) return false
  if (form.value.type !== 'custom' && !selectedTask.value?.target) return false
  if (form.value.recurring && form.value.recurringType === 'weekly' && !form.value.recurringDays) return false
  if (form.value.recurring && form.value.recurringType === 'monthly' && !form.value.recurringDays) return false
  return true
})

async function submit() {
  saving.value = true
  try {
    const recurringDaysFinal = form.value.recurringType === 'interval'
      ? String(intervalDays.value)
      : form.value.recurringDays

    const payload = {
      ...form.value,
      sendAt:        getSendAt.value,
      webhookUrl:    form.value.webhookUrl || auth.webhookUrl,
      recurringDays: recurringDaysFinal
    }

    if (isEdit.value) await store.editReminder({ ...payload, id: props.reminder.id, _row: props.reminder._row })
    else              await store.addReminder(payload)

    toast.success(isEdit.value ? 'Reminder diupdate ✅' : 'Reminder ditambahkan ✅')
    show.value = false
    emit('saved')
  } catch(e) {
    toast.error('Gagal: ' + e.message)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

.info-box {
  background: var(--bg2); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 10px 14px;
  margin-bottom: 16px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
}
.info-box.warn { border-color: rgba(245,158,11,0.3); background: rgba(245,158,11,0.05); }

/* Toggle */
.recurring-toggle {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 14px; border-radius: var(--radius);
  background: var(--bg2); border: 1px solid var(--border);
  cursor: pointer; margin-bottom: 12px; transition: border-color 0.15s;
  user-select: none;
}
.recurring-toggle:hover { border-color: var(--accent); }
.toggle-track {
  width: 36px; height: 20px; border-radius: 99px;
  background: var(--border2); position: relative; transition: background 0.2s; flex-shrink: 0;
}
.toggle-track.active { background: var(--green); }
.toggle-thumb {
  position: absolute; top: 3px; left: 3px;
  width: 14px; height: 14px; border-radius: 50%;
  background: #fff; transition: transform 0.2s;
}
.toggle-track.active .toggle-thumb { transform: translateX(16px); }

/* Recurring box */
.recurring-box {
  background: var(--bg2); border: 1px solid rgba(16,185,129,0.2);
  border-radius: var(--radius-lg); padding: 16px;
  margin-bottom: 16px; display: flex; flex-direction: column; gap: 4px;
}

/* Tipe buttons */
.rec-type-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.rec-type-btn {
  padding: 7px 4px; border-radius: var(--radius); font-size: 0.72rem; font-weight: 700;
  border: 1px solid var(--border); background: var(--surface); color: var(--text2);
  text-align: center; transition: all 0.15s; cursor: pointer;
}
.rec-type-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }
.rec-type-btn:hover:not(.active) { border-color: var(--accent); color: var(--accent); }

/* Day picker */
.day-picker { display: flex; gap: 5px; flex-wrap: wrap; }
.day-btn {
  width: 38px; height: 38px; border-radius: 50%; font-size: 0.7rem; font-weight: 700;
  border: 1px solid var(--border); background: var(--surface); color: var(--text2);
  display: flex; align-items: center; justify-content: center; transition: all 0.15s; cursor: pointer;
}
.day-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }
.day-btn:hover:not(.active) { border-color: var(--accent); color: var(--accent); }

/* Date picker (monthly) */
.date-picker {
  display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; max-width: 280px;
}
.date-btn {
  height: 30px; border-radius: var(--radius); font-size: 0.7rem; font-weight: 700;
  border: 1px solid var(--border); background: var(--surface); color: var(--text2);
  display: flex; align-items: center; justify-content: center; transition: all 0.15s; cursor: pointer;
}
.date-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }
.date-btn:hover:not(.active) { border-color: var(--accent); color: var(--accent); }

/* Next runs preview */
.next-runs {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 10px 12px; margin-top: 8px;
}
.next-run-item { display: flex; gap: 8px; padding: 3px 0; }
</style>