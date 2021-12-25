<template>
	<button type="button"
					class="near-login-button">
		Login with NEAR
	</button>
</template>

<script>
export default {
	name: 'NEARLoginButton',
}
</script>

<style scoped>
.near-login-button {
	@apply flex mx-auto  py-2 px-6 rounded-2xl
		text-white font-bold text-center leading-5
		bg-near1-400
		focus:outline-none focus-visible:outline-none
		active:bg-near1-700
		hover:bg-near1-600;
}
</style>
