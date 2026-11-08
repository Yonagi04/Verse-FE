import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { Alert, Button, Checkbox, Empty, Input, Radio, Spin, Tag } from 'ant-design-vue'
import CostReconciliationPage from './CostReconciliationPage.vue'
import '@/assets/styles/theme.scss'
import '@/assets/styles/global.scss'
import { useThemeStore } from '@/stores/theme'

const app = createApp(CostReconciliationPage)
app.use(createPinia())
const themeStore = useThemeStore()
themeStore.initialize()
app.onUnmount(() => themeStore.dispose())
if (import.meta.hot) import.meta.hot.dispose(() => themeStore.dispose())
app.use(Alert).use(Button).use(Checkbox).use(Empty).use(Input).use(Radio).use(Spin).use(Tag)
app.mount('#app')
