<template>
  <div class="layout">
    <!-- Desktop sidebar -->
    <aside class="sidebar">
      <div class="sidebar-logo">
        <div class="logo-text">PR<span style="color:var(--accent)">.</span>Tasks</div>
        <div class="logo-sub mono">Task Manager v2.0</div>
      </div>

      <nav class="sidebar-nav">
        <div class="nav-section">Menu</div>
        <router-link to="/" class="nav-item" exact>
          <span>📊</span> Dashboard
        </router-link>
        <router-link to="/tasks" class="nav-item">
          <span>📋</span> Semua Task
          <span class="nav-badge">{{ store.totalTasks }}</span>
        </router-link>
        <router-link to="/reminders" class="nav-item">
          <span>⏰</span> Reminders
          <span v-if="pendingReminders" class="nav-badge nav-badge--yellow">
            {{ pendingReminders }}
          </span>
        </router-link>

        <div class="nav-section">Tools</div>
        <router-link to="/tree" class="nav-item">
          <span>🌳</span> Tree Diagram
        </router-link>
      </nav>

      <div class="sidebar-status">
        <div class="status-row">
          <router-link to="/tasks?status=progress" class="status-chip status-chip--blue">
            <span class="status-chip-dot" />Jalan
            <span class="status-chip-count">{{ store.inProgressCount }}</span>
          </router-link>
          <router-link to="/tasks?status=todo" class="status-chip status-chip--muted">
            <span class="status-chip-dot" />Belum
            <span class="status-chip-count">{{ store.todoCount }}</span>
          </router-link>
        </div>
        <div class="status-row">
          <router-link to="/tasks?status=done" class="status-chip status-chip--green">
            <span class="status-chip-dot" />Selesai
            <span class="status-chip-count">{{ store.doneCount }}</span>
          </router-link>
          <router-link to="/tasks?status=paused" class="status-chip status-chip--orange">
            <span class="status-chip-dot" />Ditunda
            <span class="status-chip-count">{{ store.pausedCount }}</span>
          </router-link>
        </div>
      </div>

      <div class="sidebar-bottom">
        <div class="user-row">
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
          <router-link to="/settings" class="gear-btn" title="Pengaturan">⚙️</router-link>
        </div>

        <button class="lock-btn" type="button" @click="lockApp">🔒 Kunci Aplikasi</button>
      </div>
    </aside>

    <!-- Mobile topbar: navigation lives in the bottom bar -->
    <header class="mobile-topbar">
      <span class="logo-text">PR<span style="color:var(--accent)">.</span>Tasks</span>
      <span class="mobile-topbar-spacer" aria-hidden="true" />
    </header>

    <main class="main-content">
      <router-view />
    </main>

    <!-- Mobile bottom navigation -->
    <nav class="mobile-bottom-nav" aria-label="Navigasi utama">
      <router-link to="/" class="mobile-nav-item" exact @click="moreOpen = false">
        <span class="mobile-nav-icon">📊</span>
        <span>Home</span>
      </router-link>
      <router-link to="/tasks" class="mobile-nav-item" @click="moreOpen = false">
        <span class="mobile-nav-icon">📋</span>
        <span>Tasks</span>
        <span v-if="store.totalTasks" class="mobile-nav-badge">{{ store.totalTasks }}</span>
      </router-link>
      <router-link to="/reminders" class="mobile-nav-item" @click="moreOpen = false">
        <span class="mobile-nav-icon">⏰</span>
        <span>Reminder</span>
        <span v-if="pendingReminders" class="mobile-nav-badge mobile-nav-badge--yellow">{{ pendingReminders }}</span>
      </router-link>
      <router-link to="/tree" class="mobile-nav-item" @click="moreOpen = false">
        <span class="mobile-nav-icon">🌳</span>
        <span>Tree</span>
      </router-link>
      <button
        type="button"
        :class="['mobile-nav-item', { active: moreOpen }]"
        :aria-expanded="moreOpen"
        aria-controls="mobile-more-sheet"
        @click="moreOpen = !moreOpen"
      >
        <span class="mobile-nav-icon">•••</span>
        <span>Lainnya</span>
      </button>
    </nav>

    <!-- Mobile secondary actions -->
    <Transition name="mobile-sheet">
      <div v-if="moreOpen" class="mobile-more-backdrop" @click.self="moreOpen = false">
        <section id="mobile-more-sheet" class="mobile-more-sheet" role="dialog" aria-modal="true" aria-label="Menu lainnya">
          <div class="mobile-sheet-handle" />
          <div class="mobile-more-head">
            <div>
              <div class="mobile-more-kicker">AKUN & APLIKASI</div>
              <strong>{{ auth.userName }}</strong>
              <small :class="['conn-status', `conn-${store.connStatus}`]">{{ store.connMsg || '—' }}</small>
            </div>
            <button type="button" class="mobile-sheet-close" aria-label="Tutup menu" @click="moreOpen = false">×</button>
          </div>

          <div class="mobile-more-grid">
            <router-link to="/settings" class="mobile-more-action" @click="moreOpen = false">
              <span>⚙️</span>
              <span><strong>Pengaturan</strong><small>Konfigurasi aplikasi</small></span>
            </router-link>
            <button type="button" class="mobile-more-action" @click="lockApp">
              <span>🔒</span>
              <span><strong>Kunci Aplikasi</strong><small>Amankan sesi saat selesai</small></span>
            </button>
          </div>

          <div class="mobile-more-stats">
            <span>🔵 Jalan <b>{{ store.inProgressCount }}</b></span>
            <span>⚪ Belum <b>{{ store.todoCount }}</b></span>
            <span>🟢 Selesai <b>{{ store.doneCount }}</b></span>
            <span>🟠 Ditunda <b>{{ store.pausedCount }}</b></span>
          </div>
        </section>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useTasksStore } from '@/stores/tasks'

