# ⚡ Setup Google Apps Script — Phase 3

GAS akan jalan otomatis di server Google **gratis**, tanpa perlu server sendiri.
Tugasnya: cek tabel `reminders` setiap menit → kirim ke n8n jika waktunya tiba.

---

## Step 1: Buka Google Apps Script

1. Buka spreadsheet Google Sheets kamu (PR Task Manager)
2. Klik menu **Extensions → Apps Script**
3. Browser akan membuka editor GAS di tab baru

---

## Step 2: Buat File Script

Di panel kiri editor GAS:

1. Klik ikon **+** di sebelah "Files"
2. Pilih **Script**
3. Beri nama: `scheduler`
4. **Hapus** semua kode default yang ada
5. **Copy-paste** seluruh isi file `gas/scheduler.gs` dari project ini

---

## Step 3: Isi Konfigurasi

Di bagian atas `scheduler.gs`, temukan blok `CONFIG` dan isi:

```javascript
const CONFIG = {
  SPREADSHEET_ID: '1BxiMVs0XRA5nFMd...', // ← ID spreadsheet kamu
  DEFAULT_WEBHOOK: 'https://n8n.domain.com/webhook/xxx', // ← URL n8n kamu
  // ... sisanya jangan diubah
}
```

**Cara dapat Spreadsheet ID:**
Dari URL spreadsheet:
```
https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID_INI]/edit
```

---

## Step 4: Test Koneksi

1. Di dropdown fungsi (atas tengah editor), pilih **`testConnection`**
2. Klik tombol **▶ Run**
3. Klik **Review permissions** → pilih akun Google kamu → **Allow**
4. Lihat hasil di panel **Execution log** (bawah)

Hasil yang diharapkan:
```
✅ Spreadsheet terhubung: PR Task Manager
✅ Sheet "reminders" ditemukan, X reminder
✅ Sheet "tasks" ditemukan, X task
✅ Webhook test berhasil
```

---

## Step 5: Install Trigger Otomatis

1. Di dropdown fungsi, pilih **`setupTriggers`**
2. Klik **▶ Run**
3. Hasil di log:
```
✅ Triggers berhasil dipasang!
  - checkAndSendReminders: setiap 1 menit
  - sendDailyDigest: setiap hari jam 07:00
```

Untuk verifikasi, klik **Triggers** (ikon jam di sidebar kiri):
- `checkAndSendReminders` → Time-driven → Every minute
- `sendDailyDigest` → Time-driven → Day timer → 7am - 8am

---

## Step 6: Verifikasi Berjalan

Setelah trigger terpasang, tunggu 1-2 menit lalu:

1. Klik **Executions** (ikon di sidebar kiri)
2. Kamu akan melihat `checkAndSendReminders` berjalan otomatis
3. Klik salah satu untuk lihat log-nya

---

## Cara Kerja Alur Lengkap

```
Setiap 1 menit:
  GAS → baca sheet "reminders"
       ↓
  Filter: terkirim=FALSE dan sendAt <= sekarang
       ↓
  Untuk setiap reminder:
    → POST ke webhook_url (atau DEFAULT_WEBHOOK)
    → Update kolom terkirim = TRUE
       ↓
  n8n menerima payload:
    {
      "event": "task_reminder",
      "reminder_type": "deadline_h1",
      "task_name": "Rebuild PDF Editor",
      "progress": 45,
      "deadline": "2025-03-01",
      "message": "🔴 Deadline besok! ..."
    }
       ↓
  n8n routing → WhatsApp / Telegram / Discord / dll
```

---

## Payload yang Dikirim ke n8n

### Reminder biasa:
```json
{
  "event": "task_reminder",
  "reminder_id": "R1A2B3",
  "reminder_type": "deadline_h1",
  "task_id": "T4C5D6",
  "task_name": "Rebuild PDF Editor",
  "task_category": "dev",
  "task_status": "progress",
  "progress": 45,
  "deadline": "2025-03-01",
  "message": "🔴 Deadline besok! \"Rebuild PDF Editor\" — progress 45%",
  "sent_at": "2025-02-28T07:00:00.000Z",
  "source": "PR Task Manager GAS"
}
```

### Daily digest (jam 07:00):
```json
{
  "event": "daily_digest",
  "date": "2025-02-28",
  "summary": {
    "total": 13,
    "in_progress": 4,
    "overdue": 1,
    "due_today": 2
  },
  "overdue_tasks": [
    { "name": "Upload konten aplikasi", "deadline": "2025-02-25", "progress": 20 }
  ],
  "due_today_tasks": [
    { "name": "Buat link generate teskom", "deadline": "2025-02-28", "progress": 60 }
  ],
  "message": "📋 Daily Digest PR Task Manager\n..."
}
```

---

## Konfigurasi n8n yang Direkomendasikan

Di n8n, buat workflow dengan struktur:

```
Webhook (POST /pr-task-reminder)
    ↓
Switch node (berdasarkan field "event"):
    ├── "task_reminder"  → Format pesan WA → WA Gateway
    ├── "daily_digest"   → Format digest    → WA Gateway
    └── "test_connection"→ Log saja
```

### Filter di Switch node:
- Condition: `{{ $json.event }}` equals `task_reminder`
- Condition: `{{ $json.event }}` equals `daily_digest`

### Contoh format pesan WA:
```
{{ $json.message }}

Task: {{ $json.task_name }}
Progress: {{ $json.progress }}%
Deadline: {{ $json.deadline }}
```

---

## Troubleshooting

**GAS tidak bisa akses Spreadsheet:**
- Pastikan kamu login dengan akun Google yang sama sebagai owner spreadsheet
- Coba klik Review Permissions ulang

**Webhook gagal (response != 2xx):**
- Cek n8n workflow sudah aktif (tidak draft)
- Cek URL webhook benar (termasuk https://)
- Di n8n: pastikan node Webhook sudah klik "Listen for test event" jika masih testing

**Trigger tidak muncul di daftar Triggers:**
- Jalankan `setupTriggers` ulang
- Jika ada error "exceeded maximum execution time", normal — GAS ada limit 6 menit per eksekusi

**`checkAndSendReminders` error setiap menit:**
- Cek Execution log → klik eksekusi yang gagal → baca pesan errornya
- Paling sering: Spreadsheet ID salah, atau sheet name typo

---

## Quota & Limits GAS (Free)

| Resource | Limit |
|----------|-------|
| Trigger eksekusi/hari | 20 menit total runtime |
| URL Fetch (webhook) | 20.000 call/hari |
| Spreadsheet read/write | 20.000 call/hari |

Untuk penggunaan personal (< 50 reminder/hari), quota ini **lebih dari cukup**.

---

## Uninstall / Pause

Untuk **pause** sementara tanpa hapus trigger:
- Di editor GAS → Triggers → klik trigger → **Disable**

Untuk **hapus** semua trigger:
1. Pilih fungsi `removeTriggers`
2. Klik ▶ Run
