/**
 * userConfig.js
 * Komunikasi ke Express backend untuk load/save config user.
 */

const BASE = '/api/user'

/**
 * Ambil config user dari server.
 * @param {string} email
 * @returns {{ found: boolean, sheetId?: string, webhook?: string }}
 */
export async function getUserConfig(email) {
  const res  = await fetch(`${BASE}/${encodeURIComponent(email)}`)
  if (!res.ok) throw new Error('Gagal mengambil config user')
  return res.json()
}

/**
 * Simpan config user baru ke server.
 * @param {string} email
 * @param {string} sheetId
 * @param {string} webhook
 * @param {string} accessToken - Google OAuth access_token untuk verifikasi
 */
export async function saveUserConfig(email, sheetId, webhook, accessToken) {
  const res = await fetch(`${BASE}/save`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({ email, sheetId, webhook })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Gagal menyimpan config')
  return data
}