const auth = useAuthStore()
const store = useTasksStore()
const router = useRouter()
const moreOpen = ref(false)

const pendingReminders = computed(() => store.reminders.filter(r => !r.sent).length)

function lockApp() {
  moreOpen.value = false
  auth.lock()
  router.push('/lock')
}
</script>

<style scoped>
.layout { display: flex; min-height: 100vh; }

.sidebar {
  position: fixed; top: 0; left: 0; bottom: 0;
  width: 224px; background: var(--bg2);
  border-right: 1px solid var(--border);
  z-index: 100; display: flex; flex-direction: column;
}
.sidebar-logo { padding: 20px 18px 14px; border-bottom: 1px solid var(--border); }
.logo-text { font-size: 1.1rem; font-weight: 800; letter-spacing: -0.5px; }
.logo-sub { font-size: 0.6rem; color: var(--muted); margin-top: 2px; }
.sidebar-nav { flex: 1; padding: 10px 8px; overflow-y: auto; }
.nav-section {
  font-family: var(--font-mono); font-size: 0.58rem; color: var(--muted);
  text-transform: uppercase; letter-spacing: 0.12em; padding: 10px 10px 4px;
}
.nav-item {
  display: flex; align-items: center; gap: 9px; padding: 8px 10px;
  border-radius: var(--radius); font-size: 0.82rem; font-weight: 600;
  color: var(--text2); text-decoration: none; transition: all 0.15s; margin-bottom: 2px;
}
.nav-item:hover { background: var(--surface); color: var(--text); }
.nav-item.router-link-active { background: var(--accent-glow); color: var(--accent); border: 1px solid rgba(59,130,246,0.2); }
.nav-item[href="/"].router-link-active:not(.router-link-exact-active) { background: transparent; color: var(--text2); border: none; }
.nav-item[href="/"].router-link-exact-active { background: var(--accent-glow); color: var(--accent); border: 1px solid rgba(59,130,246,0.2); }
.nav-badge {
  margin-left: auto; background: var(--surface2); color: var(--text2);
  font-size: 0.62rem; font-weight: 700; padding: 2px 6px; border-radius: 99px; font-family: var(--font-mono);
}
.nav-badge--yellow { background: rgba(245,158,11,0.2); color: var(--yellow); }
.sidebar-status { padding: 8px 10px 6px; border-top: 1px solid var(--border); display: flex; flex-direction: column; gap: 6px; }
.status-row { display: flex; gap: 6px; }
.status-chip {
  display: flex; align-items: center; gap: 5px; flex: 1; padding: 5px 8px;
  border-radius: var(--radius); font-size: 0.72rem; font-weight: 700; text-decoration: none;
  background: var(--surface); color: var(--text2); border: 1px solid var(--border); transition: all 0.15s;
}
.status-chip:hover { color: var(--text); border-color: var(--border2); }
.status-chip-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; background: currentColor; }
.status-chip-count { margin-left: auto; font-family: var(--font-mono); font-size: 0.68rem; }
.status-chip--blue { color: #60a5fa; }
.status-chip--green { color: var(--green); }
.status-chip--orange { color: var(--yellow); }
.status-chip--muted { color: var(--text2); }
.sidebar-bottom { padding: 10px 8px 14px; border-top: 1px solid var(--border); }
.user-row { display: flex; align-items: center; padding: 6px 4px 4px; gap: 4px; }
.user-chip { display: flex; align-items: center; gap: 10px; padding: 6px 8px; flex: 1; min-width: 0; }
.user-avatar {
  width: 30px; height: 30px; border-radius: 50%; background: linear-gradient(135deg, var(--accent), var(--purple));
  display: flex; align-items: center; justify-content: center; font-size: 0.78rem; font-weight: 800; color: #fff; flex-shrink: 0;
}
.user-name { font-size: 0.8rem; font-weight: 700; }
.gear-btn {
  display: flex; align-items: center; justify-content: center; width: 30px; height: 30px;
  border-radius: var(--radius); font-size: 1rem; text-decoration: none; color: var(--text2); transition: all 0.15s; flex-shrink: 0;
}
.gear-btn:hover { background: var(--surface); color: var(--text); }
.gear-btn.router-link-active { background: var(--accent-glow); color: var(--accent); }
.lock-btn {
  display: flex; align-items: center; gap: 8px; width: 100%; padding: 7px 10px; border-radius: var(--radius);
  background: transparent; border: none; color: var(--text2); font-size: 0.78rem; font-weight: 600; transition: all 0.15s; margin-top: 2px;
}
.lock-btn:hover { background: var(--surface); color: var(--red); }
.main-content { margin-left: 224px; padding: 28px 28px 60px; min-height: 100vh; flex: 1; position: relative; z-index: 1; }
.mobile-topbar, .mobile-bottom-nav, .mobile-more-backdrop { display: none; }

@media (max-width: 768px) {
  .sidebar { display: none; }
  .mobile-topbar {
    display: flex; position: fixed; top: 0; left: 0; right: 0; height: 54px;
    background: var(--bg2); border-bottom: 1px solid var(--border);
    align-items: center; justify-content: space-between; padding: 0 14px; z-index: 90;
  }
  .mobile-topbar-spacer { width: 36px; }
  .main-content {
    margin-left: 0;
    padding: 68px 14px calc(92px + env(safe-area-inset-bottom));
    min-height: 100vh;
  }
  .mobile-bottom-nav {
    display: grid; grid-template-columns: repeat(5, minmax(0, 1fr));
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 120;
    padding: 5px 8px max(7px, env(safe-area-inset-bottom));
    background: rgba(13,19,32,.98); border-top: 1px solid var(--border);
    box-shadow: 0 -8px 28px rgba(0,0,0,.28);
  }
  .mobile-nav-item {
    position: relative; min-width: 0; min-height: 58px; border: 0; border-radius: 10px;
    background: transparent; color: var(--muted); text-decoration: none;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 3px; font-size: .61rem; font-weight: 800; line-height: 1.1;
  }
  .mobile-nav-item.router-link-active, .mobile-nav-item.active { color: var(--accent); background: var(--accent-glow); }
  .mobile-nav-item.router-link-active::after, .mobile-nav-item.active::after {
    content: ''; position: absolute; top: 3px; width: 22px; height: 2px; border-radius: 99px; background: var(--accent);
  }
  .mobile-nav-icon { font-size: 1.12rem; line-height: 1; }
  .mobile-nav-badge {
    position: absolute; top: 6px; right: calc(50% - 23px); min-width: 16px; height: 16px;
    padding: 0 4px; border-radius: 99px; display: flex; align-items: center; justify-content: center;
    background: var(--accent); color: #fff; font: 700 .55rem/1 var(--font-mono);
  }
  .mobile-nav-badge--yellow { background: var(--yellow); color: #111827; }

  .mobile-more-backdrop {
    display: flex; align-items: flex-end; position: fixed; inset: 0; z-index: 115;
    background: rgba(0,0,0,.55);
  }
  .mobile-more-sheet {
    width: 100%; background: var(--bg2); border-top: 1px solid var(--border2);
    border-radius: 18px 18px 0 0; padding: 9px 14px calc(82px + env(safe-area-inset-bottom));
    box-shadow: 0 -18px 50px rgba(0,0,0,.45);
  }
  .mobile-sheet-handle { width: 38px; height: 4px; margin: 0 auto 14px; border-radius: 99px; background: var(--border2); }
  .mobile-more-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding: 0 2px 14px; }
  .mobile-more-head strong { display: block; font-size: .9rem; }
  .mobile-more-head small { display: block; margin-top: 3px; font-size: .62rem; }
  .mobile-more-kicker { margin-bottom: 4px; font: 700 .56rem var(--font-mono); color: var(--muted); letter-spacing: .12em; }
  .mobile-sheet-close {
    width: 36px; height: 36px; border: 1px solid var(--border); border-radius: 10px;
    background: var(--surface); color: var(--text2); font-size: 1.25rem;
  }
  .mobile-more-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .mobile-more-action {
    min-height: 62px; display: flex; align-items: center; gap: 10px; padding: 10px;
    background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
    color: var(--text); text-decoration: none; text-align: left;
  }
  .mobile-more-action > span:first-child { font-size: 1.15rem; }
  .mobile-more-action strong { display: block; font-size: .73rem; }
  .mobile-more-action small { display: block; margin-top: 2px; color: var(--muted); font-size: .57rem; line-height: 1.3; }
  .mobile-more-stats {
    display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; margin-top: 10px;
  }
  .mobile-more-stats span {
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
    padding: 7px 9px; border: 1px solid var(--border); border-radius: 9px;
    color: var(--text2); font-size: .62rem;
  }
  .mobile-more-stats b { color: var(--text); font-family: var(--font-mono); }

  :deep(.tree-page) { min-height: calc(100vh - 145px); }
}

@media (max-width: 360px) {
  .mobile-nav-item { font-size: .56rem; }
  .mobile-nav-icon { font-size: 1rem; }
  .mobile-bottom-nav { padding-left: 4px; padding-right: 4px; }
  .main-content { padding-left: 10px; padding-right: 10px; }
}

.mobile-sheet-enter-active, .mobile-sheet-leave-active { transition: opacity .18s ease; }
.mobile-sheet-enter-active .mobile-more-sheet, .mobile-sheet-leave-active .mobile-more-sheet { transition: transform .22s ease; }
.mobile-sheet-enter-from, .mobile-sheet-leave-to { opacity: 0; }
.mobile-sheet-enter-from .mobile-more-sheet, .mobile-sheet-leave-to .mobile-more-sheet { transform: translateY(100%); }
</style>
