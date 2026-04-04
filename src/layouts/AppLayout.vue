<template>
  <div class="layout">
    <div class="mobile-topbar">
      <button class="icon-btn" style="width:36px;height:36px;font-size:1.1rem" @click="sidebarOpen = true">☰</button>
      <span class="logo-text">PR<span style="color:var(--accent)">.</span>Tasks</span>
      <span style="width:36px" />
    </div>

    <div v-if="sidebarOpen" class="sidebar-overlay" @click="sidebarOpen = false" />

    <aside :class="['sidebar', { open: sidebarOpen }]">
      <div class="sidebar-logo">
        <div class="logo-text">PR<span style="color:var(--accent)">.</span>Tasks</div>
        <div class="logo-sub mono">Task Manager v2.0</div>
      </div>

      <nav class="sidebar-nav">
        <div class="nav-section">Menu</div>
        <router-link to="/" class="nav-item" exact @click="sidebarOpen = false">
          <span>📊</span> Dashboard
        </router-link>
        <router-link to="/tasks" class="nav-item" @click="sidebarOpen = false">
          <span>📋</span> Semua Task
          <span class="nav-badge">{{ store.totalTasks }}</span>
        </router-link>
        <router-link to="/priority" class="nav-item" @click="sidebarOpen = false">
          <span>🎯</span> Atur Prioritas
        </router-link>
        <router-link to="/reminders" class="nav-item" @click="sidebarOpen = false">
          <span>⏰</span> Reminders
          <span v-if="pendingReminders" class="nav-badge" style="background:rgba(245,158,11,0.3);color:var(--yellow)">
            {{ pendingReminders }}
          </span>
        </router-link>

        <div class="nav-section">Filter Task</div>
        <router-link to="/tasks?status=progress" class="nav-item" @click="sidebarOpen = false">
          <span>🔄</span> Sedang Jalan
          <span v-if="store.inProgressCount" class="nav-badge" style="background:rgba(59,130,246,0.2);color:#60a5fa">
            {{ store.inProgressCount }}
          </span>
        </router-link>
        <router-link to="/tasks?status=todo" class="nav-item" @click="sidebarOpen = false">
          <span>⏳</span> Belum Mulai
        </router-link>
        <router-link to="/tasks?status=done" class="nav-item" @click="sidebarOpen = false">
          <span>✅</span> Selesai
        </router-link>
        <router-link to="/tasks?status=paused" class="nav-item" @click="sidebarOpen = false">
          <span>⏸️</span> Ditunda
        </router-link>

        <div class="nav-section">Tools</div>
        <router-link to="/tree" class="nav-item" @click="sidebarOpen = false">
          <span>🌳</span> Tree Diagram
        </router-link>

        <div class="nav-section">Lainnya</div>
        <router-link to="/settings" class="nav-item" @click="sidebarOpen = false">
          <span>⚙️</span> Pengaturan
        </router-link>
      </nav>

      <div class="sidebar-bottom">
        <div class="user-chip">
          <div class="user-avatar">{{ auth.userName[0]?.toUpperCase() }}</div>
          <div style="min-width:0">
            <div class="user-name truncate">{{ auth.userName }}</div>
            <div :class="['conn-status', `conn-${store.connStatus}`]">
              <span v-if="store.connStatus === 'loading'" class="pulse-dot" />
              {{ store.connMsg || '—' }}
            </div>
          </div>
        </div>
        <button class="lock-btn" @click="lockApp">🔒 Kunci Aplikasi</button>
      </div>
    </aside>

    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore }  from '@/stores/auth'
import { useTasksStore } from '@/stores/tasks'

const auth   = useAuthStore()
const store  = useTasksStore()
const router = useRouter()
const sidebarOpen = ref(false)

const pendingReminders = computed(() => store.reminders.filter(r => !r.sent).length)

function lockApp() { auth.lock(); router.push('/lock') }
</script>

<style scoped>
.layout { display: flex; min-height: 100vh; }

.sidebar {
  position: fixed; top: 0; left: 0; bottom: 0;
  width: 224px; background: var(--bg2);
  border-right: 1px solid var(--border);
  z-index: 100; display: flex; flex-direction: column;
  transition: transform 0.28s ease;
}
.sidebar-logo { padding: 20px 18px 14px; border-bottom: 1px solid var(--border); }
.logo-text { font-size: 1.1rem; font-weight: 800; letter-spacing: -0.5px; }
.logo-sub  { font-size: 0.6rem; color: var(--muted); margin-top: 2px; }

.sidebar-nav { flex: 1; padding: 10px 8px; overflow-y: auto; }
.nav-section {
  font-family: var(--font-mono); font-size: 0.58rem;
  color: var(--muted); text-transform: uppercase;
  letter-spacing: 0.12em; padding: 10px 10px 4px;
}
.nav-item {
  display: flex; align-items: center; gap: 9px;
  padding: 8px 10px; border-radius: var(--radius);
  font-size: 0.82rem; font-weight: 600; color: var(--text2);
  text-decoration: none; transition: all 0.15s; margin-bottom: 2px;
}
.nav-item:hover { background: var(--surface); color: var(--text); }
.nav-item.router-link-active { background: var(--accent-glow); color: var(--accent); border: 1px solid rgba(59,130,246,0.2); }
.nav-item[href="/"].router-link-active:not(.router-link-exact-active) { background: transparent; color: var(--text2); border: none; }
.nav-item[href="/"].router-link-exact-active { background: var(--accent-glow); color: var(--accent); border: 1px solid rgba(59,130,246,0.2); }

.nav-badge {
  margin-left: auto; background: var(--surface2); color: var(--text2);
  font-size: 0.62rem; font-weight: 700; padding: 2px 6px;
  border-radius: 99px; font-family: var(--font-mono);
}

.sidebar-bottom { padding: 10px 8px 14px; border-top: 1px solid var(--border); }
.user-chip { display: flex; align-items: center; gap: 10px; padding: 8px 10px; }
.user-avatar {
  width: 30px; height: 30px; border-radius: 50%;
  background: linear-gradient(135deg, var(--accent), var(--purple));
  display: flex; align-items: center; justify-content: center;
  font-size: 0.78rem; font-weight: 800; color: #fff; flex-shrink: 0;
}
.user-name { font-size: 0.8rem; font-weight: 700; }
.lock-btn {
  display: flex; align-items: center; gap: 8px; width: 100%;
  padding: 7px 10px; border-radius: var(--radius);
  background: transparent; border: none; color: var(--text2);
  font-size: 0.78rem; font-weight: 600; transition: all 0.15s; margin-top: 2px;
}
.lock-btn:hover { background: var(--surface); color: var(--red); }

.main-content { margin-left: 224px; padding: 28px 28px 60px; min-height: 100vh; flex: 1; position: relative; z-index: 1; }

.mobile-topbar { display: none; }
.sidebar-overlay { display: none; }

@media (max-width: 768px) {
  .sidebar { transform: translateX(-100%); }
  .sidebar.open { transform: none; box-shadow: 4px 0 24px rgba(0,0,0,0.4); }
  .sidebar-overlay { display: block; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 99; }
  .mobile-topbar {
    display: flex; position: fixed; top: 0; left: 0; right: 0; height: 54px;
    background: var(--bg2); border-bottom: 1px solid var(--border);
    align-items: center; justify-content: space-between; padding: 0 14px; z-index: 90;
  }
  .main-content { margin-left: 0; padding: 70px 14px 40px; }
}
</style>
