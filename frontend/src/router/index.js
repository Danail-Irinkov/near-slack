import * as VueRouter from 'vue-router'
import Home from '../views/Home.vue'
import Test from '../views/Test.vue'
import Login from '../views/Login.vue'


const routes = [
	{ path: '/', component: Home },
	{ path: '/test', component: Test },
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

export default router
