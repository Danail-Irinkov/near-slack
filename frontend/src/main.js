import 'virtual:windi.css'
import * as Vue  from 'vue'
import router from './router'
import App from './App.vue'

// 5. Create and mount the root instance.
const app = Vue.createApp(App)
// Make sure to _use_ the router instance to make the
// whole app router-aware.
app.use(router)

app.mount('#app')
