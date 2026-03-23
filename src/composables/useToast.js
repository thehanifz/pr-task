import { ref } from 'vue'

const toasts = ref([])

export function useToast() {
  function show(message, type = 'info', duration = 3500) {
    const id = Date.now()
    toasts.value.push({ id, message, type })
    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id)
    }, duration)
  }

  const success = (msg) => show(msg, 'success')
  const error   = (msg) => show(msg, 'error')
  const info    = (msg) => show(msg, 'info')

  return { toasts, success, error, info }
}
