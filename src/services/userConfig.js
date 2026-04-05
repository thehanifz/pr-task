/**
 * userConfig.js
 * Load config user dari src/user/data.js berdasarkan email.
 * Jika email ditemukan, decrypt sheetId + webhook langsung.
 * Jika tidak ditemukan, return null → tampilkan onboarding.
 */

import { decryptValue } from './crypto'

// Lazy import data.js — file ini ada di .gitignore, hanya di VPS
let _usersCache = null
async function loadUsers() {
  if (_usersCache) return _usersCache
  try {
    const mod = await import('../user/data.js')
    _usersCache = mod.users || {}
  } catch {
    // data.js tidak ada (dev lokal tanpa setup)
    _usersCache = {}
  }
  return _usersCache
}

/**
 * Ambil config user berdasarkan email.
 * @param {string} email
 * @returns {{ sheetId: string, webhook: string } | null}
 */
export async function getUserConfig(email) {
  if (!email) return null
  const users = await loadUsers()
  const entry = users[email]
  if (!entry) return null

  return {
    sheetId: decryptValue(entry.sheetId),
    webhook: decryptValue(entry.webhook)
  }
}

/**
 * Cek apakah user sudah terdaftar
 * @param {string} email
 * @returns {boolean}
 */
export async function isUserRegistered(email) {
  const users = await loadUsers()
  return !!users[email]
}

/**
 * Generate entry terenkripsi untuk ditambahkan manual ke data.js
 * Panggil ini dari browser console saat onboarding:
 *   import { generateEncryptedEntry } from '@/services/userConfig'
 *   generateEncryptedEntry('email@gmail.com', 'sheetId_asli', 'webhook_asli')
 */
export function generateEncryptedEntry(email, sheetId, webhook) {
  const { encryptValue } = require('./crypto')
  const entry = {
    [email]: {
      sheetId: encryptValue(sheetId),
      webhook: encryptValue(webhook)
    }
  }
  console.log('Tambahkan ke src/user/data.js:')
  console.log(JSON.stringify(entry, null, 2))
  return entry
}
