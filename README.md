# PR Task Manager

Personal task tracker berbasis Vue 3 + Vite, data tersimpan di Google Sheets, notifikasi via n8n webhook.

## Stack
- **Frontend**: Vue 3 + Vite + Pinia + Vue Router
- **Storage**: Google Sheets (Service Account JWT auth)
- **Auth**: PIN lokal (SHA-256 hash di localStorage)
- **Notification**: n8n Webhook

---

## Struktur Project

```
pr-task-manager/
├── src/
│   ├── components/         # Komponen reusable
│   │   ├── AppModal.vue
│   │   ├── TaskCard.vue
│   │   ├── TaskFormModal.vue
│   │   ├── LogFormModal.vue
│   │   ├── ConfirmModal.vue
│   │   └── ToastContainer.vue
│   ├── composables/        # Logic reusable
│   │   ├── useToast.js
│   │   └── useTaskHelpers.js
│   ├── layouts/
│   │   └── AppLayout.vue   # Sidebar + layout utama
│   ├── pages/              # Halaman
│   │   ├── LockPage.vue
│   │   ├── SetupPage.vue
│   │   ├── DashboardPage.vue
│   │   ├── TasksPage.vue
│   │   ├── TaskDetailPage.vue
│   │   └── SettingsPage.vue
│   ├── router/
│   │   └── index.js        # Vue Router + navigation guard
│   ├── services/
│   │   ├── googleSheets.js # Semua logic Google Sheets API
│   │   └── webhook.js      # Kirim notifikasi ke n8n
│   ├── stores/
│   │   ├── auth.js         # PIN, config, credential
│   │   └── tasks.js        # Tasks, logs, reminders CRUD
│   ├── styles/
│   │   └── global.css      # Design system
│   ├── App.vue
│   └── main.js
├── public/
│   └── favicon.svg
├── credential.json         # ← TARUH FILE INI (jangan di-commit!)
├── .gitignore
├── index.html
├── package.json
└── vite.config.js
```

---

## Setup Google Sheets

### 1. Buat Spreadsheet
Buat spreadsheet baru di https://sheets.google.com, beri nama **PR Task Manager**.

Buat **3 tab** dengan header berikut:

**Tab `tasks`** (baris 1):
```
id | nama | deskripsi | kategori | prioritas | tgl_mulai | tgl_target | status | progres | tgl_selesai
```

**Tab `daily_log`** (baris 1):
```
id | task_id | tanggal | catatan | progres
```

**Tab `reminders`** (baris 1):
```
id | task_id | tipe | waktu_kirim | pesan | terkirim | webhook_url
```

### 2. Buat Service Account (Google Cloud)
1. https://console.cloud.google.com → New Project
2. APIs & Services → Library → Enable **Google Sheets API**
3. APIs & Services → Credentials → Create Credentials → Service Account
4. Service Account → Keys → Add Key → Create New Key → **JSON**
5. Simpan file JSON sebagai **`credential.json`** di root project ini

### 3. Share Spreadsheet
Share spreadsheet ke email service account (`client_email` dari credential.json), role: **Editor**.

---

## Instalasi & Menjalankan

```bash
# 1. Clone / download project ini
cd pr-task-manager

# 2. Taruh credential.json di root folder (sudah ada template-nya)

# 3. Install dependencies
npm install

# 4. Development mode
npm run dev
# App berjalan di http://0.0.0.0:5173

# 5. Build untuk production
npm run build
# Output: dist/

# 6. Preview hasil build
npm run preview
```

### Ganti Port
Edit `vite.config.js`:
```js
const PORT = 5173  // ← ganti ke port yang kamu mau
```

---

## Deploy ke VPS (Cloudflare Tunnel)

```bash
# Build
npm run build

# Serve menggunakan npm serve (simpel)
npm install -g serve
serve -s dist -l 5173

# Atau pakai nginx
# Copy isi dist/ ke /var/www/pr-task-manager/
# Konfigurasi nginx:
# server {
#   listen 5173;
#   root /var/www/pr-task-manager;
#   index index.html;
#   location / { try_files $uri $uri/ /index.html; }
# }
```

Kemudian arahkan Cloudflare Tunnel ke `localhost:5173`.

---

## Penggunaan Pertama

1. Buka aplikasi di browser
2. Klik **"Setup Pertama Kali"**
3. Isi: Nama, PIN (4 digit), Spreadsheet ID, upload `credential.json`
4. Opsional: isi n8n Webhook URL
5. Klik **Mulai Gunakan** → aplikasi akan test koneksi ke Sheets
6. Masukkan PIN → mulai tambah task!

---

## Roadmap

- **Phase 2**: Dashboard chart visual (donut chart status), export laporan
- **Phase 3**: Reminder system (Google Apps Script scheduler → n8n)
- **Phase 4**: PWA (installable di HP), dark/light mode toggle
