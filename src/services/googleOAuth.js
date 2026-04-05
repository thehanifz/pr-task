/**
 * googleOAuth.js
 * Google OAuth 2.0 PKCE flow — Web Application type
 * Web Application type membutuhkan client_secret saat token exchange.
 */

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
].join(' ')

const LS_TOKEN = 'prtm_oauth_token'

// ── PKCE Helpers ───────────────────────────
function base64urlEncode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}
async function generateCodeVerifier() {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return base64urlEncode(arr)
}
async function generateCodeChallenge(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64urlEncode(digest)
}

// ── Token Storage ──────────────────────────
export function getStoredToken() {
  try { return JSON.parse(localStorage.getItem(LS_TOKEN)) || null } catch { return null }
}
export function storeToken(t)  { localStorage.setItem(LS_TOKEN, JSON.stringify(t)) }
export function clearToken()   { localStorage.removeItem(LS_TOKEN) }

export function isTokenValid(token) {
  if (!token?.access_token) return false
  return Date.now() < (token.expires_at - 60_000)
}

// ── Token Exchange Helpers ───────────────────
function getClientId()     { return import.meta.env.VITE_GOOGLE_CLIENT_ID }
function getClientSecret() { return import.meta.env.VITE_GOOGLE_CLIENT_SECRET || '' }
function getRedirectUri()  { return `${window.location.origin}/oauth/callback` }

async function postToken(params) {
  const body = new URLSearchParams(params)
  const secret = getClientSecret()
  if (secret) body.set('client_secret', secret)

  const res  = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(data.error_description || data.error || 'Gagal mendapatkan token')
  return data
}

// ── Refresh ────────────────────────────────
export async function refreshAccessToken(refreshToken) {
  const data = await postToken({
    client_id:     getClientId(),
    grant_type:    'refresh_token',
    refresh_token: refreshToken
  })
  return { ...data, expires_at: Date.now() + data.expires_in * 1000 }
}

// ── Get valid access token (auto-refresh) ────
export async function getAccessToken() {
  const token = getStoredToken()
  if (!token) throw new Error('Belum login. Silakan login dengan Google.')
  if (isTokenValid(token)) return token.access_token
  if (!token.refresh_token) { clearToken(); throw new Error('Sesi habis. Silakan login ulang.') }
  try {
    const r = await refreshAccessToken(token.refresh_token)
    const updated = { ...token, access_token: r.access_token, expires_at: r.expires_at }
    storeToken(updated)
    return updated.access_token
  } catch { clearToken(); throw new Error('Sesi habis. Silakan login ulang.') }
}

// ── User Info ─────────────────────────────
export async function fetchUserInfo(accessToken) {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  if (!res.ok) throw new Error('Gagal mengambil info akun Google')
  return res.json()
}

// ── Initiate Login ────────────────────────
export async function initiateGoogleLogin() {
  const verifier  = await generateCodeVerifier()
  const challenge = await generateCodeChallenge(verifier)
  const state     = base64urlEncode(crypto.getRandomValues(new Uint8Array(16)))

  sessionStorage.setItem('pkce_verifier', verifier)
  sessionStorage.setItem('pkce_state',    state)

  const params = new URLSearchParams({
    response_type:         'code',
    client_id:             getClientId(),
    redirect_uri:          getRedirectUri(),
    scope:                 SCOPES,
    access_type:           'offline',
    prompt:                'consent',
    state,
    code_challenge:        challenge,
    code_challenge_method: 'S256'
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

// ── Handle Callback ───────────────────────
export async function handleOAuthCallback(code, state) {
  const storedState = sessionStorage.getItem('pkce_state')
  const verifier    = sessionStorage.getItem('pkce_verifier')
  if (state !== storedState) throw new Error('State tidak cocok. Kemungkinan CSRF.')

  const data = await postToken({
    client_id:     getClientId(),
    code,
    code_verifier: verifier,
    grant_type:    'authorization_code',
    redirect_uri:  getRedirectUri()
  })

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

// ── Logout ───────────────────────────────
export function oauthLogout() { clearToken() }

// ── Parse Sheet ID ────────────────────────
export function extractSheetId(input) {
  if (!input) return ''
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  return match ? match[1] : input.trim()
}
