/**
 * PR Task Manager — Google Apps Script Scheduler
 * ================================================
 * Mendukung one-shot dan recurring reminders.
 *
 * Kolom reminders:
 * A: id | B: task_id | C: tipe | D: waktu_kirim | E: pesan
 * F: terkirim | G: webhook_url | H: recurring | I: recurring_type
 * J: recurring_days | K: recurring_time | L: recurring_end
 */

const CONFIG = {
  SPREADSHEET_ID: 'sheet -id 1o10C-k0JRS4',
  DEFAULT_WEBHOOK: 'https://webhook',
  SHEET_TASKS:     'tasks',
  SHEET_REMINDERS: 'reminders',

  COL_REM: {
    ID: 0, TASK_ID: 1, TYPE: 2, SEND_AT: 3, MESSAGE: 4,
    SENT: 5, WEBHOOK_URL: 6,
    RECURRING: 7, RECURRING_TYPE: 8, RECURRING_DAYS: 9,
    RECURRING_TIME: 10, RECURRING_END: 11
  },

  COL_TASK: {
    ID: 0, NAME: 1, CAT: 3, STATUS: 7, PROGRESS: 8, TARGET: 6
  }
}

// =============================================
// ENTRY POINT
// =============================================
function checkAndSendReminders() {
  try {
    const ss        = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
    const remSheet  = ss.getSheetByName(CONFIG.SHEET_REMINDERS)
    const taskSheet = ss.getSheetByName(CONFIG.SHEET_TASKS)
    if (!remSheet || !taskSheet) { Logger.log('Sheet tidak ditemukan'); return }

    const now      = new Date()
    const remData  = remSheet.getDataRange().getValues()
    const taskData = taskSheet.getDataRange().getValues()

    // Build task map
    const taskMap = {}
    for (let i = 1; i < taskData.length; i++) {
      const r = taskData[i]
      if (r[CONFIG.COL_TASK.ID]) taskMap[r[CONFIG.COL_TASK.ID]] = r
    }

    let sentCount = 0

    for (let i = 1; i < remData.length; i++) {
      const row       = remData[i]
      const id        = row[CONFIG.COL_REM.ID]
      const taskId    = row[CONFIG.COL_REM.TASK_ID]
      const type      = row[CONFIG.COL_REM.TYPE]
      const sendAt    = row[CONFIG.COL_REM.SEND_AT]
      const msg       = row[CONFIG.COL_REM.MESSAGE]
      const sentRaw   = row[CONFIG.COL_REM.SENT]
      const sent      = sentRaw === true || sentRaw === 'TRUE'
      const wh        = row[CONFIG.COL_REM.WEBHOOK_URL]
      const recurring      = row[CONFIG.COL_REM.RECURRING] === true || row[CONFIG.COL_REM.RECURRING] === 'TRUE'
      const recurringType  = (row[CONFIG.COL_REM.RECURRING_TYPE] || 'daily').toString().trim().toLowerCase()
      const recurringDays  = row[CONFIG.COL_REM.RECURRING_DAYS] || ''
      const recurringTime  = row[CONFIG.COL_REM.RECURRING_TIME] || '08:00'
      const recurringEnd   = row[CONFIG.COL_REM.RECURRING_END]  || ''

      if (!id) continue

      // One-shot yang sudah terkirim → skip
      if (!recurring && sent) continue

      // Recurring yang sent=TRUE tapi belum lewat recurringEnd → reset sent ke FALSE
      if (recurring && sent) {
        const endDate = recurringEnd ? new Date(recurringEnd) : null
        if (!endDate || new Date() <= endDate) {
          // Belum berakhir → reset supaya bisa dieksekusi lagi
          remSheet.getRange(i + 1, CONFIG.COL_REM.SENT + 1).setValue(false)
          Logger.log('🔄 Reset sent→FALSE untuk recurring: ' + id)
        } else {
          // Sudah lewat recurringEnd → skip
          Logger.log('⏹️ Recurring sudah berakhir: ' + id)
          continue
        }
      }

      const sendTime = sendAt instanceof Date ? sendAt : new Date(sendAt)
      if (isNaN(sendTime.getTime())) continue
      if (sendTime > now) continue

      // Cek recurringEnd saat akan kirim
      if (recurring && recurringEnd) {
        const endDate = new Date(recurringEnd)
        endDate.setHours(23, 59, 59)
        if (now > endDate) {
          remSheet.getRange(i + 1, CONFIG.COL_REM.SENT + 1).setValue(true)
          Logger.log('⏹️ Recurring berakhir saat kirim: ' + id)
          continue
        }
      }

      const task      = taskMap[taskId] || null
      const taskName  = task ? task[CONFIG.COL_TASK.NAME]     : taskId
      const progress  = task ? task[CONFIG.COL_TASK.PROGRESS] : 0
      const deadline  = task ? task[CONFIG.COL_TASK.TARGET]   : ''
      const category  = task ? task[CONFIG.COL_TASK.CAT]      : ''
      const status    = task ? task[CONFIG.COL_TASK.STATUS]   : ''
      const message   = msg || buildMessage(type, taskName, progress, deadline, recurring)
      const webhookUrl = (wh && wh.toString().startsWith('http')) ? wh.toString() : CONFIG.DEFAULT_WEBHOOK

      if (!webhookUrl) { Logger.log('Webhook kosong: ' + id); continue }

      const success = sendToWebhook(webhookUrl, {
        event:          'task_reminder',
        reminder_id:    id,
        reminder_type:  type,
        recurring:      recurring,
        recurring_type: recurringType,
        task_id:        taskId,
        task_name:      taskName,
        task_category:  category,
        task_status:    status,
        progress:       progress,
        deadline:       deadline,
        message:        message,
        sent_at:        now.toISOString(),
        source:         'PR Task Manager GAS'
      })

      if (success) {
        sentCount++
        if (recurring) {
          // Hitung waktu_kirim berikutnya
          const nextSendAt = calcNextSendAt(sendTime, recurringType, recurringDays, recurringTime)
          if (nextSendAt) {
            remSheet.getRange(i + 1, CONFIG.COL_REM.SEND_AT + 1).setValue(nextSendAt.toISOString())
            Logger.log('✅ Recurring terkirim: ' + id + ' | Type: ' + recurringType + ' | Next: ' + nextSendAt.toISOString())
          } else {
            // Tidak bisa hitung next → jangan set TRUE, log saja untuk debug
            Logger.log('⚠️ calcNextSendAt null untuk: ' + id + ' | type=' + recurringType + ' | days=' + recurringDays + ' | time=' + recurringTime)
          }
        } else {
          // One-shot → tandai terkirim
          remSheet.getRange(i + 1, CONFIG.COL_REM.SENT + 1).setValue(true)
          Logger.log('✅ One-shot terkirim: ' + id + ' → ' + taskName)
        }
      } else {
        Logger.log('❌ Gagal kirim: ' + id)
      }

      Utilities.sleep(300)
    }

    Logger.log('Selesai. Total terkirim: ' + sentCount)
  } catch(e) {
    Logger.log('ERROR: ' + e.toString())
  }
}

