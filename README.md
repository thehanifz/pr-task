# PR.Tasks

Personal task tracker berbasis Vue 3 + Vite + Express. Data tersimpan di Google Sheets milik kamu sendiri, config user (termasuk PIN hash) disimpan aman di server, notifikasi via n8n webhook. **Tidak butuh upload credential atau service account** — cukup login dengan akun Google kamu.

[![Vue 3](https://img.shields.io/badge/Vue-3.x-42b883?logo=vue.js)](https://vuejs.org)
[![Vite](https://img.shields.io/badge/Vite-5.x-646cff?logo=vite)](https://vitejs.dev)
[![Express](https://img.shields.io/badge/Server-Express-000000?logo=express)](https://expressjs.com)
[![Google Sheets](https://img.shields.io/badge/Storage-Google%20Sheets-34a853?logo=google-sheets)](https://sheets.google.com)

---

## ✨ Fitur

- **Tasks CRUD** — tambah, edit, hapus, drag-reorder task
- **Daily Log** — catatan progress harian per task
- **Reminder** — reminder one-shot & recurring via n8n webhook
- **Tree Diagram** — mindmap / pohon hierarki task, expand/collapse, edit warna node
- **Dashboard** — chart status, progres rata-rata, deadline upcoming
- **PIN Lock** — hash SHA-256, lockout 15 menit setelah 3x salah, sync cross-browser via server
- **Google OAuth 2.0 PKCE** — login sekali, token auto-refresh, data di sheet sendiri
- **Config Server-side** — sheetId, webhook, pinHash disimpan terenkripsi di server untuk cross-browser
- **GAS Scheduler** — Google Apps Script untuk kirim reminder otomatis

---

## 🛠 Stack

| Layer | Teknologi |
|---|---|
| Frontend | Vue 3 + Vite + Pinia + Vue Router |
| Backend | Express.js (Node.js) |
| Storage | Google Sheets API v4 |
| Config Store | `server/data/users.json` (AES encrypted) |
| Auth | Google OAuth 2.0 PKCE + PIN lokal (SHA-256) |
| Notification | n8n Webhook |
| Scheduler | Google Apps Script |
| Process Manager | PM2 |

---

## 📁 Struktur Project

```
pr-task/
├── server/
│   ├── index.js              ← Express server entry
│   ├── routes/
│   │   └── userConfig.js     ← GET/POST /api/user (config + pinHash)
│   └── data/
│       └── users.json        ← config user (auto-created, di .gitignore)
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
│   │   ├── LoginPage.vue
│   │   ├── LockPage.vue          ← PIN lock + countdown lockout
│   │   ├── SetupPage.vue         ← Setup pertama + Google Login
│   │   ├── OAuthCallbackPage.vue ← Handle callback + pull config dari server
│   │   ├── DashboardPage.vue
│   │   ├── TasksPage.vue
│   │   ├── TaskDetailPage.vue
│   │   ├── TreePage.vue          ← Tree diagram
│   │   └── SettingsPage.vue
│   ├── router/
│   │   └── index.js
│   ├── services/
│   │   ├── googleOAuth.js    ← PKCE flow, token storage, auto-refresh
│   │   ├── googleSheets.js   ← Sheets API v4
│   │   └── webhook.js
│   ├── stores/
│   │   ├── auth.js           ← PIN, lockout, sync config server
│   │   ├── tasks.js
│   │   └── tree.js
│   ├── styles/
│   │   └── global.css
│   ├── App.vue
└── main.js
├── gas/
│   └── scheduler.gs      ← GAS scheduler reminder
├── ecosystem.config.cjs  ← PM2 config
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

```bash
cp .env.example .env
```

Isi `.env`:

```env
VITE_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
VITE_SECRET_KEY=random_string_32chars_untuk_enkripsi
```

### 3. Setup Google Cloud (1x)

1. Buka [Google Cloud Console](https://console.cloud.google.com)
2. Buat project baru atau pilih yang sudah ada
3. **APIs & Services → Library** → Enable:
   - **Google Sheets API**
   - **Google Drive API**
4. **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Web Application**
   - Authorized JavaScript origins: `http://localhost:5173` + domain produksi
   - Authorized redirect URIs: `http://localhost:5173/oauth/callback` + `https://domain.com/oauth/callback`
5. Copy **Client ID** → paste ke `.env` sebagai `VITE_GOOGLE_CLIENT_ID`

> OAuth PKCE tidak butuh Client Secret — aman untuk SPA.

### 4. Jalankan

```bash
# Development (frontend + backend sekaligus)
npm run dev
# Frontend → http://localhost:5173
# Backend  → http://localhost:3001

# Build production
npm run build

# Production (via PM2)
pm2 start ecosystem.config.cjs
```

---

## 📊 Setup Google Spreadsheet

Spreadsheet dibuat **otomatis** saat pertama login, atau pakai spreadsheet yang sudah ada.

Jika pakai sheet sendiri, pastikan ada tab berikut (dibuat otomatis jika belum ada):

| Tab | Kolom Utama |
|---|---|
| `tasks` | id, nama, deskripsi, kategori, prioritas, tgl_mulai, tgl_target, status, progres, sortOrder |
| `daily_log` | id, task_id, tanggal, catatan, progres |
| `reminders` | id, task_id, tipe, waktu_kirim, pesan, terkirim, webhook_url, recurring, recurring_type |
| `tree_nodes` | id, name, color, parentId, collapsed, order, updatedAt |

---

## 🔒 Keamanan PIN & Config

- PIN disimpan sebagai **SHA-256 hash** — tidak bisa di-reverse
- Hash PIN + sheetId + webhook URL **dienkripsi AES** di `server/data/users.json`
- **Cross-browser**: login di browser baru → config otomatis di-restore dari server
- **Lockout otomatis**: 3x PIN salah → terkunci 15 menit
- Logout menghapus **semua data lokal** (localStorage + sessionStorage)

---

## ☁️ Deploy ke VPS + PM2 + Cloudflare

```bash
# 1. Clone & install di VPS
git clone https://github.com/thehanifz/pr-task.git
cd pr-task
npm install

# 2. Isi .env
cp .env.example .env
nano .env

# 3. Build frontend
npm run build

# 4. Jalankan dengan PM2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Arahkan **Cloudflare Tunnel** ke `localhost:7465`.

Pastikan domain produksi sudah ditambahkan di **Authorized JavaScript origins** dan **Authorized redirect URIs** di Google Cloud Console.

---

## 🤖 GAS Scheduler (Reminder Otomatis)

File `gas/scheduler.gs` adalah Google Apps Script untuk mengirim reminder ke n8n webhook.

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
2. Klik **"Login dengan Google"** → pilih akun
3. Isi nama, PIN (4 digit), dan Sheet ID (opsional — kosongkan untuk auto-create)
4. Klik **"Mulai Gunakan"**
5. Masukkan PIN → mulai tambah task!

> Login ulang di browser lain? Cukup **Login Google** — semua config (sheetId, webhook, PIN) otomatis di-restore dari server.

---

## 📄 Lisensi

MIT License — bebas digunakan dan dimodifikasi.
