<template>
		<div class="slack-layout">
			<div class="login-form">
				<a class="flex justify-center pt-8 mb-8 sm:pt-0 h-32" href="https://near.org/" target="_blank">
					<NEARLogo></NEARLogo>
				</a>
				<div class="step-token-missing" :class="{ warning: $route.query.status === 'failure'}">
					<h2 class="text-2xl leading-12 font-bold text-center">
						{{ text }}
					</h2>
					<h3 v-if="text2"
						class="text-xl leading-12 font-bold text-center">
						{{ text2 }}
					</h3>
				</div>
			</div>
		</div>
</template>

<script>
import NEARLogo from '../components/NEARLogo.vue'
export default {
	name: 'redirection',
	props: {
	},
	components: {
		NEARLogo
	},
	data() {
		return {
			text: '',
			text2: ''
		};
	},
	created() {
		if(this.$route.query.status === 'success') {
			this.text2 = 'You can go back to Slack'
			if (this.$route.query.key === 'function') {
				this.text = 'FunctionCall Access Key Activated'
				if (this.$route.query.contract_id)
					this.text += ' for '+this.$route.query.contract_id
			}
			if (this.$route.query.key === 'slack')
				this.text = 'NEAR Slack Successfully Installed'
			
			if (this.$route.query.key === 'login')
				this.text = 'Your NEAR Wallet is now connected to your Slack account'
			
		} else if (this.$route.query.status === 'failure') {
			this.text2 = 'Please, try again'
			if (this.$route.query.key === 'function')
				this.text = 'FunctionCall Access Key Failed to Activate'
			if (this.$route.query.key === 'slack')
				this.text = 'NEAR Slack Failed to install'
			if (this.$route.query.key === 'login')
				this.text = 'We failed to connect your NEAR wallet to Slack'
		}
	},
	async mounted() {
	
	},
	methods: {
	
	}
}
</script>

<style lang="scss" scoped>
a {
	color: #42b983;
}
.warning {
	color: orangered!important;
}
.slack-layout {
	@apply flex items-center justify-center min-h-screen bg-gray-100;
	border-radius: 4px;
}
.login-form {
	@apply px-8 py-6 text-left bg-white shadow-lg text-near1-900;
	margin-top: -30vh;
	
	& > div {
		@apply content-center items-center place-items-center justify-center justify-items-center
	}
}
</style>
