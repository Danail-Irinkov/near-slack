process.env.GCLOUD_PROJECT = 'near-api-1d073'
// const { getAnalytics } = require('firebase/analytics')
const { initializeApp, cert, getApps } = require('firebase-admin/app')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const functions = require('firebase-functions')
const fs = require('fs')
const {PubSub} = require('@google-cloud/pubsub')
const pubsub = new PubSub()
const near = require('./near')
const {
	setupTestDBUser,
	validateNEARAccount,
	sendDataToResponseURL,
	formatErrorMsg,
	parseSlackPayload,
	parseSlackCommands,
	IsJsonString,
	getCurrentNearAccountFromSlackUsername
} = require('./utils')

global.validateNEARAccount = validateNEARAccount
global.sendDataToResponseURL = sendDataToResponseURL

const firebaseConfig = {
	apiKey: "AIzaSyCL0TqPIAx-HOb12mWeS7iP_uB-RMYfm1w",
	authDomain: "near-api-1d073.firebaseapp.com",
	projectId: "near-api-1d073",
	storageBucket: "near-api-1d073.appspot.com",
	messagingSenderId: "77148669093",
	appId: "1:77148669093:web:0723fee1a7ba423907394c",
	measurementId: "G-DGTKFVLVL2"
};
if(fs.existsSync('./near-api-1d073-firebase-adminsdk-fyizi-d7f7e50e8c.json') && !firebaseConfig.credential) {
	const serviceAccount = require("./near-api-1d073-firebase-adminsdk-fyizi-d7f7e50e8c.json");
	firebaseConfig.credential = cert(serviceAccount)
}

initializeApp(firebaseConfig)
const db = getFirestore()
db.settings({ ignoreUndefinedProperties: true })
global.db = db
global.slack = require('./slack')(db, functions)
global.fl = functions.logger


exports.healthDB = functions.https.onRequest(async (req, res) => {
	let test_res = await setupTestDBUser(req, res)
	res.send(test_res);
});

exports.installSlackNear = functions.https.onRequest(async (req, res) => {
	const url = await slack.installer.generateInstallUrl({
		scopes: ['chat:write', 'commands', 'incoming-webhook'],
		metadata: 'some_metadata',
	})
	res.header("Location", url).send(302);
});
exports.slackOauth = functions.https.onRequest(async (req, res) => {
	try {
		if (req.method !== "GET") {
			fl.error(`Got unsupported ${req.method} request. Expected GET.`);
			return res.status(405).send("Only GET requests are accepted");
		}

		if (!req.query && !req.query.code) {
			return res.status(401).send("Missing query attribute 'code'");
		}

		await slack.installer.handleCallback(req, res)

		let slack_redirect_url

		let context = req.body
		if (context.team_domain && context.channel_id)
			slack_redirect_url = `https://${context.team_domain}.slack.com/archives/${context.channel_id}`
		let frontend_success = `https://${process.env.GCLOUD_PROJECT}.web.app/redirection?status=success&key=slack`

		res.header("Location", slack_redirect_url || frontend_success).send(302)
	} catch (e) {
		fl.error(e)
		// return res.status(502).end()
		return res.header("Location", `https://${process.env.GCLOUD_PROJECT}.web.app/redirection?status=success&key=slack`).send(302);
	}
});

