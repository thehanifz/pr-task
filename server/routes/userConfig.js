/**
 * routes/userConfig.js
 * GET  /api/user/:email  — cek dan load config user
 * POST /api/user/save    — simpan config user baru (butuh Bearer token valid)
 */

import { Router } from 'express'
import { readFile, writeFile, mkdir } from 'fs/promises'
import path  from 'path'
import { fileURLToPath } from 'url'
import CryptoJS from 'crypto-js'

const router    = Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_PATH = path.join(__dirname, '../../src/user/data.js')

// ── Helpers encrypt/decrypt ───────────────────
function getKey() { return process.env.VITE_SECRET_KEY || '' }
function encrypt(val) { return CryptoJS.AES.encrypt(val, getKey()).toString() }
function decrypt(val) {
  try {
    return CryptoJS.AES.decrypt(val, getKey()).toString(CryptoJS.enc.Utf8)
  } catch { return '' }
}

// ── Load data.js ──────────────────────────────
async function loadUsers() {
  try {
    const content = await readFile(DATA_PATH, 'utf-8')
    // Extract JSON dari export const users = {...}
    const match = content.match(/export const users\s*=\s*(\{[\s\S]*\})/)
    if (!match) return {}
    return JSON.parse(match[1])
  } catch {
    return {}
  }
}

// ── Tulis data.js ─────────────────────────────
async function saveUsers(users) {
  const dir = path.dirname(DATA_PATH)
  await mkdir(dir, { recursive: true })
  const content = `/**
 * data.js — auto-generated, jangan edit manual
 * File ini di .gitignore dan hanya ada di VPS
 */

export const users = ${JSON.stringify(users, null, 2)}
`
  await writeFile(DATA_PATH, content, 'utf-8')
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
      found:   true,
      sheetId: decrypt(entry.sheetId),
      webhook: decrypt(entry.webhook)
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/user/save ───────────────────────
router.post('/save', async (req, res) => {
  try {
    // Verifikasi Google token
    const tokenEmail = await verifyGoogleToken(req.headers.authorization)
    if (!tokenEmail) return res.status(401).json({ error: 'Token tidak valid' })

    const { email, sheetId, webhook } = req.body
    if (!email || !sheetId || !webhook)
      return res.status(400).json({ error: 'email, sheetId, dan webhook wajib diisi' })

    // Pastikan email di body sama dengan email di token
    if (tokenEmail !== email)
      return res.status(403).json({ error: 'Email tidak sesuai dengan token' })

    const users = await loadUsers()
    users[email] = {
      sheetId: encrypt(sheetId),
      webhook: encrypt(webhook)
    }
    await saveUsers(users)

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
