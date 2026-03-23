<template>
  <AppModal v-model="show" title="🗑️ Konfirmasi Hapus" max-width="380px">
    <p style="color:var(--text2);font-size:0.88rem;line-height:1.6">
      <strong style="color:var(--text)">{{ itemName }}</strong> akan dihapus permanen.
      Tindakan ini tidak bisa dibatalkan.
    </p>
    <template #footer>
      <button class="btn btn-secondary" @click="show = false">Batal</button>
      <button class="btn btn-danger" :disabled="loading" @click="confirm">
        {{ loading ? '⏳ Menghapus...' : 'Hapus' }}
      </button>
    </template>
  </AppModal>
</template>

<script setup>
import { ref, computed } from 'vue'
import AppModal from './AppModal.vue'

const props = defineProps({ modelValue: Boolean, itemName: String })
const emit  = defineEmits(['update:modelValue', 'confirm'])
const loading = ref(false)

const show = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

async function confirm() {
  loading.value = true
  await emit('confirm')
  loading.value = false
  show.value = false
}
</script>
