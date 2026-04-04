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
  if (_token && Date.now() < _tokenExp - 30_000) return _token

  const { client_email, private_key } = credential
  const now = Math.floor(Date.now() / 1000)

  const header  = _b64urlFromString(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = _b64urlFromString(JSON.stringify({
    iss:   client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud:   'https://oauth2.googleapis.com/token',
    exp:   now + 3600,
    iat:   now
  }))

  const signingInput = `${header}.${payload}`

  const keyData = private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\\n/g, '')
    .replace(/\n/g, '')
    .replace(/\r/g, '')
    .replace(/\s/g, '')
    .trim()

  const binaryKey = Uint8Array.from(atob(keyData), c => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const sigBuf = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput)
  )

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
            startIndex: rowIndex,
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
    recurringType:  row[8]  || 'daily',
    recurringDays:  row[9]  || '',
    recurringTime:  row[10] || '08:00',
    recurringEnd:   row[11] || '',
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
// TREE NODES — Save / Load
// =============================================

const TREE_SHEET  = 'tree_nodes'
const TREE_HEADER = ['id', 'name', 'color', 'parentId', 'collapsed', 'order', 'updatedAt']

/**
 * Flatten nested tree → array of row arrays
 * Kolom: id | name | color | parentId | collapsed | order | updatedAt
 */
export function treeToRows(node, parentId = '', order = 0) {
  const today = new Date().toISOString().split('T')[0]
  const rows = []
  rows.push([
    node.id,
    node.name,
    node.color  || '#3b82f6',
    parentId,
    node.collapsed ? 'TRUE' : 'FALSE',
    order,
    today
  ])
  if (node.children && node.children.length > 0) {
    node.children.forEach((child, i) => {
      rows.push(...treeToRows(child, node.id, i))
    })
  }
  return rows
}

/**
 * Rebuild nested tree dari flat row list
 */
export function rowsToTree(rows) {
  // rows[0] adalah header, skip
  const data = rows.slice(1)
  const map  = {}
  data.forEach(r => {
    map[r[0]] = {
      id:        r[0] || '',
      name:      r[1] || '',
      color:     r[2] || '#3b82f6',
      parentId:  r[3] || '',
      collapsed: r[4] === 'TRUE',
      order:     parseInt(r[5] || 0),
      children:  []
    }
  })

  let root = null
  Object.values(map).forEach(node => {
    if (!node.parentId) {
      root = node
    } else if (map[node.parentId]) {
      map[node.parentId].children.push(node)
    }
  })

  // Sort children by order
  function sortChildren(n) {
    if (n.children && n.children.length > 0) {
      n.children.sort((a, b) => a.order - b.order)
      n.children.forEach(sortChildren)
    }
  }
  if (root) sortChildren(root)

  return root
}

/**
 * Cek apakah sheet tree_nodes sudah ada.
 * Return numeric sheetId jika ada, null jika tidak.
 */
async function getTreeSheetNumericId(sheetId, tok) {
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${tok}` } }
  )
  const meta = await metaRes.json()
  const found = meta.sheets?.find(s => s.properties.title === TREE_SHEET)
  return found ? found.properties.sheetId : null
}

/**
 * Auto-create sheet tree_nodes + header jika belum ada
 */
async function ensureTreeSheet(sheetId, credential) {
  const tok     = await getToken(credential)
  const numId   = await getTreeSheetNumericId(sheetId, tok)
  if (numId !== null) return // sudah ada

  // Buat sheet baru
  const createRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`,
    {
      method:  'POST',
      headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title: TREE_SHEET } } }]
      })
    }
  )
  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}))
    throw new Error(err.error?.message || `Gagal membuat sheet ${TREE_SHEET}`)
  }

  // Set header row 1
  await apiUpdate(sheetId, `${TREE_SHEET}!A1:G1`, [TREE_HEADER], credential)
}

/**
 * Clear data tree_nodes (baris 2 ke bawah), biarkan header
 */
async function clearTreeData(sheetId, credential) {
  const tok   = await getToken(credential)
  const numId = await getTreeSheetNumericId(sheetId, tok)
  if (numId === null) return

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`
  const res = await fetch(url, {
    method:  'POST',
    headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{
        deleteDimension: {
          range: {
            sheetId:    numId,
            dimension:  'ROWS',
            startIndex: 1,       // baris ke-2 (0-based), skip header
            endIndex:   10000    // hapus sampai baris 10000
          }
        }
      }]
    })
  })
  // Jika error karena range melebihi jumlah baris, abaikan (sheet mungkin sudah kosong)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    // code 400 dengan INVALID_ARGUMENT berarti tidak ada baris yang perlu dihapus
    if (!err.error?.message?.includes('INVALID_ARGUMENT')) {
      throw new Error(err.error?.message || `Clear tree error ${res.status}`)
    }
  }
}

/**
 * Simpan seluruh tree ke sheet tree_nodes
 * Auto-create sheet jika belum ada
 */
export async function saveTree(treeData, sheetId, credential) {
  await ensureTreeSheet(sheetId, credential)
  await clearTreeData(sheetId, credential)
  const rows = treeToRows(treeData)
  if (rows.length > 0) {
    await apiAppend(sheetId, `${TREE_SHEET}!A:G`, rows, credential)
  }
  return true
}

/**
 * Load tree dari sheet tree_nodes
 * Return null jika sheet kosong atau tidak ada data
 */
export async function loadTree(sheetId, credential) {
  await ensureTreeSheet(sheetId, credential)
  const rows = await apiGet(sheetId, `${TREE_SHEET}!A:G`, credential)
  if (!rows || rows.length <= 1) return null  // hanya header atau kosong
  return rowsToTree(rows)
}

// =============================================
// HELPERS
// =============================================

function _b64urlFromString(str) {
  const bytes = new TextEncoder().encode(str)
  return _b64urlFromBytes(bytes)
}

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
