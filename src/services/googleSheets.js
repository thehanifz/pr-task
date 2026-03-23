/**
 * googleSheets.js
 * Semua logic komunikasi dengan Google Sheets API via Service Account JWT
 * Import credential dari credential.json yang di-load saat setup
 */

let _token = null
let _tokenExp = 0

// =============================================
// JWT Token (Service Account)
// =============================================
async function getToken(credential) {
  // Reuse token jika masih valid (30 detik margin)
  if (_token && Date.now() < _tokenExp - 30_000) return _token

  const { client_email, private_key } = credential
  const now = Math.floor(Date.now() / 1000)

  // Encode header & payload sebagai base64url dari UTF-8 bytes
  const header  = _b64urlFromString(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = _b64urlFromString(JSON.stringify({
    iss:   client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud:   'https://oauth2.googleapis.com/token',
    exp:   now + 3600,
    iat:   now
  }))

  const signingInput = `${header}.${payload}`

  // Bersihkan private key — handle both real newlines dan \n literal
  const keyData = private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\\n/g, '')
    .replace(/\n/g, '')
    .replace(/\r/g, '')
    .replace(/\s/g, '')
    .trim()

  // Import private key
  const binaryKey = Uint8Array.from(atob(keyData), c => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )

  // Sign
  const sigBuf = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput)
  )

  // Encode signature sebagai base64url dari raw bytes
  const sig = _b64urlFromBytes(new Uint8Array(sigBuf))
  const jwt = `${signingInput}.${sig}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(data.error_description || data.error || 'Failed to get token')

  _token    = data.access_token
  _tokenExp = Date.now() + data.expires_in * 1000
  return _token
}

// Invalidate token (panggil saat credentials berubah)
export function invalidateToken() {
  _token = null
  _tokenExp = 0
}

// =============================================
// Base API calls
// =============================================
async function apiGet(sheetId, range, credential) {
  const tok = await getToken(credential)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${tok}` } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Sheets GET error ${res.status}`)
  }
  return (await res.json()).values || []
}

async function apiAppend(sheetId, range, values, credential) {
  const tok = await getToken(credential)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Sheets APPEND error ${res.status}`)
  }
  return true
}

async function apiUpdate(sheetId, range, values, credential) {
  const tok = await getToken(credential)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`
  const res = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Sheets UPDATE error ${res.status}`)
  }
  return true
}

async function apiDeleteRow(sheetId, sheetName, rowIndex, credential) {
  const tok = await getToken(credential)

  // Ambil sheet ID (numeric) dari metadata
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${tok}` } }
  )
  const meta = await metaRes.json()
  const sheet = meta.sheets?.find(s => s.properties.title === sheetName)
  if (!sheet) throw new Error(`Sheet "${sheetName}" tidak ditemukan`)
  const numericSheetId = sheet.properties.sheetId

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{
        deleteDimension: {
          range: {
            sheetId:    numericSheetId,
            dimension:  'ROWS',
            startIndex: rowIndex,     // 0-based
            endIndex:   rowIndex + 1
          }
        }
      }]
    })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Sheets DELETE error ${res.status}`)
  }
  return true
}

