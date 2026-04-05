import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const LS_KEY      = 'prtm_config'
const LS_LOCKOUT  = 'prtm_lockout'
const SS_KEY      = 'prtm_unlocked'

const MAX_ATTEMPTS  = 3
const LOCKOUT_MS    = 15 * 60 * 1000  // 15 menit

export const useAuthStore = defineStore('auth', () => {
  // ── State ──────────────────────────────────
  const config     = ref(loadConfig())
  const isUnlocked = ref(sessionStorage.getItem(SS_KEY) === '1')

  // ── Getters ────────────────────────────────
  const isConfigured = computed(() => !!config.value?.pinHash)
  const sheetId      = computed(() => config.value?.sheetId || '')
  const webhookUrl   = computed(() => config.value?.webhookUrl || '')
  const userName     = computed(() => config.value?.name || 'User')

  // ── PIN Lockout Helpers ────────────────────
  function loadLockout() {
    try { return JSON.parse(localStorage.getItem(LS_LOCKOUT)) || { attempts: 0, lockedUntil: null } }
    catch { return { attempts: 0, lockedUntil: null } }
  }

  function saveLockout(data) {
    localStorage.setItem(LS_LOCKOUT, JSON.stringify(data))
  }

  /**
   * Kembalikan sisa ms lockout, atau null jika tidak terkunci.
   */
  function getLockoutRemaining() {
    const lock = loadLockout()
    if (!lock.lockedUntil) return null
    const remaining = lock.lockedUntil - Date.now()
    if (remaining <= 0) {
      // Lockout sudah berakhir, reset
      saveLockout({ attempts: 0, lockedUntil: null })
      return null
    }
    return remaining
  }

  // ── Actions ────────────────────────────────
  async function verifyPin(pin) {
    // Cek lockout dulu
    const remaining = getLockoutRemaining()
    if (remaining !== null) {
      const m = Math.ceil(remaining / 60000)
      throw new Error(`Terlalu banyak percobaan. Coba lagi dalam ${m} menit.`)
    }

    const hash = await sha256(pin)
    if (hash === config.value?.pinHash) {
      // PIN benar — reset counter
      saveLockout({ attempts: 0, lockedUntil: null })
      isUnlocked.value = true
      sessionStorage.setItem(SS_KEY, '1')
      return true
    }

    // PIN salah — increment counter
    const lock = loadLockout()
    lock.attempts = (lock.attempts || 0) + 1

    if (lock.attempts >= MAX_ATTEMPTS) {
      lock.lockedUntil = Date.now() + LOCKOUT_MS
      lock.attempts    = 0
      saveLockout(lock)
      throw new Error(`PIN salah ${MAX_ATTEMPTS}x. Terkunci selama 15 menit.`)
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
      name:       name       !== undefined ? name       : config.value?.name,
      sheetId:    sheetId    !== undefined ? sheetId    : config.value?.sheetId,
      webhookUrl: webhookUrl !== undefined ? webhookUrl : config.value?.webhookUrl,
      pinHash:    config.value?.pinHash
    }
    if (pin) {
      newCfg.pinHash = await sha256(pin)
    }
    config.value = newCfg
    persistConfig(newCfg)
  }

  async function changePin(newPin) {
    const hash = await sha256(newPin)
    config.value.pinHash = hash
    persistConfig(config.value)
  }

  function resetConfig() {
    localStorage.removeItem(LS_KEY)
    localStorage.removeItem(LS_LOCKOUT)
    sessionStorage.removeItem(SS_KEY)
    config.value     = {}
    isUnlocked.value = false
  }

  return {
    config, isUnlocked, isConfigured,
    sheetId, webhookUrl, userName,
    getLockoutRemaining,
    verifyPin, lock, saveConfig, changePin, resetConfig
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
