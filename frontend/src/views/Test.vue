<template>
  <div class="container mx-auto">
    <img class="mx-auto" alt="Vue logo" src="../assets/logo.png" />
		<div>
			<button class="test-button" @click="testLoginToken"> Test Login Token</button>
			<button class="test-button" @click="testLoginNoToken"> Test Login No Token</button>
			<button class="test-button" @click="testSlackHook"> Test Slack Hook</button>
		</div>
  </div>
</template>

<script>
import axios from 'axios'
export default {
	name: 'Test',
	data() {
		return {
			slackHookData: {
				user_name: 'procc.main',
				command: '/near',
				team_domain: 'proccmaingmai-tc79872',
				token: 'gh18PaaAfvc2I0W7SJzcPOkY',
				channel_id: 'D02RZHPUWHF',
				trigger_id: '2898159688640.2726521633969.939b92e730bde0c5050b4d579d3bf99d',
				channel_name: 'directmessage',
				api_app_id: 'A02RLUK9PFV',
				is_enterprise_install: false,
				user_id: 'U02MPHH5FC0',
				text: 'help',
				team_id: 'T02MCFBJMUH',
				response_url: 'https://hooks.slack.com/commands/T02MCFBJMUH/2867751902902/UGlFPuHJFzqWb9w3tSjvfFQU'
			}
		}
	},
	methods: {
		testLoginToken() {
			this.$router.push('/login/gh18PaaAfvc2I0W7SJzcPOkY')
		},
		testLoginNoToken() {
			this.$router.push('/login')
		},
		async testSlackHook() {
			let res = await axios.post('ads', { params: this.slackHookData})
			console.log('testSlackHook res', res)
		},
	}
}
</script>

<style lang="scss">
.test-button {
	@apply bg-blue-400 px-4 py-2 m-4 rounded-lg text-white focus:outline-none focus-within:outline-none;
}
</style>
