<template>
  <div class="chart-wrap">
    <apexchart
      type="donut"
      :height="height"
      :options="options"
      :series="series"
    />
    <div v-if="!hasData" class="chart-empty">
      <span>📊</span>
      <p>Belum ada data</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  statusBreakdown: { type: Object, default: () => ({}) },
  height: { type: Number, default: 220 }
})

const LABELS = ['Belum Mulai', 'Sedang Jalan', 'Selesai', 'Ditunda']
const COLORS = ['#4a5568', '#3b82f6', '#10b981', '#8b5cf6']

const series = computed(() => [
  props.statusBreakdown.todo     || 0,
  props.statusBreakdown.progress || 0,
  props.statusBreakdown.done     || 0,
  props.statusBreakdown.paused   || 0
])

const hasData = computed(() => series.value.some(v => v > 0))

const options = computed(() => ({
  chart: {
    background: 'transparent',
    toolbar: { show: false },
    animations: { enabled: true, speed: 500 }
  },
  labels: LABELS,
  colors: COLORS,
  dataLabels: {
    enabled: true,
    formatter: (val) => Math.round(val) + '%',
    style: {
      fontSize: '11px',
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      fontWeight: 700,
      colors: ['#fff']
    },
    dropShadow: { enabled: false }
  },
  stroke: { width: 2, colors: ['#111827'] },
  plotOptions: {
    pie: {
      donut: {
        size: '65%',
        labels: {
          show: true,
          total: {
            show: true,
            label: 'Total',
            fontSize: '13px',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontWeight: 700,
            color: '#94a3b8',
            formatter: (w) => w.globals.seriesTotals.reduce((a, b) => a + b, 0)
          },
          value: {
            fontSize: '22px',
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 800,
            color: '#e2e8f0',
            offsetY: 4
          }
        }
      }
    }
  },
  legend: {
    position: 'bottom',
    fontSize: '12px',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontWeight: 600,
    labels: { colors: '#94a3b8' },
    markers: { width: 10, height: 10, radius: 3 },
    itemMargin: { horizontal: 10 }
  },
  tooltip: {
    theme: 'dark',
    style: { fontSize: '12px', fontFamily: "'Plus Jakarta Sans', sans-serif" },
    y: { formatter: (val) => val + ' task' }
  },
  theme: { mode: 'dark' }
}))
</script>

<style scoped>
.chart-wrap { position: relative; }
.chart-empty {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  color: var(--muted); font-size: 0.8rem;
  gap: 6px; pointer-events: none;
}
.chart-empty span { font-size: 1.8rem; opacity: 0.4; }
</style>
