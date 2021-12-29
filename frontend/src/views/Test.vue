<template>
  <div class="container mx-auto p-12">
    <img class="mx-auto" alt="Vue logo" src="../assets/logo.png" />
		<div>
			<button class="test-button" @click="testLoginToken"> Test Login Token</button>
			<button class="test-button" @click="testLoginNoToken"> Test Login No Token</button>
			<button class="test-button" @click="testSlackHook('help')"> Test Slack Hook Help</button>
			<button class="test-button" @click="testSlackHook('login')"> Test Slack Hook Login</button>
			<button class="test-button" @click="testSlackHook('view')"> Test Slack Hook View</button>
			<button class="test-button" @click="testSlackHook('send')"> Test Slack Hook Send</button>
		</div>
		<div v-if="slackChat.length"
			class="w-full rounded-lg border-2 border-gray-700 bg-gray-300 text-white">
			<a v-for="line of slackChat"
				 class="block overflow-hidden whitespace-nowrap"
				 :class="{'no-underline hover:underline cursor-pointer': !!extractURL(line)}"
				 :href="extractURL(line)" target="_blank">
				{{ line }}
			</a>
		</div>
  </div>
</template>

<script>
import axios from 'axios'
export default {
	name: 'Test',
	data() {
		return {
			slackChat: [],
			slackHookData: {
				user_name: 'procc.main2',
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
		async testSlackHook(command = "") {

			let slackData = {...this.slackHookData};

			switch (command) {
				case "help":
					slackData.text = "help";
					break;
				case "login":
					slackData.text = "login maix.testnet";
					break;
				case "view":
					slackData.text = "view devtest.testnet whoSaidHi";
					break;
				default:
					console.error("No command specified")
			}

			// console.log("slackData.text", slackData.token)

			let res = await axios.post('http://localhost:5001/near-api-1d073/us-central1/slackHook', slackData)
			
			console.log(`testSlackHook ${command}: `, res)
			
			if(res.data)
				this.slackChat.push(res.data)
		},
		extractURL(string){
			console.log('extractURL string', string)
			let testUrl = string.match(/(?:(?:https?|ftp|file):\/\/|www\.|ftp\.)(?:\([-A-Z0-9+&@#\/%=~_|$?!:,.]*\)|[-A-Z0-9+&@#\/%=~_|$?!:,.])*(?:\([-A-Z0-9+&@#\/%=~_|$?!:,.]*\)|[A-Z0-9+&@#\/%=~_|$])/igm)
			console.log('extractURL', testUrl)

			return testUrl ? testUrl[0] : '#';
		}
	}
}
</script>

<style lang="scss">
.test-button {
	@apply bg-blue-400 px-4 py-2 m-4 rounded-lg text-white focus:outline-none focus-within:outline-none;
}
</style>
