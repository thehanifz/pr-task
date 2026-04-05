/**
 * server/index.js
 * Express server:
 * - Serve Vue dist/ (hasil npm run build)
 * - Mount API /api/user/*
 */

import express    from 'express'
import path       from 'path'
import { fileURLToPath } from 'url'
import 'dotenv/config'
import userRoutes from './routes/userConfig.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app  = express()
const PORT = process.env.PORT || 3000

// ── Middleware ────────────────────────────────
app.use(express.json())

// CORS — izinkan origin sendiri saja
app.use((req, res, next) => {
  const origin = req.headers.origin
  const allowed = process.env.APP_URL || `http://localhost:${PORT}`
  if (!origin || origin === allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

// ── API Routes ────────────────────────────────
app.use('/api/user', userRoutes)

// ── Serve Vue dist/ ───────────────────────────
const distPath = path.join(__dirname, '../dist')
app.use(express.static(distPath))

// SPA fallback — semua route non-API ke index.html
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

// ── Start ─────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Serving dist from: ${distPath}`)
})
