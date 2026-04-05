# Setup Google OAuth untuk PR.Tasks

## 1. Buat OAuth Client ID di Google Cloud Console

1. Buka [Google Cloud Console](https://console.cloud.google.com/)
2. Buat project baru atau pilih project yang sudah ada
3. Aktifkan API berikut:
   - **Google Sheets API**
   - **Google Drive API**
4. Buka **APIs & Services → Credentials**
5. Klik **Create Credentials → OAuth 2.0 Client ID**
6. Application type: **Web application**
7. Isi nama (misal: `PR Tasks`)
8. **Authorized JavaScript origins** → tambahkan domain kamu:
   ```
   https://yourdomain.com
   http://localhost:5173  (untuk development)
   ```
9. **Authorized redirect URIs** → tambahkan:
   ```
   https://yourdomain.com/oauth/callback
   http://localhost:5173/oauth/callback  (untuk development)
   ```
10. Klik **Create** → salin **Client ID**

## 2. Set Environment Variable

Buat file `.env` di root project:
```env
VITE_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
```

Untuk production (Cloudflare Pages / server), set environment variable:
```
VITE_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
```

## 3. OAuth Consent Screen

1. Buka **APIs & Services → OAuth consent screen**
2. Pilih **External** (untuk publik) atau **Internal** (khusus akun organisasi)
3. Isi nama app, email support
4. **Scopes** → tambahkan:
   - `https://www.googleapis.com/auth/spreadsheets`
   - `https://www.googleapis.com/auth/drive.file`
   - `email`, `profile`
5. Kalau masih **Testing mode**: tambahkan email kamu ke **Test users**
6. Untuk publik: klik **Publish App** → submit untuk verifikasi Google (opsional, bisa pakai tanpa verifikasi dengan warning)

## 4. Cara Kerja untuk User

```
User buka app → klik "Login dengan Google"
    ↓
Google OAuth popup → user pilih akun
    ↓
Redirect ke /oauth/callback?code=xxx
    ↓
App tukar code → dapat access_token + refresh_token
    ↓
Token tersimpan di localStorage user masing-masing
    ↓
User input Sheet ID milik mereka sendiri
    ↓
App akses sheet via token user → data aman & terpisah
```

## 5. Catatan Keamanan

- **Token tersimpan di localStorage browser user** — tidak ada data sensitif di server
- **PKCE flow** — tidak butuh client_secret, aman untuk public SPA
- **Refresh token** — auto-refresh saat access token expired (~1 jam)
- **Setiap user akses sheet mereka sendiri** — tidak ada data bersama
- **PIN lockout** — 3x salah → tunggu 15 menit