exports.loginPubSub = functions.pubsub.topic('slackLoginFlow').onPublish(async (message) => {
	fl.log('loginPubSub Start', message)
	let data = JSON.parse(Buffer.from(message.data, 'base64').toString())

	// const data = JSON.parse(Buffer.from(message.data, 'base64').toString())
	// console.log('loginPubSub data', data)
	const payload = data.payload
	const commands = data.commands
	// console.warn('loginPubSub payload', payload)
	// console.warn('loginPubSub commands', commands)

	try {
		let login_data = await slack.login(payload, commands)
		// console.warn('loginPubSub login_data', login_data)
		// fl.log('slack.login Success Start', login_data)

		if(payload.mock_near_request)
			return login_data
		else
			return await sendDataToResponseURL(payload.response_url, login_data)
	} catch (e) {
		fl.log('loginPubSub err: '+JSON.stringify(e))
		await sendDataToResponseURL(payload.response_url, { text: 'NEAR Error: ' + e.message })
		return Promise.reject(e)
	}
})
exports.slackCallContractFlow = functions.pubsub.topic('slackCallContractFlow').onPublish(async (message) => {
	// fl.log('slackCallContractFlow PubSub Start')
	fl.log('slackCallContractFlow Start', message)

	let data = JSON.parse(Buffer.from(message.data, 'base64').toString())

	// console.log('slackCallContractFlow data', data)
	const payload = data.payload
	const commands = data.commands
	fl.log('slackCallContractFlow payload', payload)
	fl.log('slackCallContractFlow commands', commands)

	try {
		let call_res = await slack.call(payload, commands)
		fl.log('slackCallContractFlow after Call', call_res)

		await sendDataToResponseURL(payload.response_url, call_res)
		return call_res
	} catch (e) {
		fl.log(e);
		await sendDataToResponseURL(payload.response_url, { text: 'NEAR Error: ' + stringifyResponse(e) })
		return Promise.reject(e)
	}
})

