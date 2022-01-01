<template>
		<div class="slack-layout">
			<div class="login-form">
				<div class="step-token-missing">
					<h3 class="text-xl leading-12 font-bold text-center">
						{{ text }}
					</h3>
				</div>
			</div>
		</div>
</template>

<script>
export default {
	name: 'redirection',
	props: {
	},
	components: {
	},
	data() {
		return {
			text: ''
		};
	},
	created() {
		if(this.$route.query.status === 'success') {
			if (this.$route.query.key === 'function') {
				this.text = 'FunctionCall Access Key Activated'
				if (this.$route.query.contract_id)
					this.text += ' for '+this.$route.query.contract_id
			}
			if (this.$route.query.key === 'slack')
				this.text = 'NEAR Slack Successfully Installed'
			
		} else if (this.$route.query.status === 'failure') {
			if (this.$route.query.key === 'function')
				this.text = 'FunctionCall Access Key Failed to Activate'
			if (this.$route.query.key === 'slack')
				this.text = 'NEAR Slack Failed to install'
		}
	},
	async mounted() {
	
	},
	methods: {
	
	}
}
</script>

<style lang="scss" scoped>

</style>
