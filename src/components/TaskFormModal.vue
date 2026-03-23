<template>
  <AppModal v-model="show" :title="isEdit ? 'Edit Task' : 'Tambah Task Baru'" max-width="560px">
    <div class="form-group">
      <label class="form-label">Nama Task *</label>
      <input v-model="form.name" class="form-input" placeholder="Contoh: Rebuild PDF Editor" />
    </div>
    <div class="form-group">
      <label class="form-label">Deskripsi</label>
      <textarea v-model="form.desc" class="form-textarea" placeholder="Detail singkat..." style="min-height:70px" />
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group">
        <label class="form-label">Kategori</label>
        <select v-model="form.cat" class="form-select">
          <option value="dev">💻 Dev</option>
          <option value="belajar">📚 Belajar</option>
          <option value="infra">🖥️ Infra</option>
          <option value="content">📝 Content</option>
          <option value="personal">👤 Personal</option>
          <option value="other">📌 Lainnya</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Prioritas</label>
        <select v-model="form.priority" class="form-select">
          <option value="high">🔴 Tinggi</option>
          <option value="med">🟡 Sedang</option>
          <option value="low">🟢 Rendah</option>
        </select>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group">
        <label class="form-label">Tanggal Mulai</label>
        <input v-model="form.start" type="date" class="form-input" />
      </div>
      <div class="form-group">
        <label class="form-label">Target Selesai</label>
        <input v-model="form.target" type="date" class="form-input" />
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Status</label>
      <select v-model="form.status" class="form-select">
        <option value="todo">⏳ Belum Mulai</option>
        <option value="progress">🔄 Sedang Jalan</option>
        <option value="done">✅ Selesai</option>
        <option value="paused">⏸️ Ditunda</option>
      </select>
    </div>

    <div class="form-group">
      <label class="form-label">Progres: <span class="mono" style="color:var(--accent)">{{ form.progress }}%</span></label>
      <input v-model.number="form.progress" type="range" class="slider" min="0" max="100" />
    </div>

    <template #footer>
      <button class="btn btn-secondary" @click="show = false">Batal</button>
      <button class="btn btn-primary" :disabled="saving" @click="submit">
        {{ saving ? '⏳ Menyimpan...' : '💾 Simpan' }}
      </button>
    </template>
  </AppModal>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import AppModal from './AppModal.vue'
import { useTasksStore } from '@/stores/tasks'
import { useToast } from '@/composables/useToast'

const props = defineProps({ modelValue: Boolean, task: Object })
const emit  = defineEmits(['update:modelValue', 'saved'])

const store  = useTasksStore()
const toast  = useToast()
const saving = ref(false)

const show = computed({
  get:  () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const isEdit = computed(() => !!props.task?.id)

const emptyForm = () => ({
  name: '', desc: '', cat: 'dev', priority: 'med',
  start: today(), target: '', status: 'todo', progress: 0
})

const form = ref(emptyForm())

// Populate form when editing
watch(() => props.task, (t) => {
  if (t) form.value = { ...emptyForm(), ...t }
  else   form.value = emptyForm()
}, { immediate: true })

async function submit() {
  if (!form.value.name.trim()) return toast.error('Nama task wajib diisi')
  saving.value = true
  try {
    if (isEdit.value) await store.editTask(form.value)
    else              await store.addTask(form.value)
    toast.success(isEdit.value ? 'Task berhasil diupdate ✅' : 'Task berhasil ditambahkan ✅')
    show.value = false
    emit('saved')
  } catch (e) {
    toast.error('Gagal menyimpan: ' + e.message)
  } finally {
    saving.value = false
  }
}

function today() { return new Date().toISOString().split('T')[0] }
</script>
