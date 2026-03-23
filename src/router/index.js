import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  {
    path: '/lock',
    name: 'Lock',
    component: () => import('@/pages/LockPage.vue'),
    meta: { public: true }
  },
  {
    path: '/setup',
    name: 'Setup',
    component: () => import('@/pages/SetupPage.vue'),
    meta: { public: true }
  },
  {
    path: '/',
    component: () => import('@/layouts/AppLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'Dashboard',
        component: () => import('@/pages/DashboardPage.vue')
      },
      {
        path: 'tasks',
        name: 'Tasks',
        component: () => import('@/pages/TasksPage.vue')
      },
      {
        path: 'tasks/:id',
        name: 'TaskDetail',
        component: () => import('@/pages/TaskDetailPage.vue'),
        props: true
      },
      {
        path: 'priority',
        name: 'Priority',
        component: () => import('@/pages/PriorityPage.vue')
      },
      {
        path: 'reminders',
        name: 'Reminders',
        component: () => import('@/pages/RemindersPage.vue')
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('@/pages/SettingsPage.vue')
      }
    ]
  },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (!auth.isConfigured && !to.meta.public) return { name: 'Setup' }
  if (auth.isConfigured && !auth.isUnlocked && to.meta.requiresAuth) return { name: 'Lock' }
  if (auth.isUnlocked && to.meta.public) return { name: 'Dashboard' }
})

export default router