exports.slackHook = functions.https.onRequest(async (req, res) => {
	// CORS enabled
	res.set('Access-Control-Allow-Origin' , '*');
	res.set('Access-Control-Allow-Methods', 'POST');
	res.set('Access-Control-Allow-Headers', '*');

	try {
		// fl.log('process.env ', process.env)
		if (process.env.NODE_ENV === 'production' && !slack.validateRequest(req))
			return res.status(401).send('Request Authentication Error')

		// fl.log('slackHook req', req.body)
		let payload = parseSlackPayload(req)
		fl.log('slackHook payload', payload)
		let commands = await parseSlackCommands(payload)
		fl.log('slackHook commands', commands)

		// fl.log('payload.token', payload.token);

		if (commands[0] && commands[0] === 'test') {
			let url = 'https://wallet.testnet.near.org/login/?success_url=https%3A%2F%2Fus-central1-near-api-1d073%2ecloudfunctions%2enet%2FnearLoginRedirect%2F%3Fslack_username%3Dprocc%2emain%26channel_id%3DC02LWTCUU93%26team_domain%3Dproccmaingmai-tc79872%26response_url%3Dhttps%3A%2F%2Fhooks%2eslack%2ecom%2Factions%2FT02MCFBJMUH%2F2946145801462%2FW4Vv3Hnwlrw0XnCGhNRQkrRt%26redirect%3DfunctionKey&context=testString&contract_id=dan2.testnet&public_key=ed25519:As4umurSTn79ZpNNxgnarBYhqtbC3LQXHWSJ1tQqNU42&referer=slack.com'
			return 		res.header("referer", 'NEAR Slack').header("Location", url).send(302);
		}
		let response = `Hello from NEAR-Slack.\nI don't know '${commands[0]}', try /near help`
		switch (commands[0]) {
			case 'create':
				response = await slack.create(payload, commands)
				break
			case 'login':
				if (commands[1] && !validateNEARAccount(commands[1])) {
					response = 'Invalid NEAR Account'
					break
				}

				// Needed to workaround Slack timeout limit (using PubSUb)
				// Maximum execution time for slack hook is 2.5sec, this login takes 4-5sec, so delaying the response
				const topic = pubsub.topic('slackLoginFlow');
				await topic.publishMessage({ json: {
						payload: payload,
						commands: commands
					} });

				response = {
					text: 'Initializing account...',
					response_type: 'ephemeral',
				}
				break
			case 'logout':
				// TODO: When making Function calls, the sender is determined by the FC key
				// TODO: So when the user logins with a different Near account we need to start collecting new FC keys
				// TODO: So we will need to refactor the Database as follows:
				// TODO: user.near.near_account.contract = { private_key, public_key }
				// TODO: In this way each slack user will be able to properly use multiple near accounts
				// TODO: AND OF COURSE all the code that uses these properties will need to get refactored accordingly
				let user = (await db.collection('users').doc(slack.createUserDocId(payload.user_name)).get()).data()
				if (user.near_account) {
					await db.collection('users').doc(slack.createUserDocId(payload.user_name)).update({
						near_account: FieldValue.delete(),
						near_account_last: user.near_account,
					})
					response = 'Logged out NEAR Account: '+user.near_account
				} else {
					response = 'You have no NEAR Account Logged in'
				}
				break
			case 'account':
				if (!commands[1]) { // account missing, Getting logged in account for slack user
					const current_account = await getCurrentNearAccountFromSlackUsername(payload.user_name)
					commands.push(current_account)
				} else if (!validateNEARAccount(commands[1])) {
					response = 'Invalid NEAR Account'
					break
				}

				response = await slack.account(payload, commands)
				break
			case 'balance':
				if (!commands[1]) { // account missing, Getting logged in account for slack user
					commands.push(await getCurrentNearAccountFromSlackUsername(payload.user_name))
				} else if (!validateNEARAccount(commands[1])) {
					response = 'Invalid NEAR Account'
					break
				}

				response = await slack.balance(payload, commands)
				break
			case 'contract':
				if (!commands[1]) { // account missing, Getting logged in account for slack user
					commands.push(await getCurrentNearAccountFromSlackUsername(payload.user_name))
				} else if (!validateNEARAccount(commands[1])) {
					response = 'Invalid NEAR Account'
					break
				}

				response = await slack.contract(payload, commands)
				break
			case 'keys':
				if (!commands[1]) { // account missing, Getting logged in account for slack user
					commands.push(await getCurrentNearAccountFromSlackUsername(payload.user_name))
				} else if (!validateNEARAccount(commands[1])) {
					response = 'Invalid NEAR Account'
					break
				}

				response = await slack.keys(payload, commands)
				break
			case 'call':
				if (!validateNEARAccount(commands[1])) {
					response = 'Invalid NEAR Account'
					break
				}
				if (!commands[2]) {
					response = 'Missing Call Method Name'
					break
				}

				fl.log('before slack.call payload.response_url', payload.response_url)

				if (!commands[3]) {
					response = slack.getCallInteractiveInput(payload, commands)
				} else if (commands[3] === 'cancel') {
					response = { delete_original: true }
				} else if (commands[4] && Number(commands[4]) > 0) {
					response = await slack.functionCallWithDeposit(payload, commands)
					fl.log('Call Response ', response)
				} else {
					// Calling background PubSub Function to Process NON-Deposit Call
					const topic2 = pubsub.topic('slackCallContractFlow');
					await topic2.publishMessage({ json: {
							payload: payload,
							commands: commands
						} });

					response = {
						text: 'Processing Function Call...',
						response_type: 'ephemeral'
					}
				}
				break
			case 'view':
				if (!validateNEARAccount(commands[1])) {
					response = 'Invalid NEAR Account'
					break
				}
				if (!commands[2]) {
					response = 'Missing View Method Name'
					break
				}
				response = await slack.view(payload, commands)
				break
			case 'send':
				if (commands.length === 3 && validateNEARAccount(commands[1])) { // account missing, Getting logged in account for slack user
					commands.splice(1, 0, await getCurrentNearAccountFromSlackUsername(payload.user_name))
				} else if (commands.length !== 3) {
					response = 'Improper syntax.\nPlease check /near help send'
					break
				} else if (!validateNEARAccount(commands[1])) {
					response = 'Invalid NEAR Account'
					break
				}

				response = await slack.send(payload, commands)
				break
			case 'transactions':
				if (commands.length === 1) {
					const accountId = await getCurrentNearAccountFromSlackUsername(payload.user_name);
					commands.push(accountId)
					response = await slack.transactions(payload, commands);

				} else	if (validateNEARAccount(commands[1])) {
					response = await slack.transactions(payload, commands);
					// TODO: add validation for offset command
				} else {
					response = 'Improper syntax.\nPlease check /near help transactions'
				}
				break;
			case 'help':
				response = await slack.help(payload, commands)
				break

			case 'delete':
				let delete_res = await slack.getDeletionResponse(payload, commands)
				if (delete_res)
					response = delete_res
				break
			default:
			// fl.log('No such command.');
		}

		// Responding to Slack
		if(response) {
			if (typeof response === 'string')
				response = { text: response }
			if (req.add_payload_and_commands)
				response = {...response, payload, commands}

			if(payload.response_url) {
				fl.log('slackHook response state: ', response)
				sendDataToResponseURL(payload.response_url, response)
				if (process.env.IS_TEST)
					res.send(response)
				else
					res.send()
			} else {
				fl.log('slackHook response: ', response)
				res.send(response)
			}
		} else
			res.end()
		// Responding to Slack - END
	} catch (e){
		fl.log('slackHook ERROR1: ', e)
		let err_msg = formatErrorMsg(e)
		fl.log('slackHook ERROR2: ', err_msg)
		res.send({ error: err_msg })
	}
})

