<template>
  <div :class="['task-card card card-hover', `status-${task.status}`]" @click="$emit('click', task)">
    <!-- Top row -->
    <div class="card-top">
      <span :class="['badge', CAT_BADGE[task.cat] || 'cat-other']">{{ CAT_LABELS[task.cat] || task.cat }}</span>
      <div class="card-actions" @click.stop>
        <button class="icon-btn" title="Edit" @click="$emit('edit', task)">✏️</button>
        <button class="icon-btn danger" title="Hapus" @click="$emit('delete', task)">🗑️</button>
      </div>
    </div>

    <!-- Name & desc -->
    <div class="task-name">{{ task.name }}</div>
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
      <span class="meta-item">
        <span :class="['dot', PRIORITY_DOT[task.priority]]" />
        {{ PRIORITY_LABELS[task.priority] }}
      </span>
      <span :class="['badge', STATUS_BADGE[task.status]]" style="font-size:0.62rem">
        {{ STATUS_LABELS[task.status] }}
      </span>
      <span v-if="deadlineBadgeInfo && task.status !== 'done'" class="meta-item" :style="{ color: dlColor }">
        📅 {{ deadlineBadgeInfo.text }}
      </span>
      <span v-if="task.start" class="meta-item mono" style="font-size:0.68rem;color:var(--text2)">
        🗓 {{ task.start }}
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

const fillClass       = computed(() => progressFillClass(props.task.progress))
const pctColor        = computed(() => props.task.progress >= 80 ? 'var(--green)' : props.task.progress >= 40 ? 'var(--yellow)' : 'var(--red)')
const diff            = computed(() => deadlineDiff(props.task.target))
const deadlineBadgeInfo = computed(() => deadlineBadge(diff.value))
const dlColor         = computed(() => {
  const d = diff.value
  if (d === null) return ''
  if (d < 0 || d === 0) return 'var(--red)'
  if (d <= 3)           return 'var(--yellow)'
  return 'var(--text2)'
})
</script>

<style scoped>
.task-card { cursor: pointer; }
.task-card.status-done { opacity: 0.65; }

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  gap: 8px;
}
.card-actions { display: flex; gap: 4px; opacity: 0; transition: opacity 0.15s; }
.task-card:hover .card-actions { opacity: 1; }

.task-name { font-size: 0.92rem; font-weight: 700; margin-bottom: 5px; line-height: 1.4; }
.task-desc {
  font-size: 0.78rem; color: var(--text2);
  margin-bottom: 12px; line-height: 1.5;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.card-progress { margin-bottom: 12px; }
.cp-top { display: flex; justify-content: space-between; margin-bottom: 5px; }

.card-meta {
  display: flex; align-items: center;
  gap: 8px; flex-wrap: wrap;
}
.meta-item {
  display: flex; align-items: center; gap: 4px;
  font-size: 0.7rem; color: var(--text2);
}
</style>
