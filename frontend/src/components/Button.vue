<template>
	<button type="button" @click="redirectToHome">Click Me! {{ $route.params.mitko }} {{ msg }}</button>
</template>

<script setup>
import { defineProps, reactive  } from 'vue'
import { useRouter } from 'vue-router'

defineProps({
  msg: String
})

const state = reactive({ count: 0 })
const router = useRouter();

// console.log("app", app);

function redirectToHome() {
	router.push('/')
}

// return {
// 	redirectToHome,
// };

</script>

<style scoped>
a {
  color: #42b983;
}
</style>