exports.nearSignTransactionCallback = functions.https.onRequest(async (req, res) => {
	// fl.log("req.params:", req.params);
	fl.log("nearSignTransactionCallback req.query:", req.query);
	// fl.log("req.body:", req.body);

	let context
	if (req.query.signMeta)
		context = JSON.parse(req.query.signMeta)

	let slack_redirect_url // URL to redirect the user directly to Slack App
	if (context.team_domain && context.channel_id)
		slack_redirect_url = `https://${context.team_domain}.slack.com/archives/${context.channel_id}`

	try {
		let response
		if (context && context.response_url) {
			if (context.methodName) {
				// TODO: Fetch functionCall result from blockchain rpc
				let transaction = await near.queryTransactionHash(req.query.transactionHashes, context.accountId)
				let logs = transaction.receipts_outcome[0].outcome.logs
				let return_value = Buffer.from(transaction.receipts_outcome[0].outcome.status.SuccessValue, 'base64').toString()

				response = { text: `Function Call to ${context.methodName}@${context.receiverId} Succeeded`}
				if(logs && logs.length) {
					for (let log of logs) {
						if (log.length > 0 && log.length < 32)
							response.text += `\n Logs: ${log}`
					}
				}
				if(return_value) response.text += `\n Result: ${return_value}`
			}else //This is a simple transaction
				response = { text: `Transaction to ${context.receiverId} was successful (${context.amount}N)`}
		}

		if(response)
			sendDataToResponseURL(context.response_url, response)

		let frontend_success = `https://${process.env.GCLOUD_PROJECT}.web.app/redirection?status=success&key=function`
		res.header("Location", slack_redirect_url || frontend_success).send(302);

		return response
	} catch (e) {
		fl.error(e)

		if (context && context.response_url) {
			await sendDataToResponseURL(context.response_url, { text: `Transaction to ${context.receiverId} failed!`})
		}
		let frontend_fail = `https://${process.env.GCLOUD_PROJECT}.web.app/redirection?status=failure&key=function`
		res.header("Location", slack_redirect_url || frontend_fail).send(302);
	}

	res.send('OK');
});
exports.nearLoginRedirect = functions.https.onRequest(async (req, res) => {
	try {
		if(!req.query.account_id || !req.query.all_keys) return res.status(502).end('Missing required fields')
		fl.log(req.query, 'nearLoginRedirect query')

		let response_url = req.query.response_url || req.body.response_url || ''
		let team_domain = req.query.team_domain || req.body.team_domain || ''
		let channel_id = req.query.channel_id || req.body.channel_id || ''
		let text = req.query.text || req.body.text || ''

		let slack_redirect_url // URL to redirect the user directly to Slack App
		if (team_domain && channel_id)
			slack_redirect_url = `https://${team_domain}.slack.com/archives/${channel_id}`

		if (req.query.redirect === 'login'){
			// Initial Slack User Login
			let userDoc = await db.collection('users').doc(slack.createUserDocId(req.query.slack_username))
			await userDoc.update({
				near_account: req.query.account_id,
				near_fn_key: req.query.all_keys,
			})

			if (response_url) {
				await sendDataToResponseURL(response_url, {
					text: 'Logged In as ' + req.query.account_id,
					replace_original: true, // NOT WORKING ... TODO: FIx
					delete_original: true // NOT WORKING ... TODO: FIx replace of last message with buttons
				})
			}

			let frontend_success = `https://${process.env.GCLOUD_PROJECT}.web.app/redirection?status=success&key=login`
			res.header("Location", slack_redirect_url || frontend_success).send(302);
		} else if (req.query.redirect === 'functionKey'){
			fl.log('nearLoginRedirect functionKey Call1')
			// Creating Contract FunctionCall Access Key
			let { user, contract } = await getContractByAccountAndPublicKey(req.query.slack_username, req.query.account_id, req.query.public_key)

			fl.log('nearLoginRedirect functionKey Call2 user', user)
			fl.log('nearLoginRedirect functionKey contract', contract)
			let near_acc_key = createUserDocId(user.near_account)
			fl.log('nearLoginRedirect functionKey Call22')
			let contract_key = createUserDocId(contract.contract_name)
			fl.log('nearLoginRedirect functionKey Call3')

			let userDoc = db.collection('users').doc(createUserDocId(req.query.slack_username))
			fl.log('nearLoginRedirect functionKey Call4')
			if (req.query.all_keys && req.query.public_key) {
				await userDoc.update({ ['near.'+near_acc_key+'.contracts'+'.'+contract_key+'.status']: 'active' })

				if (response_url) {
					let response_data = {
						text: `FunctionCall Access Key for ${req.query.account_id} is ready to use`,
						response_type: 'ephemeral',
						replace_original: true
					}
					if (text) {
						// TODO: Immediately redirect user to call flow, but cant do because we dont have proper slack payload...
						response_data.attachments = {
							color: '#4fcae0',
							attachment_type: 'default',
							callback_id: 'sign_transaction_from_help',
							fallback: '/near '+text,
							actions: [
								{
									type: 'button',
									style: 'primary',
									text: 'Sign Transaction',
									name: 'sign_transaction',
									value: text
								}
							]
						}
					}
					await sendDataToResponseURL(response_url, response_data)
				}
				let frontend_success = `https://${process.env.GCLOUD_PROJECT}.web.app/redirection?status=success&key=function&contract_id=${req.query.contract_id}`
				res.header("Location", slack_redirect_url || frontend_success).send(302);
			} else {
				// if(contract.contract_name) // We dont know the contract name in this case, cant update status
				// 	await userDoc.update({ ['near.'+near_acc_key+'.contracts'+'.'+contract_key+'.status']: 'failed' })

				if (response_url) {
					await sendDataToResponseURL(response_url, {
						text: `FunctionCall Access Key for ${req.query.account_id} - Authorization Failed`,
						replace_original: true
					})
				}
				res.header("Location", `https://${process.env.GCLOUD_PROJECT}.web.app/redirection?status=failure&key=function&contract_id=${req.query.contract_id}`).send(302);
			}
		}
		res.end()
	} catch (e) {
		fl.error(e)
		return res.status(502).end('Oops, this is our fault, NEAR Login Redirect has Failed')
	}
});

