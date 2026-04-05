<template>
  <div class="setup-wrap">
    <div class="setup-box">
      <div class="setup-logo">PR<span>.</span>Tasks</div>
      <h2>⚙️ Setup Pertama Kali</h2>
      <p class="setup-desc">Isi konfigurasi berikut untuk mulai. Data tersimpan lokal di browser kamu.</p>

      <!-- Step 1: Nama + PIN -->
      <div class="form-group">
        <label class="form-label">Nama Kamu</label>
        <input v-model="form.name" class="form-input" placeholder="contoh: Hanif" />
      </div>

      <div class="form-group">
        <label class="form-label">PIN (4 digit angka)</label>
        <input v-model="form.pin" type="password" inputmode="numeric" maxlength="4" class="form-input" placeholder="Masukkan PIN 4 digit" />
      </div>

      <hr style="border-color:var(--border);margin:8px 0 16px" />

      <!-- Step 2: Login Google -->
      <div class="form-group">
        <label class="form-label">Akun Google</label>
        <div v-if="!oauthDone" class="oauth-area">
          <p class="form-hint" style="margin-bottom:10px">Login dengan Google untuk mengakses Google Sheets kamu sendiri. Tidak perlu upload file apapun.</p>
          <button class="btn-google" @click="doGoogleLogin" :disabled="oauthLoading">
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></svg>
            {{ oauthLoading ? 'Mengarahkan...' : 'Login dengan Google' }}
          </button>
        </div>
        <div v-else class="oauth-success">
          <img v-if="oauthPicture" :src="oauthPicture" class="oauth-avatar" />
          <div>
            <div style="font-weight:600;font-size:0.88rem">{{ oauthName }}</div>
            <div style="font-size:0.78rem;color:var(--text2)">{{ oauthEmail }}</div>
          </div>
          <button class="btn-link" @click="relogin">Ganti akun</button>
        </div>
      </div>

      <hr style="border-color:var(--border);margin:8px 0 16px" />

      <!-- Step 3: Sheet ID -->
      <div class="form-group">
        <label class="form-label">Google Spreadsheet ID <span style="color:var(--text2);font-weight:400">(opsional)</span></label>
        <input v-model="form.sheetId" class="form-input" placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms" @blur="parseSheetId" />
        <div class="form-hint">Dari URL: docs.google.com/spreadsheets/d/<strong style="color:var(--accent)">[ID INI]</strong>/edit<br/>Kosongkan jika ingin dibuat otomatis.</div>
        <div v-if="parsedId" class="sheet-id-preview">✅ ID terdeteksi: <code>{{ parsedId }}</code></div>
      </div>

      <div class="form-group">
        <label class="form-label">n8n Webhook URL <span style="color:var(--text2);font-weight:400">(opsional)</span></label>
        <input v-model="form.webhookUrl" type="url" class="form-input" placeholder="https://n8n.domain.com/webhook/xxx" />
      </div>

      <button class="btn btn-primary btn-full" :disabled="saving || !oauthDone" @click="submit" style="margin-top:8px">
        {{ saving ? '⏳ Menyimpan...' : '🚀 Mulai Gunakan' }}
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
import { useAuthStore } from '@/stores/auth'
import { testConnection } from '@/services/googleSheets'
import { initiateGoogleLogin, getStoredToken, extractSheetId } from '@/services/googleOAuth'

const auth   = useAuthStore()
const router = useRouter()

const form = ref({ name: '', pin: '', sheetId: '', webhookUrl: '' })
const oauthDone    = ref(false)
const oauthLoading = ref(false)
const oauthEmail   = ref('')
const oauthName    = ref('')
const oauthPicture = ref('')
const parsedId     = ref('')
const saving       = ref(false)
const errorMsg     = ref('')
const importFileInput = ref(null)

// Cek jika sudah ada token OAuth (misal balik dari callback)
const stored = getStoredToken()
if (stored?.access_token) {
  oauthDone.value    = true
  oauthEmail.value   = stored.email  || ''
  oauthName.value    = stored.name   || ''
  oauthPicture.value = stored.picture || ''
  if (stored.name && !form.value.name) form.value.name = stored.name
}

