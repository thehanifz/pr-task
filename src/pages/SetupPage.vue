<template>
  <div class="setup-wrap">
    <div class="setup-box">
      <div class="setup-logo">PR<span>.</span>Tasks</div>
      <h2>⚙️ Setup Pertama Kali</h2>
      <p class="setup-desc">Isi konfigurasi berikut untuk mulai. Data tersimpan lokal di browser kamu.</p>

      <div class="form-group">
        <label class="form-label">Nama Kamu</label>
        <input v-model="form.name" class="form-input" placeholder="contoh: Rizky" />
      </div>

      <div class="form-group">
        <label class="form-label">PIN (4 digit angka)</label>
        <input v-model="form.pin" type="password" inputmode="numeric" maxlength="4" class="form-input" placeholder="Masukkan PIN 4 digit" />
      </div>

      <hr style="border-color:var(--border);margin:8px 0 16px" />

      <div class="form-group">
        <label class="form-label">Google Spreadsheet ID</label>
        <input v-model="form.sheetId" class="form-input" placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms" />
        <div class="form-hint">Dari URL: docs.google.com/spreadsheets/d/<strong style="color:var(--accent)">[ID INI]</strong>/edit</div>
      </div>

      <div class="form-group">
        <label class="form-label">Upload credential.json</label>
        <div class="upload-area" @click="fileInput.click()" @dragover.prevent @drop.prevent="onDrop">
          <span v-if="!credentialLoaded">📁 Klik atau drag credential.json di sini</span>
          <span v-else style="color:var(--green)">✅ credential.json berhasil dimuat</span>
        </div>
        <input ref="fileInput" type="file" accept=".json" style="display:none" @change="onFileChange" />
        <div class="form-hint">File JSON Service Account dari Google Cloud Console</div>
      </div>

      <div class="form-group">
        <label class="form-label">n8n Webhook URL (opsional)</label>
        <input v-model="form.webhookUrl" type="url" class="form-input" placeholder="https://n8n.domain.com/webhook/xxx" />
      </div>

      <button class="btn btn-primary btn-full" :disabled="saving" @click="submit" style="margin-top:8px">
        {{ saving ? '⏳ Menyimpan...' : '🚀 Mulai Gunakan' }}
      </button>

      <div v-if="errorMsg" style="color:var(--red);font-size:0.8rem;margin-top:10px;text-align:center">{{ errorMsg }}</div>

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

const auth   = useAuthStore()
const router = useRouter()

const form = ref({ name: '', pin: '', sheetId: '', webhookUrl: '' })
const credential = ref(null)
const credentialLoaded = ref(false)
const fileInput      = ref(null)
const importFileInput = ref(null)
const saving    = ref(false)
const errorMsg  = ref('')

function onFileChange(e) {
  const file = e.target.files[0]
  if (file) readCredential(file)
}
function onDrop(e) {
  const file = e.dataTransfer.files[0]
  if (file) readCredential(file)
}
function readCredential(file) {
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      credential.value = JSON.parse(e.target.result)
      credentialLoaded.value = true
      errorMsg.value = ''
    } catch {
      errorMsg.value = 'File JSON tidak valid'
    }
  }
  reader.readAsText(file)
}

function onImportConfig(e) {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = async (ev) => {
    try {
      const cfg = JSON.parse(ev.target.result)
      if (!cfg.sheetId || !cfg.credential) {
        return errorMsg.value = 'File config tidak valid atau tidak lengkap'
      }
      form.value.name       = cfg.name       || ''
      form.value.sheetId    = cfg.sheetId    || ''
      form.value.webhookUrl = cfg.webhookUrl || ''
      credential.value      = cfg.credential
      credentialLoaded.value = true
      errorMsg.value = ''
    } catch {
      errorMsg.value = 'Gagal membaca file config'
    }
  }
  reader.readAsText(file)
  e.target.value = ''
}

async function submit() {
  errorMsg.value = ''
  if (!form.value.name.trim()) return errorMsg.value = 'Nama harus diisi'
  if (!form.value.pin || form.value.pin.length !== 4 || !/^\d+$/.test(form.value.pin))
    return errorMsg.value = 'PIN harus 4 digit angka'
  if (!form.value.sheetId.trim()) return errorMsg.value = 'Spreadsheet ID harus diisi'
  if (!credential.value) return errorMsg.value = 'credential.json belum diupload'

  saving.value = true
  try {
    // Test koneksi dulu
    await testConnection(form.value.sheetId, credential.value)
    // Simpan config
    await auth.saveConfig({
      name:       form.value.name,
      pin:        form.value.pin,
      sheetId:    form.value.sheetId,
      credential: credential.value,
      webhookUrl: form.value.webhookUrl
    })
    router.push('/lock')
  } catch (e) {
    errorMsg.value = 'Gagal koneksi ke Sheets: ' + e.message
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
  position: relative;
  z-index: 1;
}
.setup-box {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 32px;
  max-width: 480px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}
.setup-logo {
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: -0.5px;
  margin-bottom: 8px;
}
.setup-logo span { color: var(--accent); }
.setup-box h2 { font-size: 1.2rem; font-weight: 800; margin-bottom: 6px; }
.setup-desc { font-size: 0.82rem; color: var(--text2); margin-bottom: 24px; line-height: 1.6; }

.upload-area {
  border: 2px dashed var(--border2);
  border-radius: var(--radius);
  padding: 20px;
  text-align: center;
  cursor: pointer;
  font-size: 0.82rem;
  color: var(--text2);
  transition: all 0.2s;
}
.upload-area:hover { border-color: var(--accent); color: var(--text); background: var(--accent-glow); }
.or-divider {
  display: flex; align-items: center; gap: 10px;
  margin: 16px 0; color: var(--muted); font-size: 0.75rem;
}
.or-divider::before, .or-divider::after {
  content: ''; flex: 1; height: 1px; background: var(--border);
}
</style>