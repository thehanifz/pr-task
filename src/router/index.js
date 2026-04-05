import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getStoredToken } from '@/services/googleOAuth'

const routes = [
  // ─── Public: auth flow ───────────────────────────────────────────
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/pages/LoginPage.vue'),
    meta: { public: true }
  },
  {
    path: '/setup',
    name: 'Setup',
    component: () => import('@/pages/SetupPage.vue'),
    meta: { public: true }
  },
  {
    path: '/oauth/callback',
    name: 'OAuthCallback',
    component: () => import('@/pages/OAuthCallbackPage.vue'),
    meta: { public: true }
  },
  {
    path: '/lock',
    name: 'Lock',
    component: () => import('@/pages/LockPage.vue'),
    meta: { public: true }
  },

  // ─── Protected: main app ─────────────────────────────────────────
  {
    path: '/',
    component: () => import('@/layouts/AppLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '',          name: 'Dashboard',  component: () => import('@/pages/DashboardPage.vue') },
      { path: 'tasks',     name: 'Tasks',      component: () => import('@/pages/TasksPage.vue') },
      { path: 'tasks/:id', name: 'TaskDetail', component: () => import('@/pages/TaskDetailPage.vue'), props: true },
      { path: 'reminders', name: 'Reminders',  component: () => import('@/pages/RemindersPage.vue') },
      { path: 'tree',      name: 'Tree',       component: () => import('@/pages/TreePage.vue') },
      { path: 'settings',  name: 'Settings',   component: () => import('@/pages/SettingsPage.vue') }
    ]
  },

  { path: '/:pathMatch(.*)*', redirect: '/login' }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to) => {
  const auth        = useAuthStore()
  const hasToken    = !!getStoredToken()?.access_token
  const configured  = auth.isConfigured
  const unlocked    = auth.isUnlocked

  if (unlocked && to.meta.public && to.name !== 'OAuthCallback') {
    return { name: 'Dashboard' }
  }

  if (to.meta.requiresAuth) {
    if (!configured) return { name: 'Login' }
    if (!unlocked)   return { name: 'Lock' }
  }

  if (to.name === 'Setup' && !hasToken) {
    return { name: 'Login' }
  }
})

export default router
