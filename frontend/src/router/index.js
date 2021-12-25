import VueRouter from 'vue-router'
import Home from '../views/Home.vue'
import Button from '../views/Button.vue'
import Login from '../views/Login.vue'



const routes = [
	{ 
		path: '/button'		,
		name: 'Button',
		component: Button,
	},
]

const router = new VueRouter({
	routes,
})

export default router