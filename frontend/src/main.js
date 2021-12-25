import 'virtual:windi.css'
import * as Vue  from 'vue'
// import router from './router'
import App from './App.vue'
import * as VueRouter from 'vue-router'

const routes = [
  { path: '/', component: Home },
  { path: '/about/:mitko', component: Button },
  { path: '/login', component: Login },
]

// 3. Create the router instance and pass the `routes` option
// You can pass in additional options here, but let's
// keep it simple for now.
const router = VueRouter.createRouter({
  // 4. Provide the history implementation to use. We are using the hash history for simplicity here.
  history: VueRouter.createWebHistory(),
  routes, // short for `routes: routes`
})

// 5. Create and mount the root instance.
const app = Vue.createApp(App)
// Make sure to _use_ the router instance to make the
// whole app router-aware.
app.use(router)

app.mount('#app')