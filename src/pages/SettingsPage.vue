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

    <!-- Google Sheets -->
    <div class="card settings-section">
      <div class="section-title">Google Sheets</div>
      <div class="form-group">
        <label class="form-label">Spreadsheet ID</label>
        <input v-model="sheetsForm.sheetId" class="form-input" />
      </div>
      <div class="form-group">
        <label class="form-label">Ganti credential.json</label>
        <div class="upload-area" @click="fileInput.click()" @dragover.prevent @drop.prevent="onDrop">
          <span v-if="!newCredential">📁 Klik atau drag credential.json baru</span>
          <span v-else style="color:var(--green)">✅ credential.json baru siap disimpan</span>
        </div>
        <input ref="fileInput" type="file" accept=".json" style="display:none" @change="onFileChange" />
        <div class="form-hint">Kosongkan jika tidak ingin mengubah credentials</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary" :disabled="savingSheets" @click="saveSheets">
          {{ savingSheets ? '⏳ Menyimpan...' : '💾 Simpan' }}
        </button>
        <button class="btn btn-secondary" :disabled="testingConn" @click="testConn">
          {{ testingConn ? '⏳ Testing...' : '🧪 Test Koneksi' }}
        </button>
      </div>
      <div v-if="connResult" :style="{ color: connResult.ok ? 'var(--green)' : 'var(--red)', marginTop: '10px', fontSize: '0.82rem' }">
        {{ connResult.msg }}
      </div>
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
        Export semua konfigurasi (termasuk credential) ke file JSON.
        Di device baru, upload file ini saat Setup untuk skip pengisian manual.
        PIN tidak ikut export — harus di-set ulang di device baru.
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

const auth   = useAuthStore()
const store  = useTasksStore()
const router = useRouter()
const toast  = useToast()

const profileForm = ref({ name: auth.userName })
const sheetsForm  = ref({ sheetId: auth.sheetId })
const webhookForm = ref({ url: auth.webhookUrl })
const pinForm     = ref({ pin: '', confirm: '' })
const newCredential = ref(null)
const fileInput        = ref(null)
const importConfigInput = ref(null)

const savingProfile = ref(false)
const savingSheets  = ref(false)
const testingConn   = ref(false)
const testingWebhook = ref(false)
const connResult    = ref(null)

onMounted(() => {
  profileForm.value.name     = auth.userName
  sheetsForm.value.sheetId   = auth.sheetId
  webhookForm.value.url      = auth.webhookUrl
})

async function saveProfile() {
  savingProfile.value = true
  try {
    await auth.saveConfig({ name: profileForm.value.name })
    toast.success('Profil disimpan ✅')
  } catch(e) { toast.error(e.message) } finally { savingProfile.value = false }
}

function onFileChange(e) { readCred(e.target.files[0]) }
function onDrop(e)       { readCred(e.dataTransfer.files[0]) }
function readCred(file) {
  if (!file) return
  const r = new FileReader()
  r.onload = (e) => {
    try { newCredential.value = JSON.parse(e.target.result) }
    catch { toast.error('File JSON tidak valid') }
  }
  r.readAsText(file)
}

async function saveSheets() {
  savingSheets.value = true
  try {
    await auth.saveConfig({
      sheetId:    sheetsForm.value.sheetId,
      credential: newCredential.value || undefined
    })
    newCredential.value = null
    toast.success('Konfigurasi Sheets disimpan ✅')
    await store.loadAll()
  } catch(e) { toast.error(e.message) } finally { savingSheets.value = false }
}

async function testConn() {
  testingConn.value = true
  connResult.value  = null
  try {
    const title = await testConnection(auth.sheetId, auth.credential)
    connResult.value = { ok: true, msg: `✅ Terhubung ke: "${title}"` }
  } catch(e) {
    connResult.value = { ok: false, msg: '✕ ' + e.message }
  } finally { testingConn.value = false }
}

async function saveWebhook() {
  await auth.saveConfig({ webhookUrl: webhookForm.value.url })
  toast.success('Webhook URL disimpan ✅')
}

async function doTestWebhook() {
  if (!auth.webhookUrl) return toast.error('Webhook URL belum diisi')
  testingWebhook.value = true
  try {
    await testWebhook(auth.webhookUrl)
    toast.success('Webhook dikirim! Cek n8n kamu 📩')
  } catch(e) { toast.error('Gagal: ' + e.message) } finally { testingWebhook.value = false }
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
    name:        auth.userName,
    sheetId:     auth.sheetId,
    webhookUrl:  auth.webhookUrl,
    credential:  auth.credential,
    exportedAt:  new Date().toISOString(),
    version:     '1.0'
  }
  const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = 'prtm-config.json'
  a.click()
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
      if (!cfg.sheetId || !cfg.credential) {
        return toast.error('File config tidak valid atau tidak lengkap')
      }
      await auth.saveConfig({
        name:       cfg.name,
        sheetId:    cfg.sheetId,
        webhookUrl: cfg.webhookUrl || '',
        credential: cfg.credential
      })
      toast.success('Config berhasil di-import! Silakan set PIN baru.')
      // Reset form fields
      profileForm.value.name   = cfg.name || ''
      sheetsForm.value.sheetId = cfg.sheetId || ''
      webhookForm.value.url    = cfg.webhookUrl || ''
    } catch {
      toast.error('Gagal membaca file config')
    }
  }
  reader.readAsText(file)
  // Reset input supaya file yang sama bisa diupload ulang
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
.upload-area {
  border: 2px dashed var(--border2);
  border-radius: var(--radius);
  padding: 16px;
  text-align: center;
  cursor: pointer;
  font-size: 0.82rem;
  color: var(--text2);
  transition: all 0.2s;
}
.upload-area:hover { border-color: var(--accent); color: var(--text); background: var(--accent-glow); }
</style>