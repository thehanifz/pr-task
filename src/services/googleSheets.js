/**
 * googleSheets.js
 * Komunikasi dengan Google Sheets API menggunakan OAuth access token
 * Token diambil dari googleOAuth.js (auto-refresh)
 */

import { getAccessToken } from './googleOAuth'

// =============================================
// Base API calls
// =============================================
async function apiGet(sheetId, range) {
  const tok = await getAccessToken()
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${tok}` } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Sheets GET error ${res.status}`)
  }
  return (await res.json()).values || []
}

async function apiAppend(sheetId, range, values) {
  const tok = await getAccessToken()
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

async function apiUpdate(sheetId, range, values) {
  const tok = await getAccessToken()
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

async function apiDeleteRow(sheetId, sheetName, rowIndex) {
  const tok = await getAccessToken()

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
// Batch load semua data
// =============================================
export async function loadAllData(sheetId) {
  const tok = await getAccessToken()
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

export async function createTask(task, sheetId) {
  return apiAppend(sheetId, 'tasks!A:K', [taskToRow(task)])
}

export async function updateTask(task, sheetId) {
  return apiUpdate(sheetId, `tasks!A${task._row}:K${task._row}`, [taskToRow(task)])
}

export async function deleteTask(task, sheetId) {
  return apiDeleteRow(sheetId, 'tasks', task._row - 1)
}

export async function updateTaskProgress(task, progress, sheetId) {
  return apiUpdate(sheetId, `tasks!I${task._row}`, [[progress]])
}

export async function batchUpdateTasks(tasks, sheetId) {
  const tok = await getAccessToken()
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

export async function createLog(log, sheetId) {
  return apiAppend(sheetId, 'daily_log!A:E', [logToRow(log)])
}

export async function deleteLog(log, sheetId) {
  return apiDeleteRow(sheetId, 'daily_log', log._row - 1)
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

export async function createReminder(reminder, sheetId) {
  return apiAppend(sheetId, 'reminders!A:L', [reminderToRow(reminder)])
}

export async function updateReminder(reminder, sheetId) {
  return apiUpdate(sheetId, `reminders!A${reminder._row}:L${reminder._row}`, [reminderToRow(reminder)])
}

export async function deleteReminder(reminder, sheetId) {
  return apiDeleteRow(sheetId, 'reminders', reminder._row - 1)
}

export async function markReminderSent(reminder, sheetId) {
  return apiUpdate(sheetId, `reminders!F${reminder._row}`, [['TRUE']])
}

// =============================================
// TEST CONNECTION
// =============================================
export async function testConnection(sheetId) {
  const tok = await getAccessToken()
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=properties.title`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${tok}` } })
  if (!res.ok) throw new Error('Tidak bisa mengakses spreadsheet. Pastikan spreadsheet di-share atau milik akun kamu.')
  const data = await res.json()
  return data.properties?.title || 'OK'
}

// =============================================
// TREE NODES — Save / Load
// =============================================

const TREE_SHEET  = 'tree_nodes'
const TREE_HEADER = ['id', 'name', 'color', 'parentId', 'collapsed', 'order', 'updatedAt']

export function treeToRows(node, parentId = '', order = 0) {
  const today = new Date().toISOString().split('T')[0]
  const rows = []
  rows.push([
    node.id, node.name, node.color || '#3b82f6',
    parentId, node.collapsed ? 'TRUE' : 'FALSE', order, today
  ])
  if (node.children?.length > 0) {
    node.children.forEach((child, i) => rows.push(...treeToRows(child, node.id, i)))
  }
  return rows
}

export function rowsToTree(rows) {
  const data = rows.slice(1)
  const map  = {}
  data.forEach(r => {
    map[r[0]] = {
      id: r[0] || '', name: r[1] || '', color: r[2] || '#3b82f6',
      parentId: r[3] || '', collapsed: r[4] === 'TRUE',
      order: parseInt(r[5] || 0), children: []
    }
  })
  let root = null
  Object.values(map).forEach(node => {
    if (!node.parentId) root = node
    else if (map[node.parentId]) map[node.parentId].children.push(node)
  })
  function sortChildren(n) {
    if (n.children?.length > 0) {
      n.children.sort((a, b) => a.order - b.order)
      n.children.forEach(sortChildren)
    }
  }
  if (root) sortChildren(root)
  return root
}

async function getTreeSheetNumericId(sheetId, tok) {
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${tok}` } }
  )
  const meta = await metaRes.json()
  const found = meta.sheets?.find(s => s.properties.title === TREE_SHEET)
  return found ? found.properties.sheetId : null
}

async function ensureTreeSheet(sheetId) {
  const tok   = await getAccessToken()
  const numId = await getTreeSheetNumericId(sheetId, tok)
  if (numId !== null) return
  const createRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: TREE_SHEET } } }] })
    }
  )
  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}))
    throw new Error(err.error?.message || `Gagal membuat sheet ${TREE_SHEET}`)
  }
  await apiUpdate(sheetId, `${TREE_SHEET}!A1:G1`, [TREE_HEADER])
}

async function clearTreeData(sheetId) {
  const tok   = await getAccessToken()
  const numId = await getTreeSheetNumericId(sheetId, tok)
  if (numId === null) return
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{ deleteDimension: { range: { sheetId: numId, dimension: 'ROWS', startIndex: 1, endIndex: 10000 } } }]
    })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    if (!err.error?.message?.includes('INVALID_ARGUMENT')) {
      throw new Error(err.error?.message || `Clear tree error ${res.status}`)
    }
  }
}

export async function saveTree(treeData, sheetId) {
  await ensureTreeSheet(sheetId)
  await clearTreeData(sheetId)
  const rows = treeToRows(treeData)
  if (rows.length > 0) await apiAppend(sheetId, `${TREE_SHEET}!A:G`, rows)
  return true
}

export async function loadTree(sheetId) {
  await ensureTreeSheet(sheetId)
  const rows = await apiGet(sheetId, `${TREE_SHEET}!A:G`)
  if (!rows || rows.length <= 1) return null
  return rowsToTree(rows)
}
