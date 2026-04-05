<template>
  <div>
    <div class="page-header">
      <div>
        <div class="page-title">Pengaturan</div>
        <div class="page-sub">Konfigurasi aplikasi & koneksi</div>
      </div>
    </div>

    <!-- Profil -->
    <div class="card settings-section">
      <div class="section-title">Profil</div>
      <div class="form-group">
        <label class="form-label">Nama</label>
        <input v-model="profileForm.name" class="form-input" placeholder="Nama kamu" />
      </div>
      <button class="btn btn-primary" :disabled="savingProfile" @click="saveProfile">
        {{ savingProfile ? '⏳ Menyimpan...' : '💾 Simpan' }}
      </button>
    </div>

    <!-- Akun Google -->
    <div class="card settings-section">
      <div class="section-title">Akun Google</div>
      <div v-if="auth.isOAuthReady" class="oauth-info">
        <img v-if="auth.googlePicture" :src="auth.googlePicture" class="oauth-avatar" />
        <div class="oauth-detail">
          <div class="oauth-name">{{ auth.googleName || auth.userName }}</div>
          <div class="oauth-email">{{ auth.googleEmail }}</div>
        </div>
        <span :class="['conn-badge', connStatus === 'ok' ? 'badge-ok' : connStatus === 'error' ? 'badge-err' : 'badge-idle']">{{ connLabel }}</span>
      </div>
      <div v-else class="oauth-warn">
        ⚠️ Belum login Google.
        <button class="btn-link" @click="doRelogin">Login sekarang</button>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
        <button class="btn btn-secondary" :disabled="testingConn" @click="testConn">
          {{ testingConn ? '⏳ Testing...' : '🧪 Test Koneksi Sheets' }}
        </button>
        <button class="btn btn-secondary" @click="doRelogin">🔄 Ganti Akun Google</button>
      </div>
    </div>

    <!-- Google Sheets -->
    <div class="card settings-section">
      <div class="section-title">Google Sheets</div>
      <div class="form-group">
        <label class="form-label">Spreadsheet ID atau URL</label>
        <input v-model="sheetsForm.sheetId" class="form-input" @blur="parseSheetId" />
        <div v-if="parsedId" class="sheet-preview">ID: <code>{{ parsedId }}</code></div>
      </div>
      <button class="btn btn-primary" :disabled="savingSheets" @click="saveSheets">
        {{ savingSheets ? '⏳ Menyimpan...' : '💾 Simpan Sheet ID' }}
      </button>
    </div>

    <!-- Webhook -->
    <div class="card settings-section">
      <div class="section-title">Webhook n8n</div>
      <div class="form-group">
        <label class="form-label">Webhook URL</label>
        <input v-model="webhookForm.url" type="url" class="form-input" placeholder="https://n8n.domain.com/webhook/xxx" />
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary" @click="saveWebhook">💾 Simpan</button>
        <button class="btn btn-secondary" :disabled="testingWebhook" @click="doTestWebhook">
          {{ testingWebhook ? '⏳ Mengirim...' : '🧪 Test Webhook' }}
        </button>
      </div>
    </div>

    <!-- Security -->
    <div class="card settings-section">
      <div class="section-title">Keamanan</div>
      <div class="form-group">
        <label class="form-label">PIN Baru</label>
        <input v-model="pinForm.pin" type="password" inputmode="numeric" maxlength="4" class="form-input" placeholder="Masukkan PIN baru (4 digit)" />
      </div>
      <div class="form-group">
        <label class="form-label">Konfirmasi PIN</label>
        <input v-model="pinForm.confirm" type="password" inputmode="numeric" maxlength="4" class="form-input" placeholder="Ulangi PIN baru" />
      </div>
      <button class="btn btn-primary" @click="savePin">🔐 Ubah PIN</button>
    </div>

    <!-- Transfer Config -->
    <div class="card settings-section" style="border-color:rgba(59,130,246,0.2)">
      <div class="section-title">Transfer ke Device Lain</div>
      <p style="font-size:0.82rem;color:var(--text2);margin-bottom:16px;line-height:1.6">
        Export konfigurasi (Sheet ID, webhook) ke file JSON.
        Di device baru, upload file ini saat Setup untuk skip pengisian manual.
        PIN dan login Google harus di-setup ulang di device baru.
      </p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary" @click="exportConfig">📤 Export Config</button>
        <div>
          <button class="btn btn-secondary" @click="importConfigInput.click()">📥 Import Config</button>
          <input ref="importConfigInput" type="file" accept=".json" style="display:none" @change="importConfig" />
        </div>
      </div>
    </div>

    <!-- Danger Zone -->
    <div class="card settings-section" style="border-color:rgba(239,68,68,0.3)">
      <div class="section-title" style="color:var(--red)">Danger Zone</div>
      <p style="font-size:0.82rem;color:var(--text2);margin-bottom:16px;line-height:1.6">
        Reset semua konfigurasi dan data lokal. Data di Google Sheets <strong>tidak akan terhapus</strong>.
      </p>
      <button class="btn btn-danger" @click="resetApp">🗑️ Reset Aplikasi</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useTasksStore } from '@/stores/tasks'
import { useToast } from '@/composables/useToast'
import { useRouter } from 'vue-router'
import { testConnection } from '@/services/googleSheets'
import { testWebhook } from '@/services/webhook'
import { initiateGoogleLogin, extractSheetId } from '@/services/googleOAuth'

const auth   = useAuthStore()
const store  = useTasksStore()
const router = useRouter()
const toast  = useToast()

