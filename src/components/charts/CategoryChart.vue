<template>
  <div>
    <apexchart
      type="bar"
      height="180"
      :options="options"
      :series="series"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  catBreakdown: { type: Object, default: () => ({}) }
})

const CAT_LABELS = {
  dev: '💻 Dev', belajar: '📚 Belajar', infra: '🖥️ Infra',
  content: '📝 Content', personal: '👤 Personal', other: '📌 Lainnya'
}
const CAT_COLORS = {
  dev: '#3b82f6', belajar: '#10b981', infra: '#8b5cf6',
  content: '#ef4444', personal: '#f59e0b', other: '#4a5568'
}

const entries = computed(() =>
  Object.entries(props.catBreakdown).filter(([,v]) => v > 0)
)

const series = computed(() => [{ name: 'Task', data: entries.value.map(([,v]) => v) }])

const options = computed(() => ({
  chart: {
    type: 'bar',
    background: 'transparent',
    toolbar: { show: false },
    animations: { speed: 400 }
  },
  plotOptions: {
    bar: { borderRadius: 4, columnWidth: '55%', distributed: true }
  },
  colors: entries.value.map(([k]) => CAT_COLORS[k] || '#4a5568'),
  dataLabels: {
    enabled: true,
    style: {
      fontSize: '11px',
      fontFamily: "'JetBrains Mono', monospace",
      fontWeight: 700,
      colors: ['#fff']
    }
  },
  xaxis: {
    categories: entries.value.map(([k]) => CAT_LABELS[k] || k),
    labels: {
      style: {
        fontSize: '11px',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontWeight: 600,
        colors: '#94a3b8'
      }
    },
    axisBorder: { show: false },
    axisTicks:  { show: false }
  },
  yaxis: {
    labels: {
      style: { fontSize: '11px', colors: '#4a5568', fontFamily: "'JetBrains Mono', monospace" },
      formatter: (v) => Math.floor(v)
    }
  },
  grid: { borderColor: '#1e2d45', yaxis: { lines: { show: true } }, xaxis: { lines: { show: false } } },
  tooltip: {
    theme: 'dark',
    y: { formatter: (v) => v + ' task' }
  },
  legend: { show: false },
  theme: { mode: 'dark' }
}))
</script>
