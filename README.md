# PR Task Manager

Personal task tracker berbasis Vue 3 + Vite, data tersimpan di Google Sheets milik kamu sendiri, notifikasi via n8n webhook. **Tidak butuh upload credential atau service account** — cukup login dengan akun Google kamu.

[![Vue 3](https://img.shields.io/badge/Vue-3.x-42b883?logo=vue.js)](https://vuejs.org)
[![Vite](https://img.shields.io/badge/Vite-5.x-646cff?logo=vite)](https://vitejs.dev)
[![Google Sheets](https://img.shields.io/badge/Storage-Google%20Sheets-34a853?logo=google-sheets)](https://sheets.google.com)

---

## ✨ Fitur

- **Tasks CRUD** — tambah, edit, hapus, drag-reorder task
- **Daily Log** — catatan progress harian per task
- **Reminder** — reminder one-shot & recurring via n8n webhook
- **Tree Diagram** — mindmap / pohon hierarki task, expand/collapse, edit warna node
- **Dashboard** — chart status, progres rata-rata, deadline upcoming
- **PIN Lock** — keamanan lokal dengan hash SHA-256, lockout 15 menit setelah 3x salah
- **Google OAuth** — login sekali, token auto-refresh, data tersimpan di sheet kamu sendiri
- **GAS Scheduler** — Google Apps Script untuk kirim reminder otomatis

---

## 🛠 Stack

| Layer | Teknologi |
|---|---|
| Frontend | Vue 3 + Vite + Pinia + Vue Router |
| Storage | Google Sheets API v4 |
| Auth | Google OAuth 2.0 PKCE (tanpa client_secret) + PIN lokal |
| Notification | n8n Webhook |
| Scheduler | Google Apps Script |

---

## 📁 Struktur Project

```
pr-task/
├── src/
│   ├── components/
│   │   ├── AppModal.vue
│   │   ├── TaskCard.vue
│   │   ├── TaskFormModal.vue
│   │   ├── LogFormModal.vue
│   │   ├── ConfirmModal.vue
│   │   └── ToastContainer.vue
│   ├── composables/
│   │   ├── useToast.js
│   │   └── useTaskHelpers.js
│   ├── layouts/
│   │   └── AppLayout.vue
│   ├── pages/
│   │   ├── LockPage.vue        ← PIN lock + countdown lockout
│   │   ├── SetupPage.vue       ← Setup pertama + Google Login
│   │   ├── OAuthCallbackPage.vue
│   │   ├── DashboardPage.vue
│   │   ├── TasksPage.vue
│   │   ├── TaskDetailPage.vue
│   │   ├── TreePage.vue        ← Tree diagram
│   │   └── SettingsPage.vue
│   ├── router/
│   │   └── index.js
│   ├── services/
│   │   ├── googleOAuth.js      ← PKCE flow, token storage, auto-refresh
│   │   ├── googleSheets.js     ← Sheets API v4 (pakai OAuth token)
│   │   └── webhook.js
│   ├── stores/
│   │   ├── auth.js             ← PIN + lockout logic
│   │   ├── tasks.js            ← Tasks, logs, reminders
│   │   └── tree.js             ← Tree diagram state
│   ├── styles/
│   │   └── global.css
│   ├── App.vue
│   └── main.js
├── gas/
│   └── scheduler.gs            ← GAS scheduler reminder
├── .env.example
├── .gitignore
├── index.html
├── package.json
└── vite.config.js
```

---

## 🚀 Instalasi & Menjalankan

### 1. Clone & Install

```bash
git clone https://github.com/thehanifz/pr-task.git
cd pr-task
npm install
```

### 2. Konfigurasi Environment

Salin `.env.example` ke `.env`:

```bash
cp .env.example .env
```

Isi `.env`:

```env
VITE_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
```

### 3. Setup Google Cloud (1x)

1. Buka [Google Cloud Console](https://console.cloud.google.com)
2. Buat project baru atau pilih yang sudah ada
3. **APIs & Services → Library** → Enable:
   - **Google Sheets API**
   - **Google Drive API**
4. **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Web Application**
   - Authorized JavaScript origins: `http://localhost:5173` (dev) + domain produksi kamu
   - Authorized redirect URIs: `http://localhost:5173/oauth/callback` + `https://domain-kamu.com/oauth/callback`
5. Copy **Client ID** → paste ke `.env` sebagai `VITE_GOOGLE_CLIENT_ID`

> **Catatan:** OAuth PKCE tidak butuh Client Secret — aman untuk app publik / SPA.

### 4. Jalankan

```bash
# Development
npm run dev
# → http://localhost:5173

# Build production
npm run build

# Preview build
npm run preview
```

---

## 📋 Setup Google Spreadsheet

Spreadsheet akan **dibuat otomatis** saat pertama login, atau kamu bisa gunakan spreadsheet yang sudah ada.

Jika pakai sheet yang sudah ada, pastikan memiliki tab berikut (dibuat otomatis jika belum ada):

| Tab | Kolom |
|---|---|
| `tasks` | id, nama, deskripsi, kategori, prioritas, tgl_mulai, tgl_target, status, progres, tgl_selesai, sortOrder |
| `daily_log` | id, task_id, tanggal, catatan, progres |
| `reminders` | id, task_id, tipe, waktu_kirim, pesan, terkirim, webhook_url, recurring, recurring_type, recurring_days, recurring_time, recurring_end |
| `tree_nodes` | id, name, color, parentId, collapsed, order, updatedAt |

---

## 🔒 Keamanan PIN

- PIN disimpan sebagai **SHA-256 hash** di localStorage (tidak reversible)
- **Lockout otomatis**: 3x PIN salah → terkunci 15 menit
- Countdown timer tampil di layar selama lockout
- Counter lockout bertahan walau tab di-refresh

---

## ☁️ Deploy ke VPS + Cloudflare

```bash
# Build
npm run build

# Serve dengan nginx
# Copy dist/ ke /var/www/pr-task/
# Konfigurasi nginx:
server {
  listen 5173;
  root /var/www/pr-task;
  index index.html;
  location / { try_files $uri $uri/ /index.html; }
}
```

Arahkan **Cloudflare Tunnel** ke `localhost:5173`.

Pastikan domain produksi sudah ditambahkan di **Authorized JavaScript origins** dan **Authorized redirect URIs** di Google Cloud Console.

---

## 🤖 GAS Scheduler (Reminder Otomatis)

File `gas/scheduler.gs` adalah Google Apps Script untuk mengirim reminder otomatis ke n8n webhook.

### Setup:
1. Buka [script.google.com](https://script.google.com) → New Project
2. Copy-paste isi `gas/scheduler.gs`
3. Edit `CONFIG.SPREADSHEET_ID` dengan Spreadsheet ID kamu
4. Edit `CONFIG.DEFAULT_WEBHOOK` dengan URL n8n webhook kamu
5. **Triggers → Add Trigger**: fungsi `checkAndSendReminders`, time-driven, setiap 1 menit
6. Authorize akses ke spreadsheet

---

## 🔄 Penggunaan Pertama

1. Buka aplikasi di browser
2. Klik **"Login dengan Google"** → pilih akun Google kamu
3. Isi nama, PIN (4 digit), dan Sheet ID (opsional — kosongkan untuk auto-create)
4. Klik **"Mulai Gunakan"**
5. Masukkan PIN → mulai tambah task!

---

## 📄 Lisensi

MIT License — bebas digunakan dan dimodifikasi.
