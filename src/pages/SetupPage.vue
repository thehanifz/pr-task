<template>
  <div class="setup-wrap">
    <div class="setup-box">
      <div class="setup-logo">PR<span>.</span>Tasks</div>
      <h2>⚙️ Setup Pertama Kali</h2>

      <!-- Google account info (sudah login) -->
      <div class="oauth-success">
        <img v-if="oauthPicture" :src="oauthPicture" class="oauth-avatar" alt="foto profil" />
        <div>
          <div style="font-weight:600;font-size:0.88rem">{{ oauthName }}</div>
          <div style="font-size:0.78rem;color:var(--text2)">{{ oauthEmail }}</div>
        </div>
        <button class="btn-link" @click="relogin">Ganti akun</button>
      </div>

      <hr style="border-color:var(--border);margin:16px 0" />

      <!-- Nama -->
      <div class="form-group">
        <label class="form-label">Nama Kamu</label>
        <input v-model="form.name" class="form-input" placeholder="contoh: Hanif" />
      </div>

      <!-- PIN -->
      <div class="form-group">
        <label class="form-label">PIN (4 digit angka)</label>
        <input v-model="form.pin" type="password" inputmode="numeric" maxlength="4" class="form-input" placeholder="Masukkan PIN 4 digit" />
      </div>

      <hr style="border-color:var(--border);margin:8px 0 16px" />

      <!-- Sheet ID -->
      <div class="form-group">
        <label class="form-label">Google Spreadsheet ID <span style="color:var(--text2);font-weight:400">(opsional)</span></label>
        <input v-model="form.sheetId" class="form-input" placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms" @blur="parseSheetId" />
        <div class="form-hint">Dari URL: docs.google.com/spreadsheets/d/<strong style="color:var(--accent)">[ID INI]</strong>/edit<br/>Kosongkan jika ingin dibuat otomatis.</div>
        <div v-if="parsedId" class="sheet-id-preview">✅ ID terdeteksi: <code>{{ parsedId }}</code></div>
      </div>

      <!-- Webhook -->
      <div class="form-group">
        <label class="form-label">n8n Webhook URL <span style="color:var(--text2);font-weight:400">(opsional)</span></label>
        <input v-model="form.webhookUrl" type="url" class="form-input" placeholder="https://n8n.domain.com/webhook/xxx" />
      </div>

      <button class="btn btn-primary btn-full" :disabled="saving" @click="submit" style="margin-top:8px">
        {{ saving ? '⏳ Menyimpan...' : '🚀 Mulai Gunakan' }}
      </button>

      <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { testConnection } from '@/services/googleSheets'
import { initiateGoogleLogin, getStoredToken, extractSheetId } from '@/services/googleOAuth'

const auth   = useAuthStore()
const router = useRouter()

// Kalau belum login Google, paksa balik ke halaman login
const stored = getStoredToken()
if (!stored?.access_token) {
  router.replace('/login')
}

const oauthEmail   = ref(stored?.email   || '')
const oauthName    = ref(stored?.name    || '')
const oauthPicture = ref(stored?.picture || '')

const form = ref({
  name:       stored?.name || auth.userName || '',
  pin:        '',
  sheetId:    auth.sheetId || '',
  webhookUrl: auth.webhookUrl || ''
})

const parsedId = ref('')
const saving   = ref(false)
const errorMsg = ref('')

function parseSheetId() {
  const extracted = extractSheetId(form.value.sheetId)
  parsedId.value     = extracted
  form.value.sheetId = extracted
}

async function relogin() {
  try {
    const url = await initiateGoogleLogin()
    window.location.href = url
  } catch(e) {
    errorMsg.value = 'Gagal: ' + e.message
  }
}

async function submit() {
  errorMsg.value = ''
  if (!form.value.name.trim())    return errorMsg.value = 'Nama harus diisi'
  if (!form.value.pin || form.value.pin.length !== 4 || !/^\d+$/.test(form.value.pin))
    return errorMsg.value = 'PIN harus 4 digit angka'

  saving.value = true
  try {
    if (form.value.sheetId.trim()) {
      await testConnection(form.value.sheetId.trim())
    }
    await auth.saveConfig({
      name:       form.value.name,
      pin:        form.value.pin,
      sheetId:    form.value.sheetId.trim(),
      webhookUrl: form.value.webhookUrl
    })
    router.push('/lock')
  } catch(e) {
    errorMsg.value = 'Error: ' + e.message
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.setup-wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  background: var(--bg);
}
.setup-box {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 32px;
  max-width: 460px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}
.setup-logo { font-size: 1.6rem; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 8px; }
.setup-logo span { color: var(--accent); }
.setup-box h2 { font-size: 1.2rem; font-weight: 800; margin-bottom: 16px; }
.oauth-success {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bg);
  border: 1px solid var(--green);
  border-radius: var(--radius);
  padding: 12px 16px;
}
.oauth-avatar { width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0; }
.btn-link { background: none; border: none; color: var(--accent); font-size: 0.78rem; cursor: pointer; margin-left: auto; }
.sheet-id-preview { font-size: 0.78rem; color: var(--green); margin-top: 6px; }
.sheet-id-preview code { background: var(--bg); padding: 2px 6px; border-radius: 4px; font-family: monospace; }
.error-msg { color: var(--red); font-size: 0.8rem; margin-top: 10px; text-align: center; }
</style>
