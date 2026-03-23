import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { invalidateToken } from '@/services/googleSheets'

const LS_KEY  = 'prtm_config'
const SS_KEY  = 'prtm_unlocked'  // sessionStorage — hilang saat tab ditutup

export const useAuthStore = defineStore('auth', () => {
  // ── State ──────────────────────────────────
  const config     = ref(loadConfig())
  // Baca dari sessionStorage supaya survive window.location reload
  const isUnlocked = ref(sessionStorage.getItem(SS_KEY) === '1')

  // ── Getters ────────────────────────────────
  const isConfigured = computed(() => !!config.value?.pinHash)
  const credential   = computed(() => config.value?.credential || null)
  const sheetId      = computed(() => config.value?.sheetId || '')
  const webhookUrl   = computed(() => config.value?.webhookUrl || '')
  const userName     = computed(() => config.value?.name || 'User')

  // ── Actions ────────────────────────────────
  async function verifyPin(pin) {
    const hash = await sha256(pin)
    if (hash === config.value?.pinHash) {
      isUnlocked.value = true
      sessionStorage.setItem(SS_KEY, '1')  // persist untuk reload
      return true
    }
    return false
  }

  function lock() {
    isUnlocked.value = false
    sessionStorage.removeItem(SS_KEY)
  }

  async function saveConfig({ name, pin, sheetId, credential, webhookUrl }) {
    const newCfg = {
      name:       name || config.value?.name,
      sheetId:    sheetId || config.value?.sheetId,
      webhookUrl: webhookUrl ?? config.value?.webhookUrl,
      credential: credential || config.value?.credential,
      pinHash:    config.value?.pinHash
    }
    if (pin) {
      newCfg.pinHash = await sha256(pin)
    }
    config.value = newCfg
    persistConfig(newCfg)
    invalidateToken()
  }

  async function changePin(newPin) {
    const hash = await sha256(newPin)
    config.value.pinHash = hash
    persistConfig(config.value)
  }

  function resetConfig() {
    localStorage.removeItem(LS_KEY)
    sessionStorage.removeItem(SS_KEY)
    config.value     = {}
    isUnlocked.value = false
    invalidateToken()
  }

  return {
    config, isUnlocked, isConfigured,
    credential, sheetId, webhookUrl, userName,
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