<template>
  <div>
    <div class="page-header">
      <div>
        <div class="page-title">Pengaturan</div>
        <div class="page-sub">Konfigurasi aplikasi &amp; koneksi</div>
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

    <!-- Akun Google (info only, tanpa tombol ganti akun) -->
    <div class="card settings-section">
      <div class="section-title">Akun Google</div>
      <div v-if="googleAccount" class="google-account-info">
        <img v-if="googleAccount.picture" :src="googleAccount.picture" class="google-avatar" alt="foto profil" />
        <div class="google-account-detail">
          <div class="google-name">{{ googleAccount.name }}</div>
          <div class="google-email">{{ googleAccount.email }}</div>
        </div>
      </div>
      <div v-else class="form-hint" style="margin-bottom:12px">Belum ada akun Google yang terhubung.</div>
      <div class="form-hint" style="margin-top:8px">Token OAuth diperbarui otomatis.</div>
    </div>

    <!-- Google Sheets -->
    <div class="card settings-section">
      <div class="section-title">Google Sheets</div>
      <div class="form-group">
        <label class="form-label">Spreadsheet ID atau URL</label>
        <input v-model="sheetsForm.sheetId" class="form-input" placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms" @blur="parseSheetId" />
        <div v-if="parsedId" class="form-hint" style="color:var(--green)">✅ ID: <code>{{ parsedId }}</code></div>
        <div class="form-hint">Pastikan spreadsheet di-share atau milik akun Google kamu.</div>
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
      <div class="form-hint" style="margin-top:8px">Setelah 3x PIN salah, aplikasi terkunci 15 menit.</div>
    </div>

    <!-- Logout — paling bawah -->
    <div class="card settings-section" style="border-color:rgba(239,68,68,0.2)">
      <div class="section-title" style="color:var(--red)">Sesi</div>
      <p style="font-size:0.82rem;color:var(--text2);margin-bottom:14px;line-height:1.6">
        Logout akan menghapus sesi dan mengarahkan ke halaman login.
      </p>
      <button class="btn btn-danger" @click="logoutGoogle">🚪 Logout</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore }   from '@/stores/auth'
import { useTasksStore }  from '@/stores/tasks'
import { useToast }       from '@/composables/useToast'
import { useRouter }      from 'vue-router'
import { testConnection } from '@/services/googleSheets'
import { testWebhook }    from '@/services/webhook'
import { getStoredToken, extractSheetId } from '@/services/googleOAuth'

const auth   = useAuthStore()
const store  = useTasksStore()
const router = useRouter()
const toast  = useToast()

const profileForm = ref({ name: auth.userName })
const sheetsForm  = ref({ sheetId: auth.sheetId })
const webhookForm = ref({ url: auth.webhookUrl })
const pinForm     = ref({ pin: '', confirm: '' })
const parsedId    = ref('')

const googleAccount  = ref(null)
const savingProfile  = ref(false)
const savingSheets   = ref(false)
const testingConn    = ref(false)
const testingWebhook = ref(false)
const connResult     = ref(null)

onMounted(() => {
  profileForm.value.name   = auth.userName
  sheetsForm.value.sheetId = auth.sheetId
  webhookForm.value.url    = auth.webhookUrl

  const token = getStoredToken()
  if (token?.email) {
    googleAccount.value = {
      email:   token.email,
      name:    token.name    || token.email,
      picture: token.picture || ''
    }
  }
})

function parseSheetId() {
  const extracted = extractSheetId(sheetsForm.value.sheetId)
  parsedId.value = extracted
  sheetsForm.value.sheetId = extracted
}

async function saveProfile() {
  savingProfile.value = true
  try {
    await auth.saveConfig({ name: profileForm.value.name })
    toast.success('Profil disimpan ✅')
  } catch(e) { toast.error(e.message) } finally { savingProfile.value = false }
}

async function saveSheets() {
  savingSheets.value = true
  try {
    await auth.saveConfig({ sheetId: sheetsForm.value.sheetId })
    toast.success('Konfigurasi Sheets disimpan ✅')
    await store.loadAll()
  } catch(e) { toast.error(e.message) } finally { savingSheets.value = false }
}

async function testConn() {
  testingConn.value = true
  connResult.value  = null
  try {
    const title = await testConnection(auth.sheetId)
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

function logoutGoogle() {
  if (!confirm('Logout? Kamu perlu login Google lagi untuk mengakses aplikasi.')) return
  auth.logout()
  router.push('/login')
}
</script>

<style scoped>
.settings-section { margin-bottom: 14px; }
.google-account-info {
  display: flex; align-items: center; gap: 12px;
  background: var(--bg); border: 1px solid var(--green);
  border-radius: var(--radius); padding: 12px 16px;
}
.google-avatar { width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0; }
.google-name { font-weight: 600; font-size: 0.88rem; }
.google-email { font-size: 0.78rem; color: var(--text2); }
</style>
