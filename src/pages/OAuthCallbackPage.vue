<template>
  <div class="callback-wrap">
    <div class="callback-box">
      <div class="setup-logo">PR<span>.</span>Tasks</div>
      <div v-if="loading" class="cb-state">
        <div class="spinner"></div>
        <div class="cb-msg">{{ loadingMsg }}</div>
      </div>
      <div v-else-if="error" class="cb-state">
        <div class="cb-icon">❌</div>
        <div class="cb-msg cb-err">{{ error }}</div>
        <button class="btn btn-primary" style="margin-top:16px" @click="retry">Coba Lagi</button>
      </div>
      <div v-else class="cb-state">
        <div class="cb-icon">✅</div>
        <div class="cb-msg">Login berhasil! Mengarahkan...</div>
        <div v-if="syncMsg" class="cb-sync">{{ syncMsg }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter }      from 'vue-router'
import { useAuthStore }   from '@/stores/auth'
import { handleOAuthCallback } from '@/services/googleOAuth'

const router     = useRouter()
const auth       = useAuthStore()
const loading    = ref(true)
const error      = ref('')
const loadingMsg = ref('Memproses login Google...')
const syncMsg    = ref('')

onMounted(async () => {
  const params = new URLSearchParams(window.location.search)
  const code   = params.get('code')
  const state  = params.get('state')
  const err    = params.get('error')

  if (err) {
    loading.value = false
    error.value   = 'Login dibatalkan: ' + err
    return
  }
  if (!code || !state) {
    loading.value = false
    error.value   = 'Parameter tidak lengkap. Coba login ulang.'
    return
  }

  try {
    // 1. Tukar code → token OAuth
    await handleOAuthCallback(code, state)

    // 2. Pull config dari server (cross-browser sync)
    loadingMsg.value = 'Sinkronisasi config dari server...'
    const result = await auth.pullConfigFromServer()

    loading.value = false

    if (result.pulled) {
      syncMsg.value = '☁️ Config tersinkron dari server'
    } else if (result.reason === 'not_found') {
      syncMsg.value = '🆕 Akun baru — isi pengaturan di halaman setup'
    }
    // reason 'no_oauth' tidak mungkin di sini karena baru saja login

    // 3. Redirect sesuai status
    setTimeout(() => {
      if (!auth.isConfigured) {
        router.push('/setup')
      } else {
        router.push('/lock')
      }
    }, 900)

  } catch(e) {
    loading.value = false
    error.value   = e.message || 'Gagal login Google'
  }
})

function retry() {
  router.push('/login')
}
</script>

<style scoped>
.callback-wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  padding: 24px;
}
.callback-box {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 40px 32px;
  max-width: 360px;
  width: 100%;
  text-align: center;
}
.setup-logo { font-size: 1.6rem; font-weight: 800; margin-bottom: 24px; }
.setup-logo span { color: var(--accent); }
.cb-state { display: flex; flex-direction: column; align-items: center; gap: 12px; }
.cb-icon  { font-size: 2.5rem; }
.cb-msg   { font-size: 0.88rem; color: var(--text2); }
.cb-err   { color: var(--red); }
.cb-sync  {
  font-size: 0.75rem;
  color: var(--green);
  background: rgba(16,185,129,0.08);
  border: 1px solid rgba(16,185,129,0.2);
  border-radius: 6px;
  padding: 5px 12px;
}
.spinner {
  width: 36px; height: 36px;
  border: 3px solid var(--border2);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