// =============================================
// Batch load semua data (tasks + logs)
// =============================================
export async function loadAllData(sheetId, credential) {
  const tok = await getToken(credential)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchGet?ranges=tasks!A:K&ranges=daily_log!A:E&ranges=reminders!A:L`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${tok}` } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Batch GET error ${res.status}`)
  }
  const data = await res.json()
  return data.valueRanges || []
}

// =============================================
// TASKS CRUD
// =============================================

/**
 * Parse row array → task object
 * Kolom: id|nama|deskripsi|kategori|prioritas|tgl_mulai|tgl_target|status|progres|tgl_selesai|sort_order
 */
export function rowToTask(row, rowNumber) {
  return {
    id:        row[0]  || '',
    name:      row[1]  || '',
    desc:      row[2]  || '',
    cat:       row[3]  || 'other',
    priority:  row[4]  || 'med',
    start:     row[5]  || '',
    target:    row[6]  || '',
    status:    row[7]  || 'todo',
    progress:  parseInt(row[8] || 0),
    doneDate:  row[9]  || '',
    sortOrder: parseInt(row[10] || 9999),
    _row:      rowNumber
  }
}

export function taskToRow(task) {
  return [
    task.id,
    task.name,
    task.desc       || '',
    task.cat        || 'other',
    task.priority   || 'med',
    task.start      || '',
    task.target     || '',
    task.status     || 'todo',
    task.progress   ?? 0,
    task.doneDate   || '',
    task.sortOrder  ?? 9999
  ]
}

export async function createTask(task, sheetId, credential) {
  const row = taskToRow(task)
  return apiAppend(sheetId, 'tasks!A:K', [row], credential)
}

export async function updateTask(task, sheetId, credential) {
  const row = taskToRow(task)
  return apiUpdate(sheetId, `tasks!A${task._row}:K${task._row}`, [row], credential)
}

export async function deleteTask(task, sheetId, credential) {
  return apiDeleteRow(sheetId, 'tasks', task._row - 1, credential)
}

export async function updateTaskProgress(task, progress, sheetId, credential) {
  return apiUpdate(sheetId, `tasks!I${task._row}`, [[progress]], credential)
}

// Batch update sortOrder for all tasks (kolom K only)
export async function batchUpdateTasks(tasks, sheetId, credential) {
  const tok = await getToken(credential)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`
  const data = {
    valueInputOption: 'USER_ENTERED',
    data: tasks.map(t => ({
      range:  `tasks!K${t._row}`,
      values: [[t.sortOrder ?? 9999]]
    }))
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Batch update error ${res.status}`)
  }
  return true
}

// =============================================
// DAILY LOG CRUD
// =============================================

/**
 * Kolom: id|task_id|tanggal|catatan|progres
 */
export function rowToLog(row, rowNumber) {
  return {
    id:       row[0] || '',
    taskId:   row[1] || '',
    date:     row[2] || '',
    note:     row[3] || '',
    progress: parseInt(row[4] || 0),
    _row:     rowNumber
  }
}

export function logToRow(log) {
  return [log.id, log.taskId, log.date, log.note, log.progress ?? 0]
}

export async function createLog(log, sheetId, credential) {
  return apiAppend(sheetId, 'daily_log!A:E', [logToRow(log)], credential)
}

export async function deleteLog(log, sheetId, credential) {
  return apiDeleteRow(sheetId, 'daily_log', log._row - 1, credential)
}

// =============================================
// REMINDERS CRUD
// =============================================

/**
 * Kolom: id|task_id|tipe|waktu_kirim|pesan|terkirim|webhook_url|
 *         recurring|recurring_type|recurring_days|recurring_time|recurring_end
 */
export function rowToReminder(row, rowNumber) {
  return {
    id:             row[0]  || '',
    taskId:         row[1]  || '',
    type:           row[2]  || 'custom',
    sendAt:         row[3]  || '',
    message:        row[4]  || '',
    sent:           row[5] === 'TRUE',
    webhookUrl:     row[6]  || '',
    recurring:      row[7] === 'TRUE',
    recurringType:  row[8]  || 'daily',    // daily|weekly|monthly|interval
    recurringDays:  row[9]  || '',         // "1,3,5" / "15" / "3"
    recurringTime:  row[10] || '08:00',
    recurringEnd:   row[11] || '',         // YYYY-MM-DD atau kosong = selamanya
    _row:           rowNumber
  }
}

export function reminderToRow(r) {
  return [
    r.id, r.taskId, r.type, r.sendAt, r.message,
    r.sent ? 'TRUE' : 'FALSE',
    r.webhookUrl     || '',
    r.recurring      ? 'TRUE' : 'FALSE',
    r.recurringType  || 'daily',
    r.recurringDays  || '',
    r.recurringTime  || '08:00',
    r.recurringEnd   || ''
  ]
}

export async function createReminder(reminder, sheetId, credential) {
  return apiAppend(sheetId, 'reminders!A:L', [reminderToRow(reminder)], credential)
}

export async function updateReminder(reminder, sheetId, credential) {
  return apiUpdate(sheetId, `reminders!A${reminder._row}:L${reminder._row}`, [reminderToRow(reminder)], credential)
}

export async function deleteReminder(reminder, sheetId, credential) {
  return apiDeleteRow(sheetId, 'reminders', reminder._row - 1, credential)
}

// Update hanya kolom "terkirim" (kolom F = index 6, 1-based)
export async function markReminderSent(reminder, sheetId, credential) {
  return apiUpdate(sheetId, `reminders!F${reminder._row}`, [['TRUE']], credential)
}

// =============================================
// TEST CONNECTION
// =============================================
export async function testConnection(sheetId, credential) {
  const tok = await getToken(credential)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=properties.title`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${tok}` } })
  if (!res.ok) throw new Error('Tidak bisa mengakses spreadsheet. Pastikan sudah di-share ke service account.')
  const data = await res.json()
  return data.properties?.title || 'OK'
}

// =============================================
// HELPERS
// =============================================

// Encode string UTF-8 → base64url
function _b64urlFromString(str) {
  const bytes = new TextEncoder().encode(str)
  return _b64urlFromBytes(bytes)
}

// Encode Uint8Array → base64url (aman untuk binary besar)
function _b64urlFromBytes(bytes) {
  let binary = ''
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}