<template>
  <div
    :class="['task-card card card-hover', `status-${task.status}`, { 'is-overdue': isOverdue }]"
    @click="$emit('click', task)"
  >
    <!-- Overdue banner -->
    <div v-if="isOverdue" class="overdue-banner">⚠️ Overdue {{ Math.abs(diff) }}h hari</div>

    <!-- Top row -->
    <div class="card-top">
      <span :class="['badge', CAT_BADGE[task.cat] || 'cat-other']">{{ CAT_LABELS[task.cat] || task.cat }}</span>
      <div class="card-actions" @click.stop>
        <button class="icon-btn" title="Edit" @click="$emit('edit', task)">✏️</button>
        <button class="icon-btn danger" title="Hapus" @click="$emit('delete', task)">🗑️</button>
      </div>
    </div>

    <!-- Name & desc -->
    <div :class="['task-name', { 'task-done': task.status === 'done' }]">{{ task.name }}</div>
    <div v-if="task.desc" class="task-desc">{{ task.desc }}</div>

    <!-- Progress -->
    <div class="card-progress">
      <div class="cp-top">
        <span class="small muted" style="font-weight:600">Progres</span>
        <span :style="{ color: pctColor }" class="mono" style="font-size:0.75rem;font-weight:700">{{ task.progress }}%</span>
      </div>
      <div class="progress-bar">
        <div :class="['progress-fill', fillClass]" :style="{ width: task.progress + '%' }" />
      </div>
    </div>

    <!-- Meta -->
    <div class="card-meta">
      <span class="meta-left">
        <span :class="['priority-pill', `priority-${task.priority}`]">
          {{ PRIORITY_LABELS[task.priority] }}
        </span>
        <span :class="['badge', STATUS_BADGE[task.status]]" style="font-size:0.65rem">
          {{ STATUS_LABELS[task.status] }}
        </span>
      </span>
      <span class="meta-right">
        <span v-if="deadlineBadgeInfo && task.status !== 'done'" class="deadline-tag" :style="{ color: dlColor }">
          📅 {{ deadlineBadgeInfo.text }}
        </span>
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import {
  CAT_LABELS, CAT_BADGE,
  STATUS_LABELS, STATUS_BADGE,
  PRIORITY_LABELS, PRIORITY_DOT,
  progressFillClass, deadlineDiff, deadlineBadge
} from '@/composables/useTaskHelpers'

const props = defineProps({ task: Object })
defineEmits(['click', 'edit', 'delete'])

const fillClass         = computed(() => progressFillClass(props.task.progress))
const pctColor          = computed(() => props.task.progress >= 80 ? 'var(--green)' : props.task.progress >= 40 ? 'var(--yellow)' : 'var(--red)')
const diff              = computed(() => deadlineDiff(props.task.target))
const deadlineBadgeInfo = computed(() => deadlineBadge(diff.value))
const isOverdue         = computed(() => diff.value !== null && diff.value < 0 && props.task.status !== 'done')
const dlColor           = computed(() => {
  const d = diff.value
  if (d === null) return ''
  if (d < 0 || d === 0) return 'var(--red)'
  if (d <= 3)           return 'var(--yellow)'
  return 'var(--text2)'
})
</script>

<style scoped>
.task-card { cursor: pointer; position: relative; overflow: hidden; }
.task-card.status-done { opacity: 0.65; }

/* Overdue: left border merah + subtle bg */
.task-card.is-overdue {
  border-left: 3px solid var(--red) !important;
  background: color-mix(in srgb, var(--surface) 94%, var(--red) 6%) !important;
}
.overdue-banner {
  font-size: 0.68rem; font-weight: 700; color: var(--red);
  margin-bottom: 8px; letter-spacing: 0.02em;
}

/* Done: strikethrough nama */
.task-name.task-done {
  text-decoration: line-through;
  color: var(--muted);
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  gap: 8px;
}

/* Desktop: tampil saat hover */
.card-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}
.task-card:hover .card-actions { opacity: 1; }

/* Mobile/touch: selalu tampil */
@media (hover: none) {
  .card-actions { opacity: 1 !important; }
}

.task-card:active {
  transform: scale(0.98);
  transition: transform 0.1s;
}

.icon-btn {
  min-width: 36px; min-height: 36px;
  display: flex; align-items: center; justify-content: center;
}
@media (hover: none) {
  .icon-btn { min-width: 44px; min-height: 44px; font-size: 1rem; }
}

.task-name { font-size: 0.92rem; font-weight: 700; margin-bottom: 5px; line-height: 1.4; }
.task-desc {
  font-size: 0.78rem; color: var(--text2);
  margin-bottom: 12px; line-height: 1.5;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.card-progress { margin-bottom: 12px; }
.cp-top { display: flex; justify-content: space-between; margin-bottom: 5px; }

/* Meta: 2 sisi */
.card-meta {
  display: flex; align-items: center;
  justify-content: space-between;
  gap: 8px; flex-wrap: wrap;
  margin-top: 4px;
}
.meta-left  { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.meta-right { display: flex; align-items: center; gap: 6px; }

/* Priority pill */
.priority-pill {
  display: inline-flex; align-items: center;
  padding: 2px 8px; border-radius: 99px;
  font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
}
.priority-high { background: rgba(239,68,68,0.15); color: var(--red); }
.priority-med  { background: rgba(245,158,11,0.15); color: var(--yellow); }
.priority-low  { background: rgba(107,114,128,0.15); color: var(--muted); }

.deadline-tag {
  font-size: 0.7rem; font-weight: 600;
}
</style>
