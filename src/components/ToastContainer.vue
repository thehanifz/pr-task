<template>
  <div class="toast-wrap">
    <transition-group name="toast">
      <div
        v-for="t in toasts"
        :key="t.id"
        :class="['toast-item', t.type]"
      >
        <span>{{ ICONS[t.type] }}</span>
        <span>{{ t.message }}</span>
      </div>
    </transition-group>
  </div>
</template>

<script setup>
import { useToast } from '@/composables/useToast'

const { toasts } = useToast()
const ICONS = { success: '✅', error: '❌', info: 'ℹ️' }
</script>

<style scoped>
.toast-enter-active, .toast-leave-active { transition: all 0.25s ease; }
.toast-enter-from { opacity: 0; transform: translateX(16px); }
.toast-leave-to   { opacity: 0; transform: translateX(16px); }
</style>