// =============================================
// HITUNG NEXT SEND AT (SUDAH DIPERBAIKI)
// =============================================
function calcNextSendAt(fromDate, type, days, time) {
  Logger.log('calcNextSendAt | type=' + type + ' | days=' + days + ' | time=' + time)
  const d    = new Date(fromDate)
  
  let hh = 8;
  let mm = 0;

  // FIX AMNESIA: Deteksi otomatis apakah 'time' dari Spreadsheet adalah Objek Tanggal/Waktu atau Teks biasa
  if (time instanceof Date) {
    hh = time.getHours();
    mm = time.getMinutes();
  } else {
    const timeStr = time ? time.toString() : '08:00';
    const parts = timeStr.split(':');
    hh   = parseInt(parts[0]) || 8;
    mm   = parseInt(parts[1]) || 0;
  }

  if (type === 'daily') {
    d.setDate(d.getDate() + 1)
    d.setHours(hh, mm, 0, 0)
    return d
  }

  if (type === 'interval') {
    const interval = parseInt(days) || 7
    d.setDate(d.getDate() + interval)
    d.setHours(hh, mm, 0, 0)
    return d
  }

  if (type === 'weekly') {
    // FIX PENGAMAN: Ubah days jadi string dulu supaya aman saat di-split
    const dayList = days ? days.toString().split(',').map(Number).sort() : [1]
    const curDay  = d.getDay()
    const nextDay = dayList.find(x => x > curDay) ?? dayList[0]
    const diff    = nextDay > curDay ? nextDay - curDay : 7 - curDay + nextDay
    d.setDate(d.getDate() + diff)
    d.setHours(hh, mm, 0, 0)
    return d
  }

  if (type === 'monthly') {
    const tgl = parseInt(days) || 1
    d.setMonth(d.getMonth() + 1)
    d.setDate(tgl)
    d.setHours(hh, mm, 0, 0)
    return d
  }

  return null
}

