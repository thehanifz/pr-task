import { createApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import router from './router'
import App from './App.vue'
import VueApexCharts from 'vue3-apexcharts'
import './styles/global.css'

const app = createApp(App)

const pinia = createPinia()
setActivePinia(pinia)  // aktifkan global sebelum router.beforeEach jalan
app.use(pinia)
app.use(router)
app.use(VueApexCharts)
app.mount('#app')