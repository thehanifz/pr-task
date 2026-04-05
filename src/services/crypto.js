/**
 * crypto.js
 * Encrypt / decrypt pakai AES dari CryptoJS
 * Secret key diambil dari VITE_SECRET_KEY di .env (hanya ada di VPS)
 */

import CryptoJS from 'crypto-js'

function getKey() {
  const key = import.meta.env.VITE_SECRET_KEY
  if (!key) throw new Error('VITE_SECRET_KEY tidak ditemukan di .env')
  return key
}

/**
 * Enkripsi string
 * @param {string} value - nilai asli
 * @returns {string} - nilai terenkripsi (AES)
 */
export function encryptValue(value) {
  if (!value) return ''
  return CryptoJS.AES.encrypt(value, getKey()).toString()
}

/**
 * Dekripsi string
 * @param {string} encrypted - nilai terenkripsi
 * @returns {string} - nilai asli
 */
export function decryptValue(encrypted) {
  if (!encrypted) return ''
  try {
    const bytes = CryptoJS.AES.decrypt(encrypted, getKey())
    return bytes.toString(CryptoJS.enc.Utf8)
  } catch {
    return ''
  }
}
