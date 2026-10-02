import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Antd from 'ant-design-vue'
import App from './App.vue'
import router from './router'
import './assets/styles/theme.scss'
import './assets/styles/global.scss'
import { useUserStore } from './stores/user'
import { useThemeStore } from './stores/theme'

const app = createApp(App)

app.use(createPinia())
const themeStore = useThemeStore()
themeStore.initialize()
app.onUnmount(() => themeStore.dispose())
if (import.meta.hot) import.meta.hot.dispose(() => themeStore.dispose())
app.use(router)
app.use(Antd)

void router.isReady().then(() => app.mount('#app'))
window.addEventListener('storage', (event) => {
  if (event.key !== 'verse_token' || event.oldValue === event.newValue) return
  useUserStore().synchronizeStorage()
  // 重新挂载私有页面，避免上一账号的组件内请求结果残留。
  if (router.currentRoute.value.meta.layout !== 'auth') window.location.reload()
  else window.dispatchEvent(new Event('verse-session-changed'))
})
