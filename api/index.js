process.env.GCLOUD_PROJECT = 'near-api-1d073'
const { getAnalytics } = require('firebase/analytics')
const { initializeApp, cert, getApps } = require('firebase-admin/app')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const functions = require('firebase-functions')
const fs = require('fs')
const axios = require('axios')
const {PubSub} = require('@google-cloud/pubsub');
const pubsub = new PubSub();
const near = require('./near');

// const pubsubs = require('./pubsubs.js') // TODO: extract pubsubs into this file
// Currently not being able to initialise imported functions with Firestore deploy

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

// if (getApps().length === 0)
initializeApp(firebaseConfig)

// console.log('BEFORE ERR 2', firebaseApp)
// const analytics = getAnalytics(firebaseApp)
// console.log('BEFORE ERR 3')
// if (typeof db === 'undefined') {
const db = getFirestore()
db.settings({ ignoreUndefinedProperties: true })
global.db = db
// global.db = getFirestore().settings({ ignoreUndefinedProperties: true })
// }
// const slack = {}
// if(typeof slack === 'undefined') {
	global.slack = require('./slack')(db, functions)
// }
// if(typeof fl === 'undefined') {
	 //Logging shortcut
	global.fl = functions.logger
// }


exports.healthDB = functions.https.onRequest(async (req, res) => {
	let test_res = await exampleDBReadWriteDelete()
	res.send(test_res);
});


exports.loginPubSub = functions.pubsub.topic('slackLoginFlow').onPublish(async (message) => {
	console.log('loginPubSub Start')
	// console.log('loginPubSub Start', message)
	if (!message.data) return

	const data = JSON.parse(Buffer.from(message.data, 'base64').toString())
	// console.log('loginPubSub data', data)
	const payload = data.payload
	const commands = data.commands
	// console.log('loginPubSub payload', payload)
	// console.log('loginPubSub commands', commands)

	try {
		let login_data = await slack.login(payload, commands)
		fl.log('slack.login Success Start'+JSON.stringify(login_data))

		await sendDataToResponseURL(payload.response_url, login_data)
	} catch (e) {
		fl.log('loginPubSub err: '+JSON.stringify(e))
		await sendDataToResponseURL(payload.response_url, { text: 'NEAR Error: ' + e.message })
	}
})

