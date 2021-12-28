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

			if(user.near_fn_key && !!'TODO: FN key is active') {
				return { text: 'Login Successful' }
			} else {
				// TODO: Introduce an env variable to determine routing
				// let login_url = `http://localhost:3000/login/?fb_token=${user.fb_token}`
				let login_url = `https://near-api-1d073.firebaseapp.com/login/?fb_token=${user.fb_token}`
				// TODO: add a button with the url because the url is too long
				fl.log('login login_url', login_url)
				return {
					text: 'Connect Slack with your NEAR account',
					channel: payload.channel_id,
					attachments: [
						{
							fallback: login_url,
							color: "#4fcae0",
							attachment_type: "default",
							actions: [
								{
									type: "button",
									style: "primary",
									text: "Connect NEAR Wallet",
									url: login_url
								}
							]
						}
					]
				}
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
			let options = near.getConnectOptions(null,
				near.getNetworkFromAccount(commands[1]),
				{
					accountId: commands[1],
					contractName: commands[1],
					methodName: commands[2],
				})
			let result = await near.callViewFunction(options)
			console.log('SLACK view result', result)
			return commands[2]+'(): '+stringifyResponse(result)
		} catch (e) {
			console.log('near-cli view err: ', e)
			return Promise.reject(e)
		}

	}
	async function call () {
		try {

		} catch (e) {
			console.log('near-cli call err: ', e)
			return Promise.reject(e)
		}

	}

	async function help (commands) {
		let help = 'Available commands:\n' +
			'login, send, view and call\n' +
			'for more details use /near help {command}'
		if (!commands[1])
			return help

		switch (commands[1]) {
			case 'login':
				help = 'Connect NEAR wallet -> /near login {your NEAR account}'
				break
			case 'send':
				help = 'Transfer NEAR tokens to another account\n' +
					'/near send {your NEAR account} {to NEAR account} {amount}\n' +
					'amount format is in NEAR tokens, for ex. 12.025\n' +
					'Note: You will need a full access key for the sending account (/near login)'
				break
			case 'view':
				help = 'Get result from a contract\'s View method\n' +
					'/near view {contract account} {method name} {arguments}\n' +
					'arguments are optional, format is JSON(no whitespace), for ex. {"user":"test_user"}}\n' +
					'Note: Call is free of charge'
				break
			case 'call':
				help = 'Post request to a contract\'s Change method\n' +
					'/near call {contract account} {method name} {arguments}\n' +
					'arguments are optional, format is JSON(no whitespace), for ex. {"user":"test_user"}}\n' +
					'Note: Change method calls require a transaction fee (gas)\n'+
					'Your logged in account will be charged ~0.00025 NEAR (/near login)'
				break
			default:
				help = 'We haven\'t added "' + commands[1] + '" command yet ;)'
		}

		return help
	}
	async function hello () {
		return "Hello from near-cli";
	}

	return {
		installer,
		login,
		send,
		view,
		call,
		help,
		hello
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

async function getUserBySlackAndNearAccs(near_account, slack_username, db) {
	let user

	let users = await db.collection('users')
		.where('near_account', '==', near_account)
		.where('slack_username', '==', slack_username)
		.get()
	users.forEach(doc => {
		if (doc) {
			console.log(doc.id, '=>', doc.data());
			user = doc.data()
		}
	});

	return user
}

function createUserDocId(string) {
	return string
		.replace(/\./g, '1_1')
		.replace(/#/g, '2_2')
		.replace(/\$/g, '3_3')
		.replace(/\[/g, '4_4')
		.replace(/]/g, '5_5')
}
function stringifyResponse(near_res) {
	if (typeof near_res === 'string')
		return near_res
	else if (typeof near_res === 'object' || near_res instanceof Array)
		return JSON.stringify(near_res, null, 2)
	else
		return String(near_res)
}
