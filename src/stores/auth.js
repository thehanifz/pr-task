/**
 * stores/auth.js
 * 
 * Config tersimpan di:
 * 1. localStorage (prtm_config) — cepat, lokal per-browser
 * 2. Server (server/data/users.json) — permanen, cross-browser
 * 
 * Flow:
 * - Login OAuth → otomatis pull config dari server → simpan ke localStorage
 * - saveConfig() → update localStorage + push ke server (jika sudah OAuth login)
 */

import { defineStore }   from 'pinia'
import { ref, computed }  from 'vue'
import { getStoredToken, isTokenValid, getAccessToken } from '@/services/googleOAuth'

const LS_KEY      = 'prtm_config'
const LS_LOCKOUT  = 'prtm_lockout'
const SS_KEY      = 'prtm_unlocked'

const MAX_ATTEMPTS  = 3
const LOCKOUT_MS    = 15 * 60 * 1000

export const useAuthStore = defineStore('auth', () => {
  const config     = ref(loadConfig())
  const isUnlocked = ref(sessionStorage.getItem(SS_KEY) === '1')
  const syncing    = ref(false)
  const syncError  = ref('')

  // ── Getters ────────────────────────────────
  const isConfigured = computed(() => !!config.value?.pinHash)
  const sheetId      = computed(() => config.value?.sheetId || '')
  const webhookUrl   = computed(() => config.value?.webhookUrl || '')
  const userName     = computed(() => config.value?.name || 'User')
  const isOAuthLogin = computed(() => {
    const t = getStoredToken()
    return !!(t?.access_token)
  })

  // ── Lockout Helpers ────────────────────────
  function loadLockout() {
    try { return JSON.parse(localStorage.getItem(LS_LOCKOUT)) || { attempts: 0, lockedUntil: null } }
    catch { return { attempts: 0, lockedUntil: null } }
  }
  function saveLockout(data) {
    localStorage.setItem(LS_LOCKOUT, JSON.stringify(data))
  }
  function getLockoutRemaining() {
    const lock = loadLockout()
    if (!lock.lockedUntil) return null
    const remaining = lock.lockedUntil - Date.now()
    if (remaining <= 0) { saveLockout({ attempts: 0, lockedUntil: null }); return null }
    return remaining
  }

  // ── Verify PIN ────────────────────────────
  async function verifyPin(pin) {
    const remaining = getLockoutRemaining()
    if (remaining !== null) {
      const m = Math.ceil(remaining / 60000)
      throw new Error(`Terlalu banyak percobaan. Coba lagi dalam ${m} menit.`)
    }
    const hash = await sha256(pin)
    if (hash === config.value?.pinHash) {
      saveLockout({ attempts: 0, lockedUntil: null })
      isUnlocked.value = true
      sessionStorage.setItem(SS_KEY, '1')
      return true
    }
    const lock = loadLockout()
    lock.attempts = (lock.attempts || 0) + 1
    if (lock.attempts >= MAX_ATTEMPTS) {
      lock.lockedUntil = Date.now() + LOCKOUT_MS
      lock.attempts    = 0
      saveLockout(lock)
      throw new Error(`PIN salah ${MAX_ATTEMPTS}x. Terkunci selama 15 menit.`)
    }
    saveLockout(lock)
    throw new Error(`PIN salah. Sisa percobaan: ${MAX_ATTEMPTS - lock.attempts}`)
  }

  function lock() {
    isUnlocked.value = false
    sessionStorage.removeItem(SS_KEY)
  }

  // ── Save Config (localStorage + server) ───
  async function saveConfig({ name, pin, sheetId, webhookUrl }) {
    const newCfg = {
      name:       name       !== undefined ? name       : config.value?.name,
      sheetId:    sheetId    !== undefined ? sheetId    : config.value?.sheetId,
      webhookUrl: webhookUrl !== undefined ? webhookUrl : config.value?.webhookUrl,
      pinHash:    config.value?.pinHash
    }
    if (pin) newCfg.pinHash = await sha256(pin)

    config.value = newCfg
    persistConfig(newCfg)

    // ✅ Push ke server jika sudah OAuth login
    await pushConfigToServer(newCfg).catch(e => {
      console.warn('[auth] Gagal sync ke server:', e.message)
    })
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

  // ── Sync dari server ke localStorage ──────
  /**
   * Pull config dari server berdasarkan email OAuth.
   * Dipanggil otomatis setelah login OAuth berhasil.
   * Jika server punya data → merge ke localStorage (server menang untuk sheetId & webhook)
   */
  async function pullConfigFromServer() {
    const token = getStoredToken()
    if (!token?.email) return { pulled: false, reason: 'no_oauth' }

    syncing.value  = true
    syncError.value = ''
    try {
      const res  = await fetch(`/api/user/${encodeURIComponent(token.email)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()

      if (!data.found) {
        syncing.value = false
        return { pulled: false, reason: 'not_found' }
      }

      // Merge — server menang untuk sheetId & webhook, localStorage dipertahankan untuk PIN & name
      const merged = {
        ...config.value,
        sheetId:    data.sheetId    || config.value?.sheetId    || '',
        webhookUrl: data.webhook    || config.value?.webhookUrl || '',
        name:       data.name       || config.value?.name       || token.name || 'User'
      }
      config.value = merged
      persistConfig(merged)

      syncing.value = false
      return { pulled: true, sheetId: merged.sheetId, webhookUrl: merged.webhookUrl }
    } catch (e) {
      syncError.value = e.message
      syncing.value   = false
      return { pulled: false, reason: e.message }
    }
  }

  // ── Push config ke server ─────────────────
  async function pushConfigToServer(cfg) {
    const token = getStoredToken()
    if (!token?.email) return  // belum login OAuth, skip

    let accessToken
    try { accessToken = await getAccessToken() } catch { return }  // token expired, skip

    const body = {
      email:   token.email,
      sheetId: cfg?.sheetId    || config.value?.sheetId    || '',
      webhook: cfg?.webhookUrl || config.value?.webhookUrl || '',
      name:    cfg?.name       || config.value?.name       || ''
    }
    if (!body.sheetId && !body.webhook) return  // tidak ada yang perlu disimpan

    const res = await fetch('/api/user/save', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(body)
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `HTTP ${res.status}`)
    }
    return res.json()
  }

  return {
    config, isUnlocked, isConfigured, syncing, syncError,
    sheetId, webhookUrl, userName, isOAuthLogin,
    getLockoutRemaining,
    verifyPin, lock, saveConfig, changePin, resetConfig,
    pullConfigFromServer, pushConfigToServer
  }
})

// ── Helpers ───────────────────────────────────
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
