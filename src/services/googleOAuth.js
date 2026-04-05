/**
 * googleOAuth.js
 * Handle Google OAuth 2.0 PKCE flow untuk akses Sheets API
 * Support: Desktop App client type (butuh client_secret)
 */

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
].join(' ')

const LS_TOKEN = 'prtm_oauth_token'

// ── PKCE Helpers ─────────────────────────────
function base64urlEncode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

async function generateCodeVerifier() {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return base64urlEncode(array)
}

async function generateCodeChallenge(verifier) {
  const data   = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return base64urlEncode(digest)
}

// ── Token Storage ────────────────────────────
export function getStoredToken() {
  try { return JSON.parse(localStorage.getItem(LS_TOKEN)) || null }
  catch { return null }
}

export function storeToken(token) {
  localStorage.setItem(LS_TOKEN, JSON.stringify(token))
}

export function clearToken() {
  localStorage.removeItem(LS_TOKEN)
}

// ── Cek apakah access token masih valid ───────
export function isTokenValid(token) {
  if (!token?.access_token) return false
  return Date.now() < (token.expires_at - 60_000)
}

// ── Refresh access token via refresh_token ───
export async function refreshAccessToken(refreshToken) {
  const clientId     = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET || ''

  const body = new URLSearchParams({
    client_id:     clientId,
    grant_type:    'refresh_token',
    refresh_token: refreshToken
  })
  if (clientSecret) body.set('client_secret', clientSecret)

  const res  = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(data.error_description || 'Gagal refresh token')
  return { ...data, expires_at: Date.now() + data.expires_in * 1000 }
}

// ── Get valid access token (auto-refresh) ─────
export async function getAccessToken() {
  const token = getStoredToken()
  if (!token) throw new Error('Belum login. Silakan login dengan Google.')

  if (isTokenValid(token)) return token.access_token

  if (!token.refresh_token) {
    clearToken()
    throw new Error('Sesi habis. Silakan login ulang.')
  }

  try {
    const refreshed = await refreshAccessToken(token.refresh_token)
    const updated   = { ...token, access_token: refreshed.access_token, expires_at: refreshed.expires_at }
    storeToken(updated)
    return updated.access_token
  } catch {
    clearToken()
    throw new Error('Sesi habis. Silakan login ulang.')
  }
}

// ── Ambil info user (email + nama) ────────────
export async function fetchUserInfo(accessToken) {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  if (!res.ok) throw new Error('Gagal mengambil info akun Google')
  return res.json()
}

// ── Mulai OAuth login ─────────────────────────
export async function initiateGoogleLogin() {
  const clientId    = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const redirectUri = `${window.location.origin}/oauth/callback`

  const verifier  = await generateCodeVerifier()
  const challenge = await generateCodeChallenge(verifier)
  const state     = base64urlEncode(crypto.getRandomValues(new Uint8Array(16)))

  sessionStorage.setItem('pkce_verifier', verifier)
  sessionStorage.setItem('pkce_state',    state)

  const params = new URLSearchParams({
    response_type:         'code',
    client_id:             clientId,
    redirect_uri:          redirectUri,
    scope:                 SCOPES,
    access_type:           'offline',
    prompt:                'consent',
    state,
    code_challenge:        challenge,
    code_challenge_method: 'S256'
  })

  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

// ── Handle callback — tukar code → token ──────
export async function handleOAuthCallback(code, state) {
  const storedState = sessionStorage.getItem('pkce_state')
  const verifier    = sessionStorage.getItem('pkce_verifier')

  if (state !== storedState) throw new Error('State tidak cocok. Kemungkinan CSRF.')

  const clientId     = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET || ''
  const redirectUri  = `${window.location.origin}/oauth/callback`

  const body = new URLSearchParams({
    client_id:     clientId,
    code,
    code_verifier: verifier,
    grant_type:    'authorization_code',
    redirect_uri:  redirectUri
  })
  if (clientSecret) body.set('client_secret', clientSecret)

  const res  = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(data.error_description || 'Gagal mendapatkan token')

  const token = {
    access_token:  data.access_token,
    refresh_token: data.refresh_token,
    expires_at:    Date.now() + data.expires_in * 1000
  }

  const userInfo = await fetchUserInfo(token.access_token)
  token.email   = userInfo.email
  token.name    = userInfo.name
  token.picture = userInfo.picture

  storeToken(token)
  sessionStorage.removeItem('pkce_verifier')
  sessionStorage.removeItem('pkce_state')

  return token
}

// ── Logout ────────────────────────────────────
export function oauthLogout() {
  clearToken()
}

// ── Parse Sheet ID dari URL atau ID langsung ──
export function extractSheetId(input) {
  if (!input) return ''
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (match) return match[1]
  return input.trim()
}
