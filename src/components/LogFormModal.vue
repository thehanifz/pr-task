<template>
  <AppModal v-model="show" title="📝 Tambah Log Harian" max-width="440px">
    <div class="form-group">
      <label class="form-label">Tanggal</label>
      <input v-model="form.date" type="date" class="form-input" />
    </div>
    <div class="form-group">
      <label class="form-label">Catatan Kegiatan *</label>
      <textarea v-model="form.note" class="form-textarea" placeholder="Apa yang dikerjakan hari ini..." style="min-height:90px" />
    </div>
    <div class="form-group">
      <label class="form-label">Update Progres: <span class="mono" style="color:var(--accent)">{{ form.progress }}%</span></label>
      <input v-model.number="form.progress" type="range" class="slider" min="0" max="100" />
    </div>

    <template #footer>
      <button class="btn btn-secondary" @click="show = false">Batal</button>
      <button class="btn btn-primary" :disabled="saving" @click="submit">
        {{ saving ? '⏳ Menyimpan...' : '💾 Simpan Log' }}
      </button>
    </template>
  </AppModal>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import AppModal from './AppModal.vue'
import { useTasksStore } from '@/stores/tasks'
import { useToast } from '@/composables/useToast'

const props = defineProps({ modelValue: Boolean, taskId: String, initialProgress: { type: Number, default: 0 } })
const emit  = defineEmits(['update:modelValue', 'saved'])

const store  = useTasksStore()
const toast  = useToast()
const saving = ref(false)

const show = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const form = ref({ date: today(), note: '', progress: 0 })

watch(() => props.modelValue, (v) => {
  if (v) form.value = { date: today(), note: '', progress: props.initialProgress }
})

async function submit() {
  if (!form.value.note.trim()) return toast.error('Catatan wajib diisi')
  saving.value = true
  try {
    await store.addLog({ ...form.value, taskId: props.taskId })
    toast.success('Log ditambahkan ✅')
    show.value = false
    emit('saved')
  } catch (e) {
    toast.error('Gagal menyimpan log: ' + e.message)
  } finally {
    saving.value = false
  }
}

function today() { return new Date().toISOString().split('T')[0] }
</script>
