/**
 * userConfig.js
 * Helper untuk komunikasi ke Express backend /api/user/*
 * Gunakan fungsi dari auth store (pullConfigFromServer / pushConfigToServer) jika memungkinkan.
 */

const BASE = '/api/user'

/**
 * Ambil config user dari server.
 * @param {string} email
 * @returns {{ found: boolean, sheetId?: string, webhook?: string, name?: string }}
 */
export async function getUserConfig(email) {
  const res = await fetch(`${BASE}/${encodeURIComponent(email)}`)
  if (!res.ok) throw new Error(`Gagal mengambil config user (HTTP ${res.status})`)
  return res.json()
}

/**
 * Simpan config user ke server.
 * @param {string} email
 * @param {string} sheetId
 * @param {string} webhook
 * @param {string} accessToken - Google OAuth access_token
 * @param {string} [name]
 */
export async function saveUserConfig(email, sheetId, webhook, accessToken, name = '') {
  const res = await fetch(`${BASE}/save`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({ email, sheetId, webhook, name })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `Gagal menyimpan config (HTTP ${res.status})`)
  return data
}
