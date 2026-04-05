<template>
  <div class="login-wrap">
    <div class="login-box">
      <div class="login-logo">PR<span>.</span>Tasks</div>
      <h2>Selamat Datang</h2>
      <p class="login-desc">Login dengan akun Google kamu untuk mulai menggunakan PR Task Manager.</p>

      <button class="btn-google" @click="doGoogleLogin" :disabled="loading">
        <svg width="18" height="18" viewBox="0 0 48 48">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          <path fill="none" d="M0 0h48v48H0z"/>
        </svg>
        {{ loading ? 'Mengarahkan...' : 'Login dengan Google' }}
      </button>

      <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>

      <div class="or-divider"><span>atau</span></div>

      <div style="text-align:center">
        <p style="font-size:0.78rem;color:var(--text2);margin-bottom:10px">Sudah punya file config dari device lain?</p>
        <button class="btn btn-secondary btn-full" @click="importFileInput.click()">📥 Import dari prtm-config.json</button>
        <input ref="importFileInput" type="file" accept=".json" style="display:none" @change="onImportConfig" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { initiateGoogleLogin, getStoredToken } from '@/services/googleOAuth'
import { useAuthStore } from '@/stores/auth'

const router   = useRouter()
const auth     = useAuthStore()
const loading  = ref(false)
const errorMsg = ref('')
const importFileInput = ref(null)

// Kalau sudah ada token, langsung ke setup
const stored = getStoredToken()
if (stored?.access_token) {
  router.replace('/setup')
}

async function doGoogleLogin() {
  errorMsg.value = ''
  loading.value  = true
  try {
    const url = await initiateGoogleLogin()
    window.location.href = url
  } catch(e) {
    errorMsg.value = 'Gagal memulai login Google: ' + e.message
    loading.value  = false
  }
}

function onImportConfig(e) {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = async (ev) => {
    try {
      const cfg = JSON.parse(ev.target.result)
      if (!cfg.sheetId) return errorMsg.value = 'File config tidak valid atau tidak lengkap'
      await auth.saveConfig({
        name:       cfg.name       || '',
        sheetId:    cfg.sheetId    || '',
        webhookUrl: cfg.webhookUrl || ''
      })
      errorMsg.value = ''
      // Setelah import, arahkan ke login Google agar token di-set
      // (PIN baru akan diminta di setup)
      router.push('/setup')
    } catch {
      errorMsg.value = 'Gagal membaca file config'
    }
  }
  reader.readAsText(file)
  e.target.value = ''
}
</script>

<style scoped>
.login-wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  background: var(--bg);
}
.login-box {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 40px 32px;
  max-width: 420px;
  width: 100%;
  text-align: center;
}
.login-logo {
  font-size: 1.8rem;
  font-weight: 800;
  letter-spacing: -0.5px;
  margin-bottom: 12px;
}
.login-logo span { color: var(--accent); }
.login-box h2 { font-size: 1.2rem; font-weight: 800; margin-bottom: 8px; }
.login-desc {
  font-size: 0.84rem;
  color: var(--text2);
  margin-bottom: 28px;
  line-height: 1.6;
}
.btn-google {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #fff;
  color: #3c4043;
  border: 1px solid #dadce0;
  border-radius: 6px;
  padding: 12px 16px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: box-shadow 0.2s;
  width: 100%;
  justify-content: center;
}
.btn-google:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
.btn-google:disabled { opacity: 0.6; cursor: not-allowed; }
.error-msg { color: var(--red); font-size: 0.8rem; margin-top: 14px; }
.or-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 20px 0;
  color: var(--muted);
  font-size: 0.75rem;
}
.or-divider::before, .or-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}
</style>
