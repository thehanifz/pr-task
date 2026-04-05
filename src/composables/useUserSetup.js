/**
 * useUserSetup.js
 * Composable untuk cek dan load config user setelah login.
 */

import { ref } from 'vue'
import { getUserConfig, saveUserConfig } from '@/services/userConfig'

export function useUserSetup() {
  const isLoading  = ref(false)
  const isNewUser  = ref(false)
  const userConfig = ref(null)
  const setupError = ref(null)

  /**
   * Cek config user setelah login.
   * @param {string} email
   */
  async function checkUserConfig(email) {
    isLoading.value  = true
    setupError.value = null
    try {
      const data = await getUserConfig(email)
      if (!data.found || !data.sheetId) {
        isNewUser.value  = true
        userConfig.value = null
        return { isNew: true, config: null }
      }
      isNewUser.value  = false
      userConfig.value = { sheetId: data.sheetId, webhook: data.webhook }
      return { isNew: false, config: userConfig.value }
    } catch (err) {
      setupError.value = err.message
      return { isNew: true, config: null }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Simpan config setelah onboarding selesai.
   * @param {string} email
   * @param {string} sheetId
   * @param {string} webhook
   * @param {string} accessToken - dari Google OAuth
   */
  async function submitUserConfig(email, sheetId, webhook, accessToken) {
    isLoading.value  = true
    setupError.value = null
    try {
      await saveUserConfig(email, sheetId, webhook, accessToken)
      userConfig.value = { sheetId, webhook }
      isNewUser.value  = false
      return true
    } catch (err) {
      setupError.value = err.message
      return false
    } finally {
      isLoading.value = false
    }
  }

  return { isLoading, isNewUser, userConfig, setupError, checkUserConfig, submitUserConfig }
}
