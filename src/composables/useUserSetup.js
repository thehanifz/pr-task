/**
 * useUserSetup.js
 * Composable untuk cek dan load config user setelah login.
 * Dipakai di App.vue atau halaman utama setelah OAuth callback.
 */

import { ref } from 'vue'
import { getUserConfig, isUserRegistered } from '@/services/userConfig'

export function useUserSetup() {
  const isLoading    = ref(false)
  const isNewUser    = ref(false)
  const userConfig   = ref(null)
  const setupError   = ref(null)

  /**
   * Cek config user setelah login.
   * @param {string} email - email dari Google OAuth
   * @returns {{ isNew: boolean, config: object|null }}
   */
  async function checkUserConfig(email) {
    isLoading.value  = true
    setupError.value = null

    try {
      const config = await getUserConfig(email)

      if (!config || !config.sheetId) {
        // User baru — belum ada di data.js atau sheetId kosong
        isNewUser.value  = true
        userConfig.value = null
        return { isNew: true, config: null }
      }

      // User lama — langsung load config
      isNewUser.value  = false
      userConfig.value = config
      return { isNew: false, config }

    } catch (err) {
      setupError.value = err.message
      return { isNew: true, config: null }
    } finally {
      isLoading.value = false
    }
  }

  return { isLoading, isNewUser, userConfig, setupError, checkUserConfig }
}
