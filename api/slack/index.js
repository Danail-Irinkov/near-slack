const { InstallProvider } = require('@slack/oauth');
// const { firebaseConfig } = require('firebase-functions/v1');
const { getAuth } = require('firebase-admin/auth')
const near = require('../near')
// const near = {}

module.exports = function (db, functions) {
	// initialize the installProvider
	const installer = new InstallProvider({
		clientId: functions.config().slack.client_id,
		clientSecret: functions.config().slack.client_secret,
		stateSecret: functions.config().slack.random_encryption_string,
		// stateVerification: false,
		installationStore: {
			storeInstallation: async (installation) => {
				if (installation.isEnterpriseInstall && installation.enterprise && installation.enterprise.id) {
					return db.collection('installations').doc(installation.enterprise.id).set(installation);
				} else if (installation.team && installation.team.id) {
					return db.collection('installations').doc(installation.team.id).set(installation);
				}
				throw new Error('Failed saving installation data to installationStore');
			},
			fetchInstallation: async (installQuery) => {
				if (installQuery.isEnterpriseInstall && installQuery.enterpriseId !== undefined) {
					return await db.collection('installations').get(installQuery.enterpriseId);
				}
				if (installQuery.teamId !== undefined) {
					return await db.collection('installations').get(installQuery.teamId);
				}
				throw new Error('Failed fetching installation');
			},
			deleteInstallation: async (installQuery) => {
				if (installQuery.isEnterpriseInstall && installQuery.enterpriseId !== undefined) {
					return await db.collection('installations').delete(installQuery.enterpriseId);
				}
				if (installQuery.teamId !== undefined) {
					return await db.collection('installations').delete(installQuery.teamId);
				}
				throw new Error('Failed to delete installation');
			},
		},
	});

	async function userIsLoggedInWithNear(user_name) {
		let bool = false;

		let user = await db.collection('users').doc(user_name);
		if (user_name) bool = !!user_name.token_near;
		// TODO: check if token is valid (maybe some invalid string)
		// TODO: check if token is active (make some request to near)
		return bool
	}

// function assert(bool, err_msg) { // throw not available in functions
// 	if (!bool) return throw err_msg
// }

	async function login(payload, commands, fl) {
		try {
			// console.log('login payload', payload)
			fl.log('login token', payload.token)

			let userDoc = await db.collection('users').doc(createUserDocId(payload.user_name)).get()

			if(!userDoc.exists) {
				await createUser(payload, commands[1], db)
				userDoc = await db.collection('users').doc(createUserDocId(payload.user_name)).get()
			}

			let user = userDoc.data()
			// console.log('login user', user)

			if(user.near_account && (!commands[1] || commands[1] === user.near_account) && user.near_fn_key && !!'TODO: FN key is active') {
				return { text: 'Login Successful' }
			} else {
				// TODO: Introduce an env variable to determine routing
				// DEPRECATED LOGIN VIA FRONTEND
				// let login_url = `http://localhost:3000/login/?fb_token=${user.fb_token}`
				// let login_url = `https://near-api-1d073.firebaseapp.com/login/?fb_token=${user.fb_token}`
				// fl.log('login login_url', login_url)

				let response = {
					text: 'Connect Slack with your NEAR account',
					response_type: 'ephemeral',
					// channel: payload.channel_id,
					attachments: [
						{
							fallback: 'Connect NEAR Wallet',
							color: "#4fcae0",
							attachment_type: "default",
							actions: []
						}
					]
				}
				if (commands[1] && validateNEARAccount(commands[1])) {
					let wallet_url = await near.generateWalletLoginURL(payload.user_name, commands[1])
					response.attachments[0].actions.push({
						type: "button",
						style: "primary",
						text: "Connect NEAR Wallet",
						url: wallet_url
					})
				} else {
					let wallet_url = await near.generateWalletLoginURL(payload.user_name, 'any.near')
					let testnet_wallet_url = await near.generateWalletLoginURL(payload.user_name, 'any.testnet')
					response.attachments[0].actions.push({
						type: "button",
						style: "primary",
						text: "NEAR Wallet",
						url: wallet_url
					})
					response.attachments[0].actions.push({
						type: "button",
						style: "primary",
						text: "NEAR Testnet",
						url: testnet_wallet_url
					})
				}
				return response
			}

		} catch (e) {
			fl.log('near-cli login err: ', e)
			return Promise.reject(e)
		}
	}
	async function send(user) {
		try {
			if (userIsLoggedInWithNear(user)) return 'Please login'

			// TODO: research what send does?!?

		} catch (e) {
			console.log('near-cli send err: ', e)
			return Promise.reject(e)
		}

	}
	async function view (payload, commands, fl) {
		try {
			let user = (await db.collection('users').doc(createUserDocId(payload.user_name)).get()).data()

			let options = near.getConnectOptions(null,
				near.getNetworkFromAccount(commands[1]),
				{
					accountId: user.near_account,
					contractName: commands[1],
					methodName: commands[2],
					args: commands[3],
				})
			let result = await near.callViewFunction(options)
			console.log('SLACK view result', result)
			return commands[2]+'(): ' + stringifyResponse(result)
		} catch (e) {
			console.log('near-cli view err: ', e)
			return Promise.reject(e)
		}

	}
	async function call (payload, commands, fl) {
		try {
			// TODO: Add support for attaching deposit to call
			let user = (await db.collection('users').doc(createUserDocId(payload.user_name)).get()).data()

			if (!near.userHasActiveContractFCKey(user, commands[1])) {
				let wallet_login_url = await near.generateWalletLoginURL(payload.user_name, user.near_account, commands[1], [])
				return {
					text: 'No Function Call Access Key found for '+commands[1],
					response_type: 'ephemeral',
					attachments: [
						{
							color: '#4fcae0',
							attachment_type: 'default',
							actions: [
								{
									type: 'button',
									style: 'primary',
									text: 'Create Function-Call Key',
									url: wallet_login_url
								}
							]
						}
					]
				}
			}

			let keyStore = near.generateKeyStore(
				near.getNetworkFromAccount(user.near_account),
				user.near_account,
				near.getUserContractFCPrivateKey(user, commands[1])
			)
			let options = near.getConnectOptions(keyStore,
				near.getNetworkFromAccount(commands[1]),
				{
					accountId: user.near_account,
					contractName: commands[1],
					methodName: commands[2],
					args: commands[3],
					deposit: commands[4],
				})
			let result = await near.scheduleFunctionCall(options)
			console.log('SLACK view result', result)
			return commands[2]+'(): ' + stringifyResponse(result)
		} catch (e) {
			console.log('near-cli call err: ', e)
			return Promise.reject(e)
		}
	}

	async function account (payload, commands, fl) {
		try {
			let options = near.getConnectOptions(null,
				near.getNetworkFromAccount(commands[1]),
				{
					accountId: commands[1]
				})
			let result = await near.viewAccount(options)

			return commands[1]+': ' + stringifyResponse(result)
		} catch (e) {
			console.log('near-cli account err: ', e)
			return Promise.reject(e)
		}
	}
	async function keys (payload, commands, fl) {
		try {
			let options = near.getConnectOptions(null,
				near.getNetworkFromAccount(commands[1]),
				{
					accountId: commands[1]
				})
			let result = await near.keys(options)

			return commands[1]+' keys: ' + stringifyResponse(result)
		} catch (e) {
			console.log('near-cli keys err: ', e)
			return Promise.reject(e)
		}

	}

	async function help (commands) {
		let help = {
			text: 'Available commands:\n' +
				'login, logout, send, view, call, account, keys\n' +
				'for more details use /near help {command}',
			// "response_type": "ephemeral ",
			attachments: [
				{
					text: 'Choose a command',
					fallback: 'No command chosen',
					color: '#4fcae0',
					attachment_type: 'default',
					callback_id: 'command_help',
					actions: [
						{
							name: 'commands_list',
							text: 'Pick a command...',
							type: 'select',
							options: [
								{
									text: 'Login',
									value: 'help login'
								},
								{
									text: 'Logout',
									value: 'help logout'
								},
								{
									text: 'Send',
									value: 'help send'
								},
								{
									text: 'View',
									value: 'help view'
								},
								{
									text: 'Call',
									value: 'help call'
								},
								{
									text: 'Account',
									value: 'help account'
								},
								{
									text: 'Keys',
									value: 'help keys'
								},
							]
						},
					]
				}
			]
		}
		if (!commands[1])
			return help

		switch (commands[1]) {
			case 'login':
				help.text = 'Connect your NEAR wallet\n' +
					'/near login {?account}\n' +
				'Account is optional, if you want to change your current account\n'

				help.attachments.push({
					color: '#4fcae0',
					attachment_type: 'default',
					callback_id: 'login_from_help',
					fallback: '/near login',
					actions: [
						{
							type: 'button',
							style: 'primary',
							text: 'Connect NEAR Wallet',
							name: 'login',
							value: 'login'
						}
					]
				})
				break
			case 'logout':
				help.text = 'Disconnect your NEAR wallet\n' +
					'/near logout\n'

				help.attachments.push({
					color: '#4fcae0',
					attachment_type: 'default',
					callback_id: 'logout_from_help',
					fallback: '/near logout',
					actions: [
						{
							type: 'button',
							style: 'primary',
							text: 'Disconnect NEAR Wallet',
							name: 'logout',
							value: 'logout'
						}
					]
				})
				break
			case 'send':
				help.text = 'Transfer NEAR tokens to another account\n' +
					'/near send {your account} {to account} {amount}\n' +
					'Amount format is in NEAR tokens, for ex. 12.025\n' +
					'Note: You will need a full access key for the sending account (/near login)'
				break
			case 'view':
				help.text = 'Get result from a contract\'s View method\n' +
					'/near view {contract account} {method name} {?arguments}\n' +
					'Arguments are optional, format is JSON(no whitespace), for ex. {"user":"test_user"}\n' +
					'Note: View method call is free of charge'
				break
			case 'call':
				help.text = 'Post request to a contract\'s Change method\n' +
					'/near call {contract account} {method name} {?arguments} {?deposit}\n' +
					'Arguments are optional, format is JSON, for ex. {"user": "test_user"}\n' +
					'Deposit format is in NEAR tokens, for ex. 12.025\n' +
					'Note: Change method calls require a transaction fee (gas)\n'+
					'Your logged in account will be charged ~0.00025 NEAR per call'
				break
			case 'account':
				help.text = 'Displays the public information of a NEAR account\n' +
					'/near account {?account}\n' +
					'Note: Your logged in account will be shown, if no account is provided\n'

				help.attachments.push({
					color: '#4fcae0',
					attachment_type: 'default',
					callback_id: 'account_from_help',
					fallback: '/near account',
					actions: [
						{
							type: 'button',
							style: 'primary',
							text: 'Current Account',
							name: 'account',
							value: 'account'
						}
					]
				})
				break
			case 'keys':
				help.text = 'Displays the Keys Information of a NEAR account\n' +
					'/near keys {?account}\n' +
					'Note: Your logged in account\'s keys will be shown, if no account is provided\n'

				help.attachments.push({
					color: '#4fcae0',
					attachment_type: 'default',
					callback_id: 'keys_from_help',
					// text: 'Shortcut',
					fallback: '/near keys',
					actions: [
						{
							type: 'button',
							style: 'primary',
							text: 'Your Account\'s Keys',
							name: 'keys',
							value: 'keys'
						}
					]
				})
				break
			default:
				help.text = 'We haven\'t added "' + commands[1] + '" command yet ;)'
		}

		return help
	}
	async function hello () {
		return "Hello from near-cli";
	}

	function createUserDocId(string) {
		return string
			.replace(/\./g, '1_1')
			.replace(/#/g, '2_2')
			.replace(/\$/g, '3_3')
			.replace(/\[/g, '4_4')
			.replace(/]/g, '5_5')
	}
	global.createUserDocId = createUserDocId
	function stringifyResponse(near_res = null) {
		if (typeof near_res === 'string')
			return near_res
		else if (typeof near_res === 'object' || near_res instanceof Array)
			return JSON.stringify(near_res, null, 2)
		else if (near_res)
			return String(near_res)
		else
			return 'Success'
	}
	return {
		installer,
		login,
		send,
		view,
		call,
		account,
		keys,
		help,
		createUserDocId,
		hello,
		stringifyResponse
	}
}

async function createUser(payload, near_account, db) {
	console.log('createUser', near_account)
	const fb_token = await getAuth().createCustomToken(createUserDocId(payload.user_name))
	return db.collection('users').doc(createUserDocId(payload.user_name)).set({
		near_account: near_account,
		near_fn_key: '',
		slack_username: payload.user_name,
		slack_token: payload.token,
		team_id: payload.team_id,
		team_domain: payload.team_domain,
		api_app_id: payload.api_app_id,
		channel_name: payload.channel_name,
		response_url: payload.response_url,
		fb_token
	})
}

