<template>
  <div>
    <apexchart
      type="bar"
      :height="chartHeight"
      :options="options"
      :series="series"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  tasks: { type: Array, default: () => [] }
})

const TOP_N = 10

const topTasks = computed(() =>
  [...props.tasks]
    .filter(t => t.status !== 'done' || t.progress < 100)
    .sort((a, b) => b.progress - a.progress)
    .slice(0, TOP_N)
)

const chartHeight = computed(() => Math.max(180, topTasks.value.length * 36 + 60))

const series = computed(() => [{
  name: 'Progress',
  data: topTasks.value.map(t => t.progress)
}])

const options = computed(() => ({
  chart: {
    type: 'bar',
    background: 'transparent',
    toolbar: { show: false },
    animations: { enabled: true, speed: 500 }
  },
  plotOptions: {
    bar: {
      horizontal: true,
      borderRadius: 4,
      barHeight: '60%',
      distributed: true,
      dataLabels: { position: 'bottom' }
    }
  },
  colors: topTasks.value.map(t => {
    if (t.progress >= 80) return '#10b981'
    if (t.progress >= 40) return '#f59e0b'
    return '#ef4444'
  }),
  dataLabels: {
    enabled: true,
    textAnchor: 'start',
    style: {
      fontSize: '11px',
      fontFamily: "'JetBrains Mono', monospace",
      fontWeight: 700,
      colors: ['#e2e8f0']
    },
    formatter: (val) => val + '%',
    offsetX: 4
  },
  xaxis: {
    categories: topTasks.value.map(t => t.name.length > 28 ? t.name.slice(0, 26) + '…' : t.name),
    min: 0, max: 100,
    labels: {
      style: {
        fontSize: '11px',
        fontFamily: "'JetBrains Mono', monospace",
        colors: '#4a5568'
      },
      formatter: (v) => v + '%'
    },
    axisBorder: { show: false },
    axisTicks:  { show: false }
  },
  yaxis: {
    labels: {
      style: {
        fontSize: '11px',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontWeight: 600,
        colors: '#94a3b8'
      },
      maxWidth: 180
    }
  },
  grid: {
    borderColor: '#1e2d45',
    xaxis: { lines: { show: true } },
    yaxis: { lines: { show: false } }
  },
  tooltip: {
    theme: 'dark',
    style: { fontSize: '12px' },
    y: { formatter: (val) => val + '%' }
  },
  legend: { show: false },
  theme: { mode: 'dark' }
}))
</script>
