/**
 * stores/auth.js
 *
 * Config tersimpan di:
 * 1. localStorage (prtm_config) — cepat, lokal per-browser
 * 2. Server (server/data/users.json) — permanen, cross-browser
 *
 * Flow logout:
 *   logout() → hapus SEMUA data lokal (token + config + lockout + session)
 *   → isConfigured = false → router guard redirect ke /login
 *
 * Flow login kembali:
 *   OAuth → OAuthCallback → pullConfigFromServer → restore semua config dari server
 */

import { defineStore }   from 'pinia'
import { ref, computed }  from 'vue'
import { getStoredToken, getAccessToken, clearToken } from '@/services/googleOAuth'

const LS_KEY     = 'prtm_config'
const LS_LOCKOUT = 'prtm_lockout'
const SS_KEY     = 'prtm_unlocked'

const MAX_ATTEMPTS = 3
const LOCKOUT_MS   = 15 * 60 * 1000

export const useAuthStore = defineStore('auth', () => {
  const config     = ref(loadConfig())
  const isUnlocked = ref(sessionStorage.getItem(SS_KEY) === '1')
  const syncing    = ref(false)
  const syncError  = ref('')

  // ── Getters ──
  const isConfigured = computed(() => !!config.value?.pinHash)
  const sheetId      = computed(() => config.value?.sheetId    || '')
  const webhookUrl   = computed(() => config.value?.webhookUrl || '')
  const userName     = computed(() => config.value?.name       || 'User')
  const isOAuthLogin = computed(() => !!getStoredToken()?.access_token)

  // ── Lockout ──
  function loadLockout() {
    try { return JSON.parse(localStorage.getItem(LS_LOCKOUT)) || { attempts: 0, lockedUntil: null } }
    catch { return { attempts: 0, lockedUntil: null } }
  }
  function saveLockout(data) { localStorage.setItem(LS_LOCKOUT, JSON.stringify(data)) }
  function getLockoutRemaining() {
    const lock = loadLockout()
    if (!lock.lockedUntil) return null
    const rem = lock.lockedUntil - Date.now()
    if (rem <= 0) { saveLockout({ attempts: 0, lockedUntil: null }); return null }
    return rem
  }

  // ── Verify PIN ──
  async function verifyPin(pin) {
    const rem = getLockoutRemaining()
    if (rem !== null) throw new Error(`Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(rem / 60000)} menit.`)

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

  // ── Save Config (localStorage + push ke server) ──
  async function saveConfig({ name, pin, sheetId, webhookUrl }) {
    const newCfg = {
      name:       name       !== undefined ? name       : config.value?.name,
      sheetId:    sheetId    !== undefined ? sheetId    : config.value?.sheetId,
      webhookUrl: webhookUrl !== undefined ? webhookUrl : config.value?.webhookUrl,
      pinHash:    config.value?.pinHash || ''
    }
    if (pin) newCfg.pinHash = await sha256(pin)

    config.value = newCfg
    persistConfig(newCfg)
    await pushConfigToServer(newCfg).catch(e =>
      console.warn('[auth] Gagal sync ke server:', e.message)
    )
  }

  async function changePin(newPin) {
    const hash = await sha256(newPin)
    config.value.pinHash = hash
    persistConfig(config.value)
    await pushConfigToServer(config.value).catch(e =>
      console.warn('[auth] Gagal sync pinHash ke server:', e.message)
    )
  }

  /**
   * Logout penuh — hapus SEMUA data lokal.
   * Data tetap ada di server, akan di-restore saat login lagi via pullConfigFromServer.
   */
  function logout() {
    clearToken()                            // hapus prtm_oauth_token
    localStorage.removeItem(LS_KEY)        // hapus config (termasuk pinHash)
    localStorage.removeItem(LS_LOCKOUT)    // hapus lockout state
    sessionStorage.removeItem(SS_KEY)      // hapus session unlock
    config.value     = {}                  // reset reactive state
    isUnlocked.value = false
    // isConfigured otomatis false → router guard redirect ke /login ✓
  }

  /**
   * Reset App (Danger Zone) — sama dengan logout tapi juga hapus data di server? Tidak.
   * Hanya hapus lokal, server tetap. Konsisten dengan logout.
   */
  function resetConfig() {
    logout()  // reuse logout untuk clear semua
  }

  // ── Pull dari server → localStorage ──
  async function pullConfigFromServer() {
    const token = getStoredToken()
    if (!token?.email) return { pulled: false, reason: 'no_oauth' }

    syncing.value   = true
    syncError.value = ''
    try {
      const res  = await fetch(`/api/user/${encodeURIComponent(token.email)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()

      if (!data.found) {
        syncing.value = false
        return { pulled: false, reason: 'not_found' }
      }

      const merged = {
        sheetId:    data.sheetId  || '',
        webhookUrl: data.webhook  || '',
        pinHash:    data.pinHash  || '',
        name:       data.name     || token.name || 'User'
      }

      config.value = merged
      persistConfig(merged)

      syncing.value = false
      return { pulled: true, hasPin: !!merged.pinHash }
    } catch (e) {
      syncError.value = e.message
      syncing.value   = false
      return { pulled: false, reason: e.message }
    }
  }

  // ── Push ke server ──
  async function pushConfigToServer(cfg) {
    const token = getStoredToken()
    if (!token?.email) return

    let accessToken
    try { accessToken = await getAccessToken() } catch { return }

    const current = cfg || config.value
    const body = {
      email:   token.email,
      sheetId: current?.sheetId    || '',
      webhook: current?.webhookUrl || '',
      pinHash: current?.pinHash    || '',
      name:    current?.name       || ''
    }

    if (!body.email) return

    const res = await fetch('/api/user/save', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      body:    JSON.stringify(body)
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
    verifyPin, lock, logout, saveConfig, changePin, resetConfig,
    pullConfigFromServer, pushConfigToServer
  }
})

// ── Helpers ──
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