exports.slackCallContractFlow = functions.pubsub.topic('slackCallContractFlow').onPublish(async (message) => {
	fl.log('slackCallContractFlow PubSub Start')
	console.log('slackCallContractFlow Start', message)
	let data
	if (message.data)
		data = JSON.parse(Buffer.from(message.data, 'base64').toString())
	else if (message.payload && message.commands)
		data = message
	else
		return 'Bad Input'

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

exports.installSlackNear = functions.https.onRequest(async (req, res) => {
	const url = await slack.installer.generateInstallUrl({
		scopes: ['channels:read', 'groups:read', 'channels:manage', 'chat:write', 'incoming-webhook'],
		metadata: 'some_metadata',
	})
	console.log('slackInstallUrl', url)
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

exports.nearSignTransactionCallback = functions.https.onRequest(async (req, res) => {
	fl.log("req.params:", req.params);
	fl.log("req.query:", req.query);
	fl.log("req.body:", req.body);

	let context
	if (req.query.meta)
		context = JSON.parse(req.query.meta)

	let slack_redirect_url // URL to redirect the user directly to Slack App
	if (context.team_domain && context.channel_id)
		slack_redirect_url = `https://${context.team_domain}.slack.com/archives/${context.channel_id}`

	try {
		if (context && context.response_url) {
			if (context.methodName) {
				// TODO: Fetch functionCall result from blockchain rpc
				// let transaction = await near.queryTransactionHash(req.query.transactionHashes, context.accountId)
				await sendDataToResponseURL(context.response_url, { text: `Function Call to ${context.methodName}@${context.receiverId} Succeeded`})
			}else //This is a simple transaction
				await sendDataToResponseURL(context.response_url, { text: `Transaction to ${context.receiverId} was successful (${context.amount}N)`})
		}

		// TODO: Maybe record to DB successful transaction... maybe not

		let frontend_success = `https://${process.env.GCLOUD_PROJECT}.web.app/redirection?status=success&key=function`
		res.header("Location", slack_redirect_url || frontend_success).send(302);
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

exports.slackHook = functions.https.onRequest(async (req, res) => {
	// CORS enabled
	res.set('Access-Control-Allow-Origin' , '*');
	res.set('Access-Control-Allow-Methods', 'POST');
	res.set('Access-Control-Allow-Headers', '*');

	try {
		// fl.log('process.env ', process.env)
		if (process.env.NODE_ENV === 'production' && !slack.validateRequest(req))
			return res.send('Request Authentication Error')

		fl.log('slackHook req', req.body)
		let payload = parseSlackPayload(req)
		fl.log('slackHook payload', payload)
		let commands = await parseSlackCommands(payload)
		fl.log('slackHook commands', commands)

		if(payload.state) {
			fl.log('slackHook2 payload.state.values.call_deposit.value', payload.state.values.call_deposit.plain_input_deposit.value);
			fl.log('slackHook2 payload.state.values.call_arguments.value', payload.state.values.call_arguments.plain_input_arguments.value);
		}
		if(payload.actions) {
			fl.log('slackHook payload.actions[0].value', payload.actions[0].value);
		}
		// fl.log('payload.token', payload.token);

		if (commands[0] && commands[0] === 'test') {
			return res.send({
				response_type: 'ephemeral',
				blocks: [
					{
						type: 'section',
						text: {
							type: 'mrkdwn',
							text: 'Do you want to add arguments and/or deposit?'
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
								value: 'call devtest.testnet sayHi add'
							},
							{
								type: 'button',
								text: {
									type: 'plain_text',
									emoji: true,
									text: 'Skip'
								},
								value: 'call devtest.testnet sayHi skip'
							}
						]
					}
				]
			})
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
				console.log('before slack.login')

				// Needed to workaround Slack timeout limit (using PubSUb)
				// Maximum execution time for slack hook is 2.5sec, this login takes 4-5sec, so delaying the response
				const topic = pubsub.topic('slackLoginFlow');

				const messageObject = {
						payload: payload,
						commands: commands
				};
				const messageBuffer = Buffer.from(JSON.stringify(messageObject), 'utf8');

				// Publishes a message
				await topic.publishMessage({ json: messageObject});
				//END  (using PubSUb)

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
				console.log('before slack.account')
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
				console.log('before slack.balance')
				if (!commands[1]) { // account missing, Getting logged in account for slack user
					commands.push(await getCurrentNearAccountFromSlackUsername(payload.user_name))
				} else if (!validateNEARAccount(commands[1])) {
					response = 'Invalid NEAR Account'
					break
				}

				response = await slack.balance(payload, commands)
				break
			case 'contract':
				console.log('before slack.contract')
				if (!commands[1]) { // account missing, Getting logged in account for slack user
					commands.push(await getCurrentNearAccountFromSlackUsername(payload.user_name))
				} else if (!validateNEARAccount(commands[1])) {
					response = 'Invalid NEAR Account'
					break
				}

				response = await slack.contract(payload, commands)
				break
			case 'keys':
				console.log('before slack.keys')
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

				console.log('before slack.call')
				fl.log('before slack.call payload.response_url', payload.response_url)

				if (!commands[3]) {
					response = slack.getCallInterractiveInput(payload, commands)
				} else if (commands[3] === 'cancel') {
					response = { delete_original: true }
				} else if (commands[4] && Number(commands[4]) > 0) {
					response = await slack.functionCallWithDeposit(payload, commands)
					fl.log('Call Response ', response)
				} else {
					// Calling background Function to Process NON-Deposit Call
					const topic2 = pubsub.topic('slackCallContractFlow');

					const messageObject2 = {
						payload: payload,
						commands: commands
					};
					const messageBuffer2 = Buffer.from(JSON.stringify(messageObject2), 'utf8');

					// Publishes a message
					await topic2.publish(messageBuffer2);

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
				console.log('before slack.view')
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

				console.log('before slack.send')
				response = await slack.send(payload, commands)
				console.log('after slack.send')
				break
			case 'help':
				console.log('before slack.help')
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

		if(response) {
			if (typeof response === 'string')
				response = { text: response }
			if (req.add_payload_and_commands)
				response = {...response, payload, commands}

			if(payload.state && payload.response_url) {
				fl.log('slackHook response state: ', response)
				sendDataToResponseURL(payload.response_url, response)
				res.send({ delete_original: true })
			} else {
				fl.log('slackHook response: ', response)
				res.send(response)
			}
		} else
			res.end()
	} catch (e){
		fl.log('slackHook ERROR1: ', e)
		let err_msg = formatErrorMsg(e)
		fl.log('slackHook ERROR2: ', err_msg)
		res.send(err_msg)
	}
})

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

async function exampleDBReadWriteDelete() {
	try {
		console.log("exampleDBReadWriteDelete Start: ");
		// const docRef = db.collection('users').doc('alovelace');
		// let write = await docRef.set({
		// 	first: 'Ada',
		// 	last: 'Lovelace',
		// 	born: 1815
		// });
		// console.log("exampleDBReadWriteDelete write: ", write);

		// const doc = await db.collection('users').doc('alovelace').get();
		// // console.log("exampleDBReadWriteDelete user: ", doc.id, '=>', doc.data());

		const deletion = await db.collection('users').doc('alovelace').delete()
		// console.log("exampleDBReadWriteDelete deletion: ", deletion);

		// const deleted_doc = await db.collection('users').doc('alovelace').get();
		// // console.log("exampleDBReadWriteDelete Deleted User: ", deleted_doc);

		return {
			// write,
			// doc,
			deletion,
			// deleted_doc
		}
	} catch (e) {
		console.log("exampleDBReadWriteDelete err: ", e);
		return Promise.reject(e)
	}

}

function validateNEARAccount(account) {
	// TODO: after the dot we should check for either testnet or mainnet

	console.log('before validateNEARAccount')
	return /[a-z0-9]*\.(near|testnet)/.test(account)
}
global.validateNEARAccount = validateNEARAccount

function sendDataToResponseURL(response_url, data) {
	return axios.post(response_url, data,
		{
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
		})
		.catch((e)=>fl.log('axios post to response_url FAILED:  '+response_url+' - '+JSON.stringify(data)+'\n'+JSON.stringify(e)))
}
global.sendDataToResponseURL = sendDataToResponseURL

function formatErrorMsg(e) {
	let err_msg = 'Ooops... '

	if (typeof e === 'string')
		err_msg += e.replace(/([A-Z])/g, " $1");
	else if (e.type)
		err_msg += e.type.replace(/([A-Z])/g, " $1");
	else if (e.message)
		err_msg += e.message.replace(/([A-Z])/g, " $1");
	else if (e.error)
		err_msg += e.error.replace(/([A-Z])/g, " $1");
	else if (typeof e === 'object' && e.text)
		err_msg = e

	let err_obj = e?.text ? err_msg : { text: err_msg }
	err_obj.delete_original = true

	return err_obj
}
async function getContractByAccountAndPublicKey(slack_username, near_account, public_key) {
	let contract = {}

	fl.log('getContractByAccountAndPublicKey 1 public_key', public_key)
	let slack_user_key = createUserDocId(slack_username)
	let near_acc_key = createUserDocId(near_account)

	let userDoc = await db.collection('users').doc(slack_user_key).get()
	let user = userDoc.data()
	fl.log('getContractByAccountAndPublicKey 1 slack_user_key', slack_user_key)
	fl.log('getContractByAccountAndPublicKey 1 near_acc_key', near_acc_key)
		if (user && user.near && user.near[near_acc_key] && user.near[near_acc_key].contracts) {
			let contracts = user.near[near_acc_key].contracts
			fl.log('getContractByAccountAndPublicKey 2 contracts', contracts)
			for (let contract_key in contracts){
				let contract_obj = user.near[near_acc_key].contracts[contract_key]
				fl.log('getContractByAccountAndPublicKey 2 contract_obj', contract_obj)
				if (contract_obj.public_key === public_key) {
					contract = contract_obj
					break
				}
			}
		} else {
			for (let acc_key in user.near){
				let contracts = user.near[acc_key].contracts
				fl.log('getContractByAccountAndPublicKey 3', contracts)
				for (let contract_key in contracts){
					let contract_obj = user.near[acc_key].contracts[contract_key]
					if (contract_obj.public_key === public_key) {
						contract = contract_obj
						await userDoc.update({ ['near.'+near_acc_key+'.contracts'+'.'+contract_key]: {
							...contract_obj,
								status: 'active'
							} })
						break
					}
				}
			}
		}

	return { user, contract }
}

function parseSlackPayload(req) {
	let payload = {...req.body};
	let payload2 = {}
	// fl.log('parseSlackPayload payload', payload);
	// console.log('slackHook payload.payload', payload.payload);
	if(payload.payload) {
		payload2 = JSON.parse(payload.payload);
		// fl.log('slackHook payload.callback_id', payload2.callback_id);

		if(payload2.user) { //In case of coming from Interactive buttons username is located in a different place ...
			payload = {...payload2}
			// fl.log('slackHook 2payload: ', payload);
			payload.user_name = payload2.user.name;
			// fl.log('slackHook payload.user_name', payload.user_name);
		}
	}
	return payload
}

async function parseSlackCommands(payload) {
	let commands = String(payload.text);

	// Handling Payload from Interactive Help Menu
	if (payload && payload.actions && payload.actions[0]) {
		if(payload.actions[0].selected_options && payload.actions[0].selected_options[0]) {
			// Parsing Commands from Interactive Menu Select
			commands = String(payload.actions[0].selected_options[0].value)
		} else if (payload.actions[0]) {
			// Parsing Commands from Interactive Button
			commands = String(payload.actions[0].value)
		}
	}
	// Handling Payload from Interactive Help Menu - END
	commands = commands.replace('  ', ' ')
	let commands_array = commands.split(' ')
	fl.log('commands_array1', commands_array)

	if (commands_array[0] === 'call' && commands_array[3]){
		// Parsing JSON arguments Input

		//Parsing call function JSON arguments
		let first_json_index = commands.indexOf('{')
		let last_json_index = commands.indexOf('}')+1
		let arguments = commands.slice(first_json_index, last_json_index)
		let deposit = commands_array[4] && !Number.isNaN(commands_array[4]) ? Number(commands_array[4]) : '0'

		if(commands_array[3] === 'add') {
			// Inject slack input fields into commands
			arguments = payload?.state?.values?.call_arguments?.plain_input_arguments?.value || '{}'
			deposit = payload?.state?.values?.call_deposit?.plain_input_deposit?.value || '0'
		}	else if(commands_array[3] === 'skip') {
			// Inject slack input fields into commands
			arguments = '{}'
			deposit = '0'
		}	else if(commands_array[3] === 'cancel') {
			// Cancel and Delete Interractive BLocks
			arguments = 'cancel'
			deposit = '0'
		}
		else if(commands_array[3].charAt(0) !== '{') {
			return Promise.reject('Invalid Function Arguments, please check /near help call')
		}
		fl.log('slackHook commands_array3', commands_array)
		fl.log('slackHook arguments', arguments)
		fl.log('slackHook deposit', deposit)

		if(commands_array[3] !== 'cancel') {
			try {
				JSON.parse(arguments);
			} catch (e) {
				return Promise.reject('Arguments are not a valid JSON')
			}
		}

		commands_array = commands_array.slice(0, 3)
		if(arguments) {
			commands_array.push(arguments)
		}
		if(deposit) {
			commands_array.push(deposit)
		}
		// fl.log('commands.replace1', commands)
		fl.log('commands.spliced', commands_array)
	}
	// fl.log('commands_array final', commands_array)
	return commands_array
}
function IsJsonString(str) {
	try {
		JSON.parse(str);
	} catch (e) {
		return false;
	}
	return true;
}
async function getCurrentNearAccountFromSlackUsername(user_name) {
	try {
		console.time('getCurrentNearAccountFromSlackUsername db.collection(users)')
		let user = (await db.collection('users').doc(slack.createUserDocId(user_name)).get()).data()
		if(!user?.near_account) {
			let response = slack.notLoggedInResponse()
			console.timeEnd('getCurrentNearAccountFromSlackUsername db.collection(users)')
			return Promise.reject(response)
		}
		console.timeEnd('getCurrentNearAccountFromSlackUsername db.collection(users)')
		return user.near_account
	} catch (e) {
		return Promise.reject(e)
	}
}
