/**
 * webhook.js
 * Kirim notifikasi ke n8n webhook
 */

/**
 * Kirim payload ke webhook URL
 * @param {string} url - n8n webhook URL
 * @param {object} payload - data yang dikirim
 */
export async function sendWebhook(url, payload) {
  if (!url) throw new Error('Webhook URL belum dikonfigurasi')

  const res = await fetch(url, {
    method:  'POST',
    mode:    'no-cors', // n8n biasanya tidak set CORS header
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      ...payload,
      source:    'PR Task Manager',
      timestamp: new Date().toISOString()
    })
  })

  // no-cors → response.type === 'opaque', tidak bisa baca status
  // Anggap sukses jika tidak throw
  return true
}

/**
 * Test webhook dengan payload minimal
 */
export async function testWebhook(url) {
  return sendWebhook(url, {
    event:   'test',
    message: '✅ Test dari PR Task Manager berhasil!'
  })
}

/**
 * Kirim notifikasi task reminder
 */
export async function sendTaskReminder(url, task, reminderType, customMessage) {
  const messages = {
    deadline_h3: `⏰ Reminder: "${task.name}" deadline dalam 3 hari (${task.target})`,
    deadline_h1: `🔴 Deadline besok! "${task.name}" — progress ${task.progress}%`,
    deadline_d0: `🚨 HARI INI deadline: "${task.name}" — selesaikan sekarang!`,
    custom:      customMessage || `📌 Reminder: "${task.name}"`
  }

  return sendWebhook(url, {
    event:          'task_reminder',
    reminder_type:  reminderType,
    task_id:        task.id,
    task_name:      task.name,
    task_category:  task.cat,
    task_status:    task.status,
    progress:       task.progress,
    deadline:       task.target,
    message:        messages[reminderType] || messages.custom
  })
}

/**
 * Kirim notifikasi task selesai
 */
export async function sendTaskDone(url, task) {
  return sendWebhook(url, {
    event:      'task_completed',
    task_id:    task.id,
    task_name:  task.name,
    progress:   100,
    message:    `✅ Task selesai: "${task.name}"`
  })
}
