<template>
  <div class="lock-wrap">
    <div class="lock-box">
      <div class="lock-logo">PR<span>.</span>Tasks</div>

      <!-- Locked state -->
      <template v-if="isLocked">
        <div class="lock-icon">🔒</div>
        <div class="lock-title">Terlalu Banyak Percobaan</div>
        <div class="lock-sub">Coba lagi dalam</div>
        <div class="lock-countdown">{{ countdownDisplay }}</div>
        <div class="lock-sub" style="color:var(--text2)">Percobaan salah: {{ MAX_ATTEMPTS }}/{{ MAX_ATTEMPTS }}</div>
      </template>

      <!-- Normal state -->
      <template v-else>
        <div class="lock-sub mono">Masukkan PIN untuk melanjutkan</div>

        <div class="pin-dots">
          <div v-for="i in 4" :key="i" :class="['dot-circle', { filled: pinBuffer.length >= i, error: hasError }]" />
        </div>

        <div class="pin-error">{{ errorMsg }}</div>

        <div class="pin-pad">
          <button v-for="n in [1,2,3,4,5,6,7,8,9]" :key="n" class="pin-btn" @click="press(String(n))">{{ n }}</button>
          <button class="pin-btn" @click="clear">C</button>
          <button class="pin-btn" @click="press('0')">0</button>
          <button class="pin-btn" @click="del">⌫</button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'

const MAX_ATTEMPTS = 3

const auth      = useAuthStore()
const pinBuffer = ref('')
const errorMsg  = ref('')
const hasError  = ref(false)
const isLocked  = ref(false)
const remaining = ref(0)  // ms

let timer = null

function checkLockState() {
  const ms = auth.getLockoutRemaining()
  if (ms !== null) {
    isLocked.value  = true
    remaining.value = ms
  } else {
    isLocked.value  = false
    remaining.value = 0
  }
}

const countdownDisplay = computed(() => {
  const total = Math.ceil(remaining.value / 1000)
  const m = Math.floor(total / 60).toString().padStart(2, '0')
  const s = (total % 60).toString().padStart(2, '0')
  return `${m}:${s}`
})

function tick() {
  remaining.value = Math.max(0, remaining.value - 1000)
  if (remaining.value <= 0) {
    isLocked.value = false
    clearInterval(timer)
    timer = null
    errorMsg.value = ''
  }
}

onMounted(() => {
  checkLockState()
  if (isLocked.value) {
    timer = setInterval(tick, 1000)
  }
})

onUnmounted(() => { if (timer) clearInterval(timer) })

function press(d) {
  if (isLocked.value || pinBuffer.value.length >= 4) return
  pinBuffer.value += d
  if (pinBuffer.value.length === 4) setTimeout(verify, 120)
}

function del() { pinBuffer.value = pinBuffer.value.slice(0, -1); clearError() }
function clear() { pinBuffer.value = ''; clearError() }

async function verify() {
  try {
    await auth.verifyPin(pinBuffer.value)
    // Sukses
    window.location.href = '/'
  } catch(e) {
    hasError.value = true
    errorMsg.value = e.message

    // Cek apakah sekarang terkunci
    checkLockState()
    if (isLocked.value) {
      pinBuffer.value = ''
      clearError()
      timer = setInterval(tick, 1000)
      return
    }

    setTimeout(() => { pinBuffer.value = ''; clearError() }, 900)
  }
}

function clearError() {
  errorMsg.value = ''
  hasError.value = false
}
</script>

<style scoped>
.lock-wrap {
  min-height: 100vh; display: flex; align-items: center; justify-content: center;
  padding: 20px; background: var(--bg); position: relative; z-index: 1;
}
.lock-box { display: flex; flex-direction: column; align-items: center; gap: 20px; }
.lock-logo { font-size: 2.6rem; font-weight: 800; letter-spacing: -1px; color: #fff; }
.lock-logo span { color: var(--accent); }
.lock-sub { font-size: 0.75rem; color: var(--text2); letter-spacing: 0.08em; }
.lock-icon { font-size: 3rem; }
.lock-title { font-size: 1.1rem; font-weight: 700; color: var(--red); }
.lock-countdown {
  font-size: 3rem; font-weight: 800; font-family: var(--font-mono);
  color: var(--accent); letter-spacing: 0.05em;
}

.pin-dots { display: flex; gap: 14px; }
.dot-circle {
  width: 15px; height: 15px; border-radius: 50%;
  border: 2px solid var(--border2); transition: all 0.18s;
}
.dot-circle.filled { background: var(--accent); border-color: var(--accent); box-shadow: 0 0 10px rgba(59,130,246,0.5); }
.dot-circle.error  { background: var(--red); border-color: var(--red); animation: shake 0.3s; }

.pin-error { font-size: 0.78rem; color: var(--red); font-family: var(--font-mono); min-height: 20px; text-align: center; max-width: 240px; }

.pin-pad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; width: 228px; }
.pin-btn {
  height: 68px; background: var(--surface); border: 1px solid var(--border);
  color: var(--text); font-size: 1.2rem; font-weight: 700;
  border-radius: var(--radius-lg); transition: all 0.12s; user-select: none;
}
.pin-btn:hover  { background: var(--surface2); border-color: var(--border2); }
.pin-btn:active { transform: scale(0.92); background: var(--accent-glow); }

@keyframes shake {
  0%,100% { transform: translateX(0); }
  25%      { transform: translateX(-5px); }
  75%      { transform: translateX(5px); }
}
</style>
