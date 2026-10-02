import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Antd from 'ant-design-vue'
import App from './App.vue'
import router from './router'
import './assets/styles/global.scss'
import { useUserStore } from './stores/user'

const app = createApp(App)

app.use(createPinia())
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