async function doGoogleLogin() {
  oauthLoading.value = true
  try {
    const url = await initiateGoogleLogin()
    window.location.href = url
  } catch(e) {
    errorMsg.value = 'Gagal memulai login Google: ' + e.message
    oauthLoading.value = false
  }
}

function relogin() {
  oauthDone.value = false
  doGoogleLogin()
}

function parseSheetId() {
  const extracted = extractSheetId(form.value.sheetId)
  if (extracted !== form.value.sheetId) {
    parsedId.value     = extracted
    form.value.sheetId = extracted
  } else {
    parsedId.value = extracted
  }
}

async function submit() {
  errorMsg.value = ''
  if (!form.value.name.trim()) return errorMsg.value = 'Nama harus diisi'
  if (!form.value.pin || form.value.pin.length !== 4 || !/^\d+$/.test(form.value.pin))
    return errorMsg.value = 'PIN harus 4 digit angka'
  if (!oauthDone.value) return errorMsg.value = 'Silakan login dengan Google terlebih dahulu'

  saving.value = true
  try {
    // Test koneksi ke sheet jika Sheet ID diisi
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
  } catch (e) {
    errorMsg.value = 'Error: ' + e.message
  } finally {
    saving.value = false
  }
}

function onImportConfig(e) {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = async (ev) => {
    try {
      const cfg = JSON.parse(ev.target.result)
      if (!cfg.sheetId) return errorMsg.value = 'File config tidak valid'
      form.value.name       = cfg.name       || ''
      form.value.sheetId    = cfg.sheetId    || ''
      form.value.webhookUrl = cfg.webhookUrl || ''
      parsedId.value        = cfg.sheetId
      errorMsg.value = 'Config di-import. Silakan login Google & set PIN baru.'
    } catch { errorMsg.value = 'Gagal membaca file config' }
  }
  reader.readAsText(file)
  e.target.value = ''
}
</script>

<style scoped>
.setup-wrap {
  min-height: 100vh; display: flex; align-items: center; justify-content: center;
  padding: 24px 16px; background: var(--bg); position: relative; z-index: 1;
}
.setup-box {
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg);
  padding: 32px; max-width: 480px; width: 100%; max-height: 90vh; overflow-y: auto;
}
.setup-logo { font-size: 1.6rem; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 8px; }
.setup-logo span { color: var(--accent); }
.setup-box h2 { font-size: 1.2rem; font-weight: 800; margin-bottom: 6px; }
.setup-desc { font-size: 0.82rem; color: var(--text2); margin-bottom: 24px; line-height: 1.6; }
.btn-google {
  display: flex; align-items: center; gap: 10px;
  background: #fff; color: #3c4043; border: 1px solid #dadce0;
  border-radius: 6px; padding: 10px 16px; font-size: 0.88rem; font-weight: 600;
  cursor: pointer; transition: box-shadow 0.2s; width: 100%; justify-content: center;
}
.btn-google:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
.btn-google:disabled { opacity: 0.6; cursor: not-allowed; }
.oauth-area { background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; }
.oauth-success {
  display: flex; align-items: center; gap: 12px; background: var(--bg);
  border: 1px solid var(--green); border-radius: var(--radius); padding: 12px 16px;
}
.oauth-avatar { width: 36px; height: 36px; border-radius: 50%; }
.btn-link { background: none; border: none; color: var(--accent); font-size: 0.78rem; cursor: pointer; margin-left: auto; }
.sheet-id-preview { font-size: 0.78rem; color: var(--green); margin-top: 6px; }
.sheet-id-preview code { background: var(--bg); padding: 2px 6px; border-radius: 4px; font-family: monospace; }
.error-msg { color: var(--red); font-size: 0.8rem; margin-top: 10px; text-align: center; }
.or-divider { display: flex; align-items: center; gap: 10px; margin: 16px 0; color: var(--muted); font-size: 0.75rem; }
.or-divider::before, .or-divider::after { content: ''; flex: 1; height: 1px; background: var(--border); }
</style>
