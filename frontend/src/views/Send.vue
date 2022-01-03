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
import { connect, keyStores, WalletConnection, KeyPair, utils, transactions, PublicKey } from 'near-api-js'

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

				// const senderId   = commands[1];
			const senderId   = "maix.testnet";
			// const receiverId = commands[2];
			const receiverId = "maix2.testnet";
			// const amount 		 = utils.parseNearAmount(commands[3]);
			const amount 		 = utils.format.parseNearAmount("12.2");

			const senderIdNet = senderId.split('.').pop();
			const receiverIdNet = senderId.split('.').pop();

			// Error checking but not implemented yet, there is a corner case with dev accounts where they don't have a .testnet at the end
			// if ( senderIdNet !== 'testnet' && senderIdNet !== 'near' ) {

			// if (senderIdNet !== receiverIdNet) {
			// 	payload.text = `Sender and receiver must be in the same NEAR network`
			// 	return payload
			// }

			const config = { ...{
            networkId: 'testnet',
            nodeUrl: 'https://rpc.testnet.near.org',
            walletUrl: 'https://wallet.testnet.near.org',
            helperUrl: 'https://helper.testnet.near.org',
            helperAccount: 'testnet',
            explorerUrl: 'https://explorer.testnet.near.org',
        }, ...{keyStore: new keyStores.InMemoryKeyStore()}};
			const near = await connect(config);
			const account = await near.account(senderId);
			const wallet = new WalletConnection(near)
			// We don't need a fullAccessKey to create a transaction, but we need to provide one anyway
			let key = (await account.getAccessKeys())
				.filter(key => key.access_key.permission === 'FullAccess')[0]; 

			// if (key === undefined) { 
			// 	payload.text = `${senderId} doens't have any full access keys. Cannot send near.`;
			// 	return payload;
			// }


			key = utils.key_pair.PublicKey.from(key.public_key);
			
			const action = transactions.transfer(amount);
			// It seems that nonce and block hash can be random values
			const nonce = 7560000005;
			const blockHash = [...new Uint8Array(32)].map( _ => Math.floor(Math.random() * 256));
			const transaction = transactions.createTransaction(senderId, key, receiverId, 7560000005, [action], blockHash);

			// const transactionSerialized = serialize(near.transaction.SCHEMA, transaction);
			// const serchParam = Buffer.from(transactionSerialized).toString('base64');

			// const meta = 'my_meta_data';
			// const callbackURL = 'maix.xyz'

			// const url = ""
			wallet.requestSignTransactions({
				transactions: [transaction],
				callbackUrl: "maix.xyz",
				meta: "metaparams",
			});
			// TODO: research what send does?!?

			// const keyStore = new keyStores.BrowserLocalStorageKeyStore();

			// const _config = {
			// 	keyStore,
			// 	networkId: "testnet",
			// 	nodeUrl: "https://rpc.testnet.near.org",
			// };

			// async function createFullAccessKey(accountId) {
			// 	const keyPair = KeyPair.fromRandom("ed25519");
			// 	const publicKey = keyPair.publicKey.toString();
			// 	const near = await connect(_config);
			// 	const account = await near.account(accountId);
			// 	await keyStore.setKey(_config.networkId, publicKey, keyPair);
			// 	await account.addKey(publicKey);
			// }



			// const sender = this.senderField;
			// const receiver = this.receiverField;
			// const amount = this.amountField;

			// await createFullAccessKey(sender);

			// if (!this.isValidateInput(sender, receiver, amount))
			// 	throw new Error("Invalid input");

			// const networkId = extractNetworkId(sender);

			// console.log(networkId)

			// const config = {
			// 	networkId,
			// 	keyStore: new keyStores.BrowserLocalStorageKeyStore(),
			// 	nodeUrl: `https://rpc.${networkId}.near.org`,
			// 	walletUrl: `https://wallet.${networkId}.near.org`,
			// 	helperUrl: `https://helper.${networkId}.near.org`,
			// 	explorerUrl: `https://explorer.${networkId}.near.org`,
			// }

			// const near = await connect(config);
			// const wallet = new WalletConnection(near, "wallet connection text");
			// if(!wallet.isSignedIn()) {
			// 	console.log("Not signed in");
			// }
			// // wallet.requestSignIn()
			// const account = wallet.account().addKey();;
			// let result = await account.sendMoney(receiver, amount);
			// console.log("result:", result);
		}
	}
}
</script>

<style lang="scss">
.test-button {
	@apply bg-blue-400 px-4 py-2 m-4 rounded-lg text-white focus:outline-none focus-within:outline-none;
}
</style>
