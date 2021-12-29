<template>
  <div class="container mx-auto p-12">
		<input v-model="senderField"   placeholder="sender">
		<input v-model="receiverField" placeholder="receiver">
		<input v-model="amountField" placeholder="amount in NEAR" @change="validateAmount">
		<button class="test-button" @click="send"> Send</button>
	</div>
</template>

<script>
import axios from 'axios'
import { connect, keyStores, WalletConnection, KeyPair } from 'near-api-js'

	const extractNetworkId = (user_name) => user_name.split(".")[1];
	const isValidNetworkId = (network_id) => network_id == "testnet" || network_id == "mainnet" || network_id == "betanet";

export default {
	name: 'Test',
	beforeMount() {
		},
	mounted() {
		this.validateAmount();
	},
	data() {
		return {
			senderField: this.$router.currentRoute._value.query.sender   || "",
			receiverField: this.$router.currentRoute._value.query.receiver   || "",
			amountField: this.$router.currentRoute._value.query.amount   || "",
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
		validateAmount() {
			if (isNaN(this.amountField) || this.amountField == "" ) {
				this.amountField = "";
				return;
			}
			
			this.amountField = Math.max(this.amountField, 0)
		},
		isValidateInput(sender, receiver, amount) {

			let bool = true;

			if (!sender || !receiver || !amount) {
				console.error("isValidateInput(sender, receiver, amount): Missing parameter/s");
				bool = false;
			}

			const sender_network_id = extractNetworkId(sender);
			const receiver_network_id = extractNetworkId(receiver);  

			if (!isValidNetworkId(sender_network_id)) {
				console.error("isValidateInput(sender, receiver, amount): Invalid network id", sender_network_id);
				bool = false;
			}

			if (!isValidNetworkId(receiver_network_id)) {
				console.error("isValidNetworkId(sender, receiver, amount): Invalid network id", receiver_network_id);
				bool = false;
			}			

			if (!sender_network_id) {
				console.error("isValidNetworkId(sender, receiver, amount): sender is missing network id");
				bool = false;
			}

			if (!receiver_network_id) {
				console.error("isValidNetworkId(sender, receiver, amount): receiver is missing network id");
				bool = false;
			}

			if (sender_network_id !== receiver_network_id) {
				console.error("isValidNetworkId(sender, receiver, amount): sender and receiver must be on the same network")
				bool = false;
			}

			return bool;
		},
		async send() {

			const keyStore = new keyStores.BrowserLocalStorageKeyStore();

			const _config = {
				keyStore,
				networkId: "testnet",
				nodeUrl: "https://rpc.testnet.near.org",
			};

			async function createFullAccessKey(accountId) {
				const keyPair = KeyPair.fromRandom("ed25519");
				const publicKey = keyPair.publicKey.toString();
				const near = await connect(_config);
				const account = await near.account(accountId);
				await keyStore.setKey(_config.networkId, publicKey, keyPair);
				await account.addKey(publicKey);
			}



			const sender = this.senderField;
			const receiver = this.receiverField;
			const amount = this.amountField;

			await createFullAccessKey(sender);

			if (!this.isValidateInput(sender, receiver, amount))
				throw new Error("Invalid input");

			const networkId = extractNetworkId(sender);

			console.log(networkId)

			const config = {
				networkId,
				keyStore: new keyStores.BrowserLocalStorageKeyStore(),
				nodeUrl: `https://rpc.${networkId}.near.org`,
				walletUrl: `https://wallet.${networkId}.near.org`,
				helperUrl: `https://helper.${networkId}.near.org`,
				explorerUrl: `https://explorer.${networkId}.near.org`,
			}

			const near = await connect(config);
			const wallet = new WalletConnection(near, "wallet connection text");
			if(!wallet.isSignedIn()) {
				console.log("Not signed in");
			}
			// wallet.requestSignIn()
			const account = wallet.account().addKey();;
			let result = await account.sendMoney(receiver, amount);
			console.log("result:", result);
		}
	}
}
</script>

<style lang="scss">
.test-button {
	@apply bg-blue-400 px-4 py-2 m-4 rounded-lg text-white focus:outline-none focus-within:outline-none;
}
</style>
