<template>
	<div>
		<Button2 class="p-2 bg-blue-300" msg="pesho"></Button2>
		<button class="p-2 bg-green-300" type="button" @click="redirectToHome">Click Me! {{ $route.params.mitko }}</button>
	</div>
</template>

<script>

import Button2 from './Button.vue'

export default {
	name: 'login',
	props: {
		msg: String
	},
	components: {
		Button2
	},
	data() {
		return {
			count: 0
		};
	},
	created() {
		console.log("created", this.$route.params.mitko);
	},
	mounted() {
		console.log("mounted", this.$route.params.mitko);
	},
	methods: {
		redirectToHome() {
			this.$router.push('/')
		}
	}
	// watch: {
	// 	$route(to, from) {
	// 		console.log("to", to);
	// 		console.log("from", from);
	// 	}
	// }
}
</script> 

<style scoped>
a {
  color: #42b983;
}
</style>