// =============================================
// BUILD PESAN
// =============================================
function buildMessage(type, taskName, progress, deadline, recurring) {
  const recTag = recurring ? ' 🔁' : ''
  const msgs = {
    'deadline_h3': '⏰ Reminder' + recTag + ': "' + taskName + '" deadline dalam 3 hari (' + deadline + ') — progress ' + progress + '%',
    'deadline_h1': '🔴 Deadline besok!' + recTag + ' "' + taskName + '" — progress ' + progress + '%',
    'deadline_d0': '🚨 HARI INI deadline: "' + taskName + '" — progress ' + progress + '%',
    'custom':      '📌 Reminder' + recTag + ': "' + taskName + '" — progress ' + progress + '%'
  }
  return msgs[type] || msgs['custom']
}

// =============================================
// KIRIM KE WEBHOOK
// =============================================
function sendToWebhook(url, payload) {
  try {
    const res  = UrlFetchApp.fetch(url, {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify(payload), muteHttpExceptions: true
    })
    const code = res.getResponseCode()
    Logger.log('Webhook ' + code + ': ' + res.getContentText().slice(0, 80))
    return code >= 200 && code < 300
  } catch(e) {
    Logger.log('Webhook error: ' + e.toString())
    return false
  }
}

// =============================================
// DAILY DIGEST
// =============================================
function sendDailyDigest() {
  try {
    const ss        = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
    const taskSheet = ss.getSheetByName(CONFIG.SHEET_TASKS)
    if (!taskSheet || !CONFIG.DEFAULT_WEBHOOK) return

    const taskData = taskSheet.getDataRange().getValues()
    const tasks    = taskData.slice(1).filter(r => r[0])
    const today    = new Date(); today.setHours(0,0,0,0)

    const inProgress = tasks.filter(r => r[CONFIG.COL_TASK.STATUS] === 'progress')
    const overdue    = tasks.filter(r => {
      if (!r[CONFIG.COL_TASK.TARGET] || r[CONFIG.COL_TASK.STATUS] === 'done') return false
      const d = new Date(r[CONFIG.COL_TASK.TARGET]); d.setHours(0,0,0,0)
      return d < today
    })
    const dueToday = tasks.filter(r => {
      if (!r[CONFIG.COL_TASK.TARGET] || r[CONFIG.COL_TASK.STATUS] === 'done') return false
      const d = new Date(r[CONFIG.COL_TASK.TARGET]); d.setHours(0,0,0,0)
      return d.getTime() === today.getTime()
    })

    sendToWebhook(CONFIG.DEFAULT_WEBHOOK, {
      event:  'daily_digest',
      date:   today.toISOString().split('T')[0],
      summary: {
        total: tasks.length, in_progress: inProgress.length,
        overdue: overdue.length, due_today: dueToday.length
      },
      overdue_tasks:   overdue.map(r  => ({ name: r[1], deadline: r[6], progress: r[8] })),
      due_today_tasks: dueToday.map(r => ({ name: r[1], deadline: r[6], progress: r[8] })),
      message: '📋 Daily Digest | Total: ' + tasks.length + ' | Jalan: ' + inProgress.length + ' | Deadline hari ini: ' + dueToday.length + ' | Terlambat: ' + overdue.length,
      source:  'PR Task Manager GAS'
    })
    Logger.log('Daily digest terkirim')
  } catch(e) { Logger.log('ERROR digest: ' + e.toString()) }
}

// =============================================
// SETUP TRIGGER
// =============================================
function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t))
  ScriptApp.newTrigger('checkAndSendReminders').timeBased().everyMinutes(1).create()
  ScriptApp.newTrigger('sendDailyDigest').timeBased().everyDays(1).atHour(7).create()
  Logger.log('✅ Triggers terpasang: checkAndSendReminders (1 menit) + sendDailyDigest (07:00)')
}

function removeTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t))
  Logger.log('Semua trigger dihapus.')
}

function testConnection() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
    Logger.log('✅ Spreadsheet: ' + ss.getName())
    const remSheet  = ss.getSheetByName(CONFIG.SHEET_REMINDERS)
    const taskSheet = ss.getSheetByName(CONFIG.SHEET_TASKS)
    Logger.log(remSheet  ? '✅ Sheet reminders: ' + (remSheet.getLastRow()-1)  + ' baris' : '❌ Sheet reminders tidak ada')
    Logger.log(taskSheet ? '✅ Sheet tasks: '    + (taskSheet.getLastRow()-1)  + ' baris' : '❌ Sheet tasks tidak ada')
    if (CONFIG.DEFAULT_WEBHOOK && !CONFIG.DEFAULT_WEBHOOK.includes('GANTI')) {
      const ok = sendToWebhook(CONFIG.DEFAULT_WEBHOOK, { event: 'test_connection', message: '✅ GAS Scheduler siap!', source: 'PR Task Manager GAS' })
      Logger.log(ok ? '✅ Webhook test OK' : '❌ Webhook test gagal')
    }
  } catch(e) { Logger.log('❌ Error: ' + e.toString()) }
}