import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getStoredToken, storeToken, clearToken, getAccessToken, oauthLogout, fetchUserInfo } from '@/services/googleOAuth'

const LS_KEY     = 'prtm_config'
const LS_LOCK    = 'prtm_lockout'
const SS_KEY     = 'prtm_unlocked'

// Konstanta proteksi PIN
const MAX_ATTEMPTS  = 3
const LOCKOUT_MS    = 15 * 60 * 1000  // 15 menit

export const useAuthStore = defineStore('auth', () => {
  const config     = ref(loadConfig())
  const isUnlocked = ref(sessionStorage.getItem(SS_KEY) === '1')

  // ── Getters ────────────────────────────────
  const isConfigured  = computed(() => !!config.value?.pinHash)
  const sheetId       = computed(() => config.value?.sheetId || '')
  const webhookUrl    = computed(() => config.value?.webhookUrl || '')
  const userName      = computed(() => config.value?.name || 'User')

  // Info akun Google dari stored OAuth token
  const googleEmail   = computed(() => getStoredToken()?.email || '')
  const googleName    = computed(() => getStoredToken()?.name  || '')
  const googlePicture = computed(() => getStoredToken()?.picture || '')
  const isOAuthReady  = computed(() => !!getStoredToken()?.access_token)

  // ── PIN Lockout ─────────────────────────────
  function getLockout() {
    try { return JSON.parse(localStorage.getItem(LS_LOCK)) || { attempts: 0, lockedUntil: null } }
    catch { return { attempts: 0, lockedUntil: null } }
  }

  function saveLockout(data) {
    localStorage.setItem(LS_LOCK, JSON.stringify(data))
  }

  function resetLockout() {
    localStorage.removeItem(LS_LOCK)
  }

  // Kembalikan sisa menit/detik lockout, null jika tidak locked
  function getLockoutRemaining() {
    const lock = getLockout()
    if (!lock.lockedUntil) return null
    const remaining = lock.lockedUntil - Date.now()
    if (remaining <= 0) { resetLockout(); return null }
    return remaining
  }

  // ── Actions ────────────────────────────────
  async function verifyPin(pin) {
    // Cek apakah sedang locked
    const remaining = getLockoutRemaining()
    if (remaining !== null) {
      const mins = Math.ceil(remaining / 60_000)
      throw new Error(`Terlalu banyak percobaan. Coba lagi dalam ${mins} menit.`)
    }

    const hash = await sha256(pin)
    if (hash === config.value?.pinHash) {
      resetLockout()
      isUnlocked.value = true
      sessionStorage.setItem(SS_KEY, '1')
      return true
    }

    // PIN salah — increment counter
    const lock = getLockout()
    lock.attempts = (lock.attempts || 0) + 1

    if (lock.attempts >= MAX_ATTEMPTS) {
      lock.lockedUntil = Date.now() + LOCKOUT_MS
      lock.attempts    = 0
      saveLockout(lock)
      throw new Error(`PIN salah ${MAX_ATTEMPTS}x. Tunggu 15 menit sebelum mencoba lagi.`)
    }

    saveLockout(lock)
    const sisa = MAX_ATTEMPTS - lock.attempts
    throw new Error(`PIN salah. Sisa percobaan: ${sisa}`)
  }

  function lock() {
    isUnlocked.value = false
    sessionStorage.removeItem(SS_KEY)
  }

  async function saveConfig({ name, pin, sheetId, webhookUrl }) {
    const newCfg = {
      name:       name       ?? config.value?.name,
      sheetId:    sheetId    ?? config.value?.sheetId,
      webhookUrl: webhookUrl ?? config.value?.webhookUrl,
      pinHash:    config.value?.pinHash
    }
    if (pin) newCfg.pinHash = await sha256(pin)
    config.value = newCfg
    persistConfig(newCfg)
  }

  async function changePin(newPin) {
    config.value.pinHash = await sha256(newPin)
    persistConfig(config.value)
  }

  function resetConfig() {
    localStorage.removeItem(LS_KEY)
    sessionStorage.removeItem(SS_KEY)
    resetLockout()
    oauthLogout()
    config.value     = {}
    isUnlocked.value = false
  }

  // Simpan token OAuth setelah callback berhasil
  function setOAuthToken(token) {
    storeToken(token)
    // Update nama jika belum ada di config
    if (token.name && !config.value?.name) {
      config.value = { ...config.value, name: token.name }
      persistConfig(config.value)
    }
  }

  return {
    config, isUnlocked, isConfigured,
    sheetId, webhookUrl, userName,
    googleEmail, googleName, googlePicture, isOAuthReady,
    getLockoutRemaining, getLockout,
    verifyPin, lock, saveConfig, changePin, resetConfig, setOAuthToken
  }
})

// ── Helpers ──────────────────────────────────
function loadConfig() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {} }
  catch { return {} }
}

function persistConfig(cfg) {
  localStorage.setItem(LS_KEY, JSON.stringify(cfg))
}

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}