const profileForm = ref({ name: auth.userName })
const sheetsForm  = ref({ sheetId: auth.sheetId })
const webhookForm = ref({ url: auth.webhookUrl })
const pinForm     = ref({ pin: '', confirm: '' })
const parsedId    = ref('')
const importConfigInput = ref(null)

const savingProfile  = ref(false)
const savingSheets   = ref(false)
const testingConn    = ref(false)
const testingWebhook = ref(false)
const connStatus     = ref('idle')
const connLabel      = ref('Belum dicek')

onMounted(async () => {
  profileForm.value.name   = auth.userName
  sheetsForm.value.sheetId = auth.sheetId
  webhookForm.value.url    = auth.webhookUrl
  // Auto test koneksi
  if (auth.sheetId && auth.isOAuthReady) {
    await testConn()
  }
})

function parseSheetId() {
  const extracted = extractSheetId(sheetsForm.value.sheetId)
  if (extracted) {
    sheetsForm.value.sheetId = extracted
    parsedId.value = extracted
  }
}

async function saveProfile() {
  savingProfile.value = true
  try { await auth.saveConfig({ name: profileForm.value.name }); toast.success('Profil disimpan ✅') }
  catch(e) { toast.error(e.message) } finally { savingProfile.value = false }
}

async function saveSheets() {
  savingSheets.value = true
  try {
    await auth.saveConfig({ sheetId: sheetsForm.value.sheetId })
    toast.success('Sheet ID disimpan ✅')
    await store.loadAll()
  } catch(e) { toast.error(e.message) } finally { savingSheets.value = false }
}

async function testConn() {
  testingConn.value = true
  connStatus.value  = 'idle'
  connLabel.value   = 'Testing...'
  try {
    const title = await testConnection(auth.sheetId)
    connStatus.value = 'ok'
    connLabel.value  = `✅ "${title}"`
  } catch(e) {
    connStatus.value = 'error'
    connLabel.value  = '✕ ' + e.message
  } finally { testingConn.value = false }
}

async function saveWebhook() {
  await auth.saveConfig({ webhookUrl: webhookForm.value.url })
  toast.success('Webhook URL disimpan ✅')
}

async function doTestWebhook() {
  if (!auth.webhookUrl) return toast.error('Webhook URL belum diisi')
  testingWebhook.value = true
  try { await testWebhook(auth.webhookUrl); toast.success('Webhook dikirim! Cek n8n kamu 📩') }
  catch(e) { toast.error('Gagal: ' + e.message) } finally { testingWebhook.value = false }
}

async function doRelogin() {
  const url = await initiateGoogleLogin()
  window.location.href = url
}

async function savePin() {
  const { pin, confirm } = pinForm.value
  if (!pin) return toast.error('PIN baru wajib diisi')
  if (pin.length !== 4 || !/^\d+$/.test(pin)) return toast.error('PIN harus 4 digit angka')
  if (pin !== confirm) return toast.error('Konfirmasi PIN tidak cocok')
  await auth.changePin(pin)
  pinForm.value = { pin: '', confirm: '' }
  toast.success('PIN berhasil diubah ✅')
}

function exportConfig() {
  const cfg = {
    name:       auth.userName,
    sheetId:    auth.sheetId,
    webhookUrl: auth.webhookUrl,
    exportedAt: new Date().toISOString(),
    version:    '2.0'
  }
  const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a'); a.href = url; a.download = 'prtm-config.json'; a.click()
  URL.revokeObjectURL(url)
  toast.success('Config berhasil di-export 📤')
}

function importConfig(e) {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = async (ev) => {
    try {
      const cfg = JSON.parse(ev.target.result)
      if (!cfg.sheetId) return toast.error('File config tidak valid')
      await auth.saveConfig({ name: cfg.name, sheetId: cfg.sheetId, webhookUrl: cfg.webhookUrl || '' })
      toast.success('Config di-import! Silakan login Google ulang.')
      profileForm.value.name   = cfg.name || ''
      sheetsForm.value.sheetId = cfg.sheetId || ''
      webhookForm.value.url    = cfg.webhookUrl || ''
    } catch { toast.error('Gagal membaca file config') }
  }
  reader.readAsText(file)
  e.target.value = ''
}

function resetApp() {
  if (!confirm('Reset semua data lokal? (Data Google Sheets tidak terhapus)')) return
  auth.resetConfig()
  router.push('/setup')
}
</script>

<style scoped>
.settings-section { margin-bottom: 14px; }
.oauth-info { display: flex; align-items: center; gap: 12px; padding: 10px 0; flex-wrap: wrap; }
.oauth-avatar { width: 40px; height: 40px; border-radius: 50%; }
.oauth-detail { flex: 1; }
.oauth-name  { font-weight: 600; font-size: 0.88rem; }
.oauth-email { font-size: 0.78rem; color: var(--text2); }
.oauth-warn  { font-size: 0.82rem; color: var(--yellow); }
.btn-link { background: none; border: none; color: var(--accent); font-size: 0.82rem; cursor: pointer; text-decoration: underline; }
.conn-badge { font-size: 0.75rem; padding: 3px 8px; border-radius: 999px; font-weight: 600; }
.badge-ok   { background: rgba(16,185,129,0.15); color: var(--green); }
.badge-err  { background: rgba(239,68,68,0.15);  color: var(--red); }
.badge-idle { background: var(--surface2); color: var(--text2); }
.sheet-preview { font-size: 0.78rem; color: var(--text2); margin-top: 4px; }
.sheet-preview code { background: var(--bg); padding: 2px 6px; border-radius: 4px; font-family: monospace; }
</style>
