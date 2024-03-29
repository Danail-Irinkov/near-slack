const { InstallProvider } = require('@slack/oauth');
const { createHmac } = require('crypto');
const tsscmp = require('tsscmp');
const { getAuth } = require('firebase-admin/auth');
const near = require('../near');
const {utils} = require('near-api-js')

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

	function validateRequest (req) {
		try {
			// console.warn('REQUEST VALIDATED validateRequest Start')
			console.time('validateRequest')
			// fl.log('Headers', req.headers)
			let bool = false
			let timestamp =  Number(req.headers['x-slack-request-timestamp'])
			let slack_signature = req.headers['x-slack-signature']
			if (Number.isNaN(timestamp)) {
				console.warn('x-slack-request-timestamp is not a Number: ', timestamp)
				throw new Error(
					`Header x-slack-request-timestamp did not have the expected type (${typeof timestamp})`,
				);
			}
			// console.warn('time compare', Math.round(Date.now()/1000), timestamp)
			if (Math.abs(Math.round(Date.now()/1000) - timestamp) < 60 * 5) {
				const [signatureVersion, signatureHash] = slack_signature.split('=');
				// Only handle known versions
				if (signatureVersion !== 'v0') {
					console.warn('Unknown signature version: ', signatureVersion)
					throw new Error(`Unknown signature version`);
				}

				// Compute our own signature hash
				const hmac = createHmac('sha256', functions.config().slack.signing_secret);
				hmac.update(`${signatureVersion}:${timestamp}:${req.rawBody.toString()}`);
				let my_signature = hmac.digest('hex');
				if (my_signature.indexOf('v0=') !== 0)
					my_signature = 'v0=' + my_signature

				if (tsscmp(slack_signature, my_signature)) {
					bool = true
				} else {
					console.warn('tsscmp(slack_signature, my_signature)', tsscmp(slack_signature, my_signature))
					console.warn('slack_signature: ', slack_signature)
					console.warn('my_signature: ', my_signature)
				}
			}
			// console.warn('REQUEST VALIDATED', bool)
			console.timeEnd('validateRequest')
			return bool
		} catch (e) {
			fl.log('slack-cli validateRequest err: ', e)
			console.timeEnd('validateRequest')
			return Promise.reject(e)
		}
	}
	async function create (payload, commands) {
		try {
			return {
				text: 'The best and ONLY secure method to create a NEAR account is on our official website',
				response_type: 'ephemeral',
				attachments: [
					{
						fallback: 'Choose to create \'Live\' or \'Testnet\' Wallet',
						color: "#4fcae0",
						attachment_type: "default",
						actions: [
							{
								type: "button",
								style: "primary",
								text: "NEAR Wallet",
								url: 'https://wallet.near.org/create'
							},
							{
								type: "button",
								style: "primary",
								text: "Testnet Wallet",
								url: 'https://wallet.testnet.near.org/create'
							}
						]
					}
				]
			}
		} catch (e) {
			fl.log('slack-cli create err: ', e)
			return Promise.reject(e)
		}
	}

	async function login(payload, commands) {
		try {
			// console.log('login payload', payload)
			fl.log('login token', payload.token)
			fl.log('login payload', payload)

			let userDoc = await db.collection('users').doc(createUserDocId(payload.user_name)).get()

			if(!userDoc.exists) {
				await createUser(payload, commands[1], db)
				userDoc = await db.collection('users').doc(createUserDocId(payload.user_name)).get()
			}

			let user = userDoc.data()
			// console.log('login user', user)

			if(user.near_account && (!commands[1] || commands[1] === user.near_account) && user.near_fn_key && !!'TODO: FN key is active') {
				return { text: 'Logged in as: ' + user.near_account }
			} else {
				// TODO: Introduce an env variable to determine routing
				// DEPRECATED LOGIN VIA FRONTEND
				// let login_url = `http://localhost:3000/login/?fb_token=${user.fb_token}`
				// let login_url = `https://near-api-1d073.firebaseapp.com/login/?fb_token=${user.fb_token}`
				// fl.log('login login_url', login_url)

				let response = {
					text: 'Connect Slack with your NEAR account',
					replace_original: true,
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
					let wallet_url = await near.generateWalletLoginURL('login', payload, commands[1])
					response.attachments[0].actions.push({
						type: "button",
						style: "primary",
						text: "Connect NEAR Wallet",
						url: wallet_url
					})
				} else {
					let wallet_url = await near.generateWalletLoginURL('login', payload, 'any.near')
					let testnet_wallet_url = await near.generateWalletLoginURL('login', payload, 'any.testnet')
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
			fl.log('slack-cli login err: ', e)
			return Promise.reject(e)
		}
	}

	/**
	 * Returns link near wallet to confirm transaction
	 * commands[0] = 'send'
	 * commands[1] = senderId
	 * commands[2] = receiverId
	 * commands[4] = amount in Ⓝ Near (1Ⓝ = 1 * 10^24 yoctoNear)
	 * */
	async function send(payload, commands) {
		try {
			let response

			if (near.getNetworkFromAccount(commands[1]) !== near.getNetworkFromAccount(commands[2])) {
				response = 'Mismatching sender/receiver Network'
			} else {
				let options = near.getConnectOptions(null,
					near.getNetworkFromAccount(commands[1]),
					{
						accountId: commands[1],
						receiverId: commands[2],
						amount: commands[3]
					})

				const transaction = await near.generateTransaction(options)

				let response_context = {
					slack_username: payload.user_name,
					channel_id: payload.channel_id,
					team_domain: payload.team_domain,
					response_url: payload.response_url,
					text: payload.text,
					receiverId: commands[2],
					amount: commands[3],
				}
				const url = await near.generateSignTransactionURL(options, transaction, response_context)
				response = {
					text: 'Press the button to complete the NEAR transaction',
					response_type: 'ephemeral',
					attachments: [
						{
							fallback: 'Sign Transaction',
							color: "#4fcae0",
							attachment_type: "default",
							actions: [
								{
									type: "button",
									style: "primary",
									text: "Sign Transaction",
									url: url
								}
							]
						}
					]
				}
			}
			return response
		} catch (e) {
			fl.log('slack-cli send err: ', e)
			return Promise.reject(e)
		}
	}
	function getCallInteractiveInput(payload, commands) {
		return {
			response_type: 'ephemeral',
			replace_original: true,
			blocks: [
				{
					type: 'section',
					text: {
						type: 'mrkdwn',
						text: 'Do you want to add arguments or deposit?'
					}
				},
				{
					type: 'input',
					block_id: 'call_arguments',
					element: {
						type: 'plain_text_input',
						action_id: "plain_input_arguments",
						placeholder: {
							type: "plain_text",
							text: '{"argument1": "value1", ...}'
						}
					},
					label: {
						type: 'plain_text',
						text: 'Arguments (JSON)',
						emoji: false
					}
				},
				{
					type: 'input',
					block_id: 'call_deposit',
					element: {
						type: 'plain_text_input',
						action_id: "plain_input_deposit",
						placeholder: {
							type: "plain_text",
							text: '0'
						}
					},
					label: {
						type: 'plain_text',
						text: 'Deposit',
						emoji: false
					}
				},
				{
					type: 'actions',
					elements: [
						{
							type: 'button',
							text: {
								type: 'plain_text',
								emoji: true,
								text: 'Add'
							},
							style: 'primary',
							value: `call ${commands[1]} sayHi add`
						},
						{
							type: 'button',
							text: {
								type: 'plain_text',
								emoji: true,
								text: 'Skip'
							},
							value: `call ${commands[1]} sayHi skip`
						},
						{
							type: 'button',
							text: {
								type: 'plain_text',
								emoji: true,
								text: 'Cancel'
							},
							style: 'danger',
							value: `call ${commands[1]} sayHi cancel`
						}
					]
				}
			]
		}
	}
	function notLoggedInResponse(payload, commands) {
		return {
			text: 'You are not logged in. Try /near login',
			attachments: [
				{
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
				}
			]
		}
	}
	async function functionCallWithDeposit(payload, commands) {
		try {
			let response
			let user = (await db.collection('users').doc(createUserDocId(payload.user_name)).get()).data()

			if (!user.near_account) {
				response = notLoggedInResponse()
			} else if (near.getNetworkFromAccount(user.near_account) !== near.getNetworkFromAccount(commands[1])) {
				response = 'Mismatching sender/receiver Network'
			} else {

				let options = near.getConnectOptions(null,
					near.getNetworkFromAccount(user.near_account),
					{
						accountId: user.near_account,
						receiverId: commands[1],
						methodName: commands[2],
						args: commands[3],
						deposit: commands[4]
					})

				const transaction = await near.generateTransaction(options, 'function')

				let response_context = {
					slack_username: payload.user_name,
					channel_id: payload.channel_id,
					team_domain: payload.team_domain,
					response_url: payload.response_url,
					accountId: user.near_account,
					receiverId: commands[1],
					methodName: commands[2],
					amount: commands[4]
				}
				const url = await near.generateSignTransactionURL(options, transaction, response_context)
				fl.log('functionCallWithDeposit url: ', url)
				response = {
					text: 'Contract calls with deposit require your signature',
					response_type: 'ephemeral',
					attachments: [
						{
							fallback: 'Sign Transaction',
							color: "#4fcae0",
							attachment_type: "default",
							actions: [
								{
									type: "button",
									style: "primary",
									text: "Sign Transaction",
									url: url
								}
							]
						}
					]
				}
			}
			return response
		} catch (e) {
			fl.log('functionCallWithDeposit err: ', e)
			return Promise.reject(e)
		}

	}
	async function view (payload, commands) {
		try {
			let user = (await db.collection('users').doc(createUserDocId(payload.user_name)).get()).data()
			if (!user.near_account)
				return Promise.reject(notLoggedInResponse())

			let options = near.getConnectOptions(null,
				near.getNetworkFromAccount(commands[1]),
				{
					accountId: user.near_account,
					contractName: commands[1],
					methodName: commands[2],
					args: commands[3],
				})
			let result = await near.callViewFunction(options)
			return commands[2]+'(): ' + stringifyResponse(result)
		} catch (e) {
			fl.log('slack-cli view err1: ', e)
			return Promise.reject('You are most probably calling a Contract Change method with view, try /near call')
		}

	}
	async function call (payload, commands) {
		try {
			fl.log(payload, 'call payload')
			fl.log(commands, 'call commands')
			// TODO: Add support for attaching deposit to call
			let user = (await db.collection('users').doc(createUserDocId(payload.user_name)).get()).data()

			if (!user.near_account)
				return Promise.reject(notLoggedInResponse())

			fl.log(commands, 'call commands2')
			if (!near.userHasActiveContractFCKey(user, commands[1])) {
				fl.log(commands, 'call commands3')
				return await handleMissingContractFCKey(payload, user, commands)
			}

			let keyStore = await near.generateKeyStore(
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
			fl.log('SLACK call options', options)
			let result
			if (payload.mock_near_request)
				result = 'This Function Call Result is Mocked'
			else
				result = await near.scheduleFunctionCall(options)

			fl.log('SLACK call result2', result)
			return {
				text: commands[2]+'(): ' + stringifyResponse(result)
			}
		} catch (e) {
			fl.log('slack-cli call err: ', e)
			return Promise.reject(e)
		}
	}

	async function account (payload, commands) {
		try {
			let options = near.getConnectOptions(null,
				near.getNetworkFromAccount(commands[1]),
				{
					accountId: commands[1]
				})
			let result = await near.account(options)

			return commands[1]+': ' + stringifyResponse(result)
		} catch (e) {
			fl.log('slack-cli account err: ', e)
			return Promise.reject(e)
		}
	}

	async function balance (payload, commands) {
		try {
			let options = near.getConnectOptions(null,
				near.getNetworkFromAccount(commands[1]),
				{
					accountId: commands[1]
				})
			let result = await near.balance(options)

			return commands[1]+': ' + stringifyResponse(result)
		} catch (e) {
			fl.log('slack-cli balance err: ', e)
			return Promise.reject(e)
		}
	}

	async function contract (payload, commands) {
		try {
			let options = near.getConnectOptions(null,
				near.getNetworkFromAccount(commands[1]),
				{
					accountId: commands[1]
				})
			let contract = await near.viewContract(options)
				.catch((e) => {
					if(e.toString().indexOf('has never been observed on the node') !== -1) {
						return null
					} else
						return Promise.reject(e)
				})
			if (contract && contract.methodNames) {
				let methods = removeDuplicatedMethods(contract.methodNames)
				let probableInterfaces = contract.probableInterfaces

				let text = `Contract methods for ${commands[1]}:\n`
				if (probableInterfaces && probableInterfaces.length)
					text = `Probable Interfaces: ${JSON.stringify(probableInterfaces, null, 2)}`
				let select_options = []

				for (let method of methods) {
					select_options.push({
						text: method,
						value: `call ${commands[1]} ${method}`
					})
				}

				return {
					text: text,
					// "response_type": "ephemeral ",
					attachments: [
						{
							text: 'Choose a method',
							fallback: 'No command chosen',
							color: '#4fcae0',
							attachment_type: 'default',
							callback_id: 'command_help',
							actions: [
								{
									name: 'methods_list',
									text: 'Pick a method...',
									type: 'select',
									options: select_options
								},
							]
						}
					]
				}
			} else
				return {
					text: `'${commands[1]}' doesn't have a contract deployed`,
				}
		} catch (e) {
			console.log('slack-cli contract err: ', e)
			return Promise.reject(e)
		}
	}
	async function keys (payload, commands) {
		try {
			let options = near.getConnectOptions(null,
				near.getNetworkFromAccount(commands[1]),
				{
					accountId: commands[1]
				})
			let result = await near.keys(options)

			return commands[1]+' keys: ' + stringifyResponse(result)
		} catch (e) {
			console.log('slack-cli keys err: ', e)
			return Promise.reject(e)
		}

	}

	async function help (payload, commands) {
		let userDoc = await db.collection('users').doc(createUserDocId(payload.user_name)).get()

		let novice_text = ''
		if(!userDoc.exists) {
			novice_text = 'If you are New to NEAR\n' +
				'learn more about NEAR @ https://near.org/\n' +
				'and create your account with /near create\n\n'
		}

		let help = {
			text: novice_text + 'Available commands:\n' +
				'login, contract, send, view, call, account, ...\n' +
				'for more details use /near help {command}',
			response_type: 'ephemeral',
			// response_type: 'in_channel',
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
									text: 'Create',
									value: 'help create'
								},
								{
									text: 'Login',
									value: 'help login'
								},
								{
									text: 'Logout',
									value: 'help logout'
								},
								{
									text: 'Contract',
									value: 'help contract'
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
									text: 'Balance',
									value: 'help balance'
								},
								{
									text: 'Transactions',
									value: 'help transactions'
								},
								{
									text: 'Keys',
									value: 'help keys'
								},
								{
									text: 'Delete Personal Data',
									value: 'help delete personal data'
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
			case 'create':
				help.text = 'Get a New NEAR wallet\n' +
					'/near create\n'

				help.attachments.push({
					color: '#4fcae0',
					attachment_type: 'default',
					callback_id: 'create_from_help',
					fallback: '/near create',
					actions: [
						{
							type: 'button',
							style: 'primary',
							text: 'Connect NEAR Wallet',
							name: 'create',
							value: 'create'
						}
					]
				})
				break
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
			case 'contract':
				help.text = 'Checks available methods on a NEAR contract\n' +
					'/near contract {?account}\n' +
					'Note: Your logged in account will be shown, if no account is provided\n'

				help.attachments.push({
					color: '#4fcae0',
					attachment_type: 'default',
					callback_id: 'contract_from_help',
					fallback: '/near contract',
					actions: [
						{
							type: 'button',
							style: 'primary',
							text: 'Current Contract',
							name: 'contract',
							value: 'contract'
						}
					]
				})
				break
			case 'send':
				help.text = 'Transfer NEAR tokens to another account\n' +
					'/near send {to account} {amount}\n' +
					'Amount format is in NEAR tokens, for ex. 12.025\n' +
					'Note: The transaction will be issued from your current logged in NEAR account'
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
			case 'balance':
				help.text = 'Displays the token balance of a NEAR account\n' +
					'/near balance {?account}\n' +
					'Note: Your logged in account will be shown, if no account is provided\n'

				help.attachments.push({
					color: '#4fcae0',
					attachment_type: 'default',
					callback_id: 'balance_from_help',
					fallback: '/near balance',
					actions: [
						{
							type: 'button',
							style: 'primary',
							text: 'Current Account',
							name: 'balance',
							value: 'balance'
						}
					]
				})
				break
			case 'transactions':
				help.text = 'Displays the transactions of a NEAR account\n' +
					'/near transactions {?account} {?offset}\n' +
					'Offset: The amount of transactions to skip\n'
					'Note: Your logged in account will be shown, if no account is provided\n'

				help.attachments.push({
					color: '#4fcae0',
					attachment_type: 'default',
					callback_id: 'transactions_from_help',
					fallback: '/near transactions',
					actions: [
						{
							type: 'button',
							style: 'primary',
							text: 'Current Account',
							name: 'transactions',
							value: 'transactions'
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
			case 'delete':
				help.text = 'This command is used to delete your personal Data and configuration for the NEAR-Slack Integration.\n' +
					'/near delete personal data\n' +
					'Note: This will Not affect your Data in the NEAR Network or Slack\n'

				help.attachments.push({
					color: '#4fcae0',
					attachment_type: 'default',
					callback_id: 'delete_from_help',
					// text: 'Shortcut',
					fallback: '/near delete',
					actions: [
						{
							type: 'button',
							style: 'danger',
							text: 'Delete Account',
							name: 'delete',
							value: 'delete personal data'
						}
					]
				})
				break
			default:
				help.text = 'We haven\'t added "' + commands[1] + '" command yet ;)'
		}
		if (!commands[1]){
			help.channel = payload.channel_id
		} else {
			help.response_type = 'ephemeral'
			help.attachments[0].callback_id = 'command_help_'+commands[1]
		}
		return help
	}

	async function getDeletionResponse (payload, commands) {
		try {
			let response
			if (commands[1] === 'personal' && commands[2] === 'data' && !commands[3])
				response = {
					text: 'WARNING! If you continue you will lose your NEAR-Slack configuration',
					response_type: 'ephemeral',
					attachments: [
						{
							fallback: 'Delete my configuration',
							color: "#4fcae0",
							callback_id: "delete_data1",
							attachment_type: "default",
							actions: [
								{
									type: "button",
									style: "danger",
									text: "Delete My Data",
									name: 'delete_my_data',
									value: 'delete personal data check'
								}
							]
						}
					]
				}
			else if (commands[1] === 'personal' && commands[2] === 'data' && commands[3] === 'check')
				response = {
					text: 'LAST WARNING! Are you Sure?',
					response_type: 'ephemeral',
					attachments: [
						{
							fallback: 'Your Confirmation!',
							color: "#4fcae0",
							callback_id: "delete_data2",
							attachment_type: "default",
							actions: [
								{
									type: "button",
									style: "danger",
									text: "Yes, Delete!",
									name: 'yes_delete_my_data',
									value: 'delete personal data force'
								}
							]
						}
					]
				}
			else if (commands[1] === 'personal' && commands[2] === 'data' && commands[3] === 'force') {
				// DELETING USER DATA
				await db.collection('users').doc(createUserDocId(payload.user_name)).delete()
				response = {
					text: 'Sorry to see you go...',
					response_type: 'ephemeral'
				}
			}
			return response
		} catch (e) {
			console.log('slack-cli getDeletionResponse err: ', e)
			return Promise.reject(e)
		}
	}

	/**
	 * commands[1] = accountId
	 */
	async function transactions (payload, commands) {
		try {
			const accountId = commands[1];
			const offset = Number(commands[2]) || 0;
			const options = near.getConnectOptions(
				null,
				near.getNetworkFromAccount(accountId),
				{accountId, offset}
			);
			console.time('queryTransactions')

			// EXCEPTION TO AVOID QUERYING THE MAINENT INDEXER DUE TO LOW AVAILABILITY
			if (near.getNetworkFromAccount(accountId) === 'near') {
				return { text: 'Mainnet Indexer is currently overloaded...' }
			}

			const response = await near.queryTransactions(options);
			console.timeEnd('queryTransactions')

			// {signer_account_id, r.eceiver_account_id, action_kind, args}
			const actions_kinds_to_response = {
				"ADD_KEY": (row) => `New key added for ${row.receiver_account_id}`,
				"CREATE_ACCOUNT": (row) => `New account created: ${row.receiver_account_id}`,
				"DELETE_ACCOUNT": (row) => `TODO`,
				"DELETE_KEY": (row) => `TODO`,
				"DEPLOY_CONTRACT": (row) => `Contract deployed: ${row.receiver_account_id}`,
				"FUNCTION_CALL": (row) => `Called method: ${row.args.method_name}@${row.receiver_account_id}${ Number(row.args.deposit) > 0 ? `, Deposit ${utils.format.formatNearAmount(row.args.deposit)}N` : ''}`,
				"STAKE": (row) => `TODO`,
				"TRANSFER": (row) => `Transferred ${utils.format.formatNearAmount(row.args.deposit)}N to: ${row.receiver_account_id}`,
			};

			let blocks = [{
				type: 'header',
				text: {
					text: `Transactions: ${offset} to ${offset + 5}`,
					type: 'plain_text'
				}
			}];

			for (const row of response.rows) {
				const action_kind = row.action_kind;
				let date = new Date(row.block_timestamp/1000000).toLocaleDateString("en-UK", { day: '2-digit', month: '2-digit', year: '2-digit' })
				const text = `[${date}] ` + actions_kinds_to_response[action_kind](row);
				blocks.push({
					type: 'section',
					text: {
						text: text,
						type: 'mrkdwn'
					},
					accessory: {
						type: 'button',
						text: {
							type: 'plain_text',
							emoji: true,
							text: 'Details'
						},
						url: `https://explorer.testnet.near.org/transactions/${row.transaction_hash}`
					}
				});
			}

			let pagination = {
				type: 'actions',
				elements: [
					{
						type: 'button',
						text: {
							type: 'plain_text',
							emoji: true,
							text: '🡨  Back'
						},
						value: `transactions ${accountId} ${offset - 5}`
					},
				]
			}
			let next_btn = {
				type: 'button',
				text: {
					type: 'plain_text',
					emoji: true,
					text: 'Next  🡪'
				},
				value: `transactions ${accountId} ${offset + 5}`
			}

			if (offset <5) {
				pagination.elements = [next_btn]
			} else {
				pagination.elements.push(next_btn)
			}

			blocks.push(pagination)
			// const blocks = response.rows.map((row) => {
			// 	const action_response_text = actions_kinds_to_response[row.action_kind];
			// 	if (!action_response_text) throw new Error(`Unknown action_kind: ${row.action_kind}`);
			// 	return create_block(action_response_text(row), row.transaction_hash);
			// });

			return {
				response_type: 'ephemeral',
				replace_original: true,
				blocks
			};
		} catch (e) {
			console.log('slack-cli transactions err: ', e)
			return Promise.reject(e)
		}
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
		else if (near_res.type)
			return String(near_res.type)
		else if (typeof near_res === 'object' || near_res instanceof Array)
			return JSON.stringify(near_res, null, 2)
		else if (near_res)
			return String(near_res)
		else
			return 'Success'
	}
	global.stringifyResponse = stringifyResponse
	return {
		installer,
		validateRequest,
		create,
		login,
		send,
		getCallInteractiveInput,
		notLoggedInResponse,
		functionCallWithDeposit,
		view,
		call,
		account,
		balance,
		contract,
		keys,
		help,
		getDeletionResponse,
		createUserDocId,
		stringifyResponse,
		transactions,
	}
}

async function createUser(payload, near_account, db) {
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

async function handleMissingContractFCKey(payload, user, commands) {
	fl.log(commands, 'call commands4')
	let wallet_login_url = await near.generateWalletLoginURL('functionKey', payload, user.near_account, commands[1], [])
	return {
		text: 'No Function Call Access Key found for '+commands[1],
		response_type: 'ephemeral',
		attachments: [
			{
				color: '#4fcae0',
				attachment_type: 'default',
				callback_id: 'FCkey_from_help',
				fallback: '/near login',
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
function removeDuplicatedMethods(methods) { //For some reason Contract parser returns each method twice, I am removing the snake case ones
	let filtered_methods = []

	for (let method of methods) {
		let snake_case_method = method.replace(/[A-Z]/g, (letter, index) => { return index === 0 ? letter.toLowerCase() : '_'+ letter.toLowerCase();});
		let camel_case_method = method.toLowerCase().replace(/[-_][a-z]/g, (group) => group.slice(-1).toUpperCase());
		if (!filtered_methods.includes(method) && !filtered_methods.includes(snake_case_method) && !filtered_methods.includes(camel_case_method))
			filtered_methods.push(method)
	}
	return filtered_methods
}
