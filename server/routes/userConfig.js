/**
 * routes/userConfig.js
 * GET  /api/user/:email  — load config user dari server
 * POST /api/user/save    — simpan config user (butuh Bearer token valid)
 *
 * Data disimpan di server/data/users.json (di luar src/, aman dari build)
 */

import { Router }                from 'express'
import { readFile, writeFile, mkdir } from 'fs/promises'
import path                      from 'path'
import { fileURLToPath }         from 'url'
import CryptoJS                  from 'crypto-js'

const router    = Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ✅ Simpan di server/data/ — aman dari build, tidak hilang saat git pull
const DATA_DIR  = path.join(__dirname, '../data')
const DATA_PATH = path.join(DATA_DIR, 'users.json')

// ── Encrypt/Decrypt ───────────────────────────
function getKey() { return process.env.VITE_SECRET_KEY || 'prtm_fallback_key_32chars_xxxxx' }
function encrypt(val) {
  if (!val) return ''
  return CryptoJS.AES.encrypt(val, getKey()).toString()
}
function decrypt(val) {
  if (!val) return ''
  try {
    return CryptoJS.AES.decrypt(val, getKey()).toString(CryptoJS.enc.Utf8) || ''
  } catch { return '' }
}

// ── Load users.json ───────────────────────────
async function loadUsers() {
  try {
    const content = await readFile(DATA_PATH, 'utf-8')
    return JSON.parse(content)
  } catch {
    return {}
  }
}

// ── Tulis users.json ──────────────────────────
async function saveUsers(users) {
  await mkdir(DATA_DIR, { recursive: true })
  await writeFile(DATA_PATH, JSON.stringify(users, null, 2), 'utf-8')
}

// ── Verify Google access_token ────────────────
async function verifyGoogleToken(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)
  try {
    const res  = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token}`)
    const data = await res.json()
    if (data.error || !data.email) return null
    return data.email
  } catch { return null }
}

// ── GET /api/user/:email ──────────────────────
router.get('/:email', async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email)
    const users = await loadUsers()
    const entry = users[email]

    if (!entry) return res.json({ found: false })

    res.json({
      found:      true,
      sheetId:    decrypt(entry.sheetId),
      webhook:    decrypt(entry.webhook),
      name:       entry.name || '',
      updatedAt:  entry.updatedAt || null
    })
  } catch (err) {
    console.error('[GET /api/user]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/user/save ───────────────────────
router.post('/save', async (req, res) => {
  try {
    // Verifikasi Google token
    const tokenEmail = await verifyGoogleToken(req.headers.authorization)
    if (!tokenEmail) return res.status(401).json({ error: 'Token tidak valid atau sudah expired' })

    const { email, sheetId, webhook, name } = req.body
    if (!email) return res.status(400).json({ error: 'email wajib diisi' })
    if (!sheetId && !webhook) return res.status(400).json({ error: 'sheetId atau webhook wajib diisi' })

    // Pastikan email di body = email di token
    if (tokenEmail !== email)
      return res.status(403).json({ error: 'Email tidak sesuai dengan token Google' })

    const users = await loadUsers()

    // Merge — jaga nilai lama jika field baru kosong
    const existing = users[email] || {}
    users[email] = {
      sheetId:    sheetId ? encrypt(sheetId) : existing.sheetId || '',
      webhook:    webhook ? encrypt(webhook) : existing.webhook || '',
      name:       name    || existing.name   || '',
      updatedAt:  new Date().toISOString()
    }

    await saveUsers(users)
    console.log(`[SAVE] Config tersimpan untuk: ${email}`)
    res.json({ success: true, updatedAt: users[email].updatedAt })
  } catch (err) {
    console.error('[POST /api/user/save]', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
