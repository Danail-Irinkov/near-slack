process.env.GCLOUD_PROJECT = 'near-api-1d073'
const { getAnalytics } = require('firebase/analytics')
const { initializeApp, cert } = require('firebase-admin/app')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const functions = require('firebase-functions')
const fs = require('fs')
const axios = require('axios')
const {PubSub} = require('@google-cloud/pubsub');
const pubsub = new PubSub();


const firebaseConfig = {
	apiKey: "AIzaSyCL0TqPIAx-HOb12mWeS7iP_uB-RMYfm1w",
	authDomain: "near-api-1d073.firebaseapp.com",
	projectId: "near-api-1d073",
	storageBucket: "near-api-1d073.appspot.com",
	messagingSenderId: "77148669093",
	appId: "1:77148669093:web:0723fee1a7ba423907394c",
	measurementId: "G-DGTKFVLVL2"
};
if(fs.existsSync('./near-api-1d073-firebase-adminsdk-fyizi-d7f7e50e8c.json')) {
	const serviceAccount = require("./near-api-1d073-firebase-adminsdk-fyizi-d7f7e50e8c.json");
	firebaseConfig.credential = cert(serviceAccount)
}

const firebaseApp = initializeApp(firebaseConfig)
// console.log('BEFORE ERR 2', firebaseApp)
// const analytics = getAnalytics(firebaseApp)
// console.log('BEFORE ERR 3')
const db = getFirestore()
db.settings({ ignoreUndefinedProperties: true })
global.db = db

// const slack = {}
const slack = require('./slack')(db, functions)
const fl = functions.logger //Logging shortcut
global.fl = fl

exports.helloWorld = functions.https.onRequest((req, res) => {
	exampleDBReadWrite()
	res.send("Hello from Firebase!");
});

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
		let slack_redirect_url = `https://proccmaingmai-tc79872.slack.com/archives/C02RKJC9DE3`
		// res.header("Location", slack_redirect_url).send(302);
		res.header("Location", `https://${process.env.GCLOUD_PROJECT}.web.app/redirection?status=success&key=slack`).send(302);
	} catch (e) {
		fl.error(e)
		// return res.status(502).end()
		return res.header("Location", `https://${process.env.GCLOUD_PROJECT}.web.app/redirection?status=success&key=slack`).send(302);
	}
});

exports.slackHook = functions.https.onRequest(async (req, res) => {
	// CORS enabled
	res.set('Access-Control-Allow-Origin' , '*');
	res.set('Access-Control-Allow-Methods', 'POST');
	res.set('Access-Control-Allow-Headers', '*');

	try {
		let payload = parseSlackPayload(req)
		fl.log('slackHook payload', payload);
		let commands = await parseSlackCommands(payload)
		fl.log('slackHook commands', commands);

		// fl.log('payload.token', payload.token);

		let doc = {
			'asdasd.asdad': 'asdad',
		}
		let response = "Hello from Slack App.\nTry a different command or /near help"
		switch (commands[0]) {
			case 'login':
				if (commands[1] && !validateNEARAccount(commands[1])) {
					response = 'Invalid Near Account'
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
				await topic.publish(messageBuffer);
				//END  (using PubSUb)

				response = {
					text: 'Initializing account...',
					response_type: 'ephemeral'
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
					commands.push(await getCurrentNearAccountFromSlackUsername(payload.user_name))
				} else if (!validateNEARAccount(commands[1])) {
					response = 'Invalid Near Account'
					break
				}

				response = await slack.account(payload, commands, fl)
				break
			case 'keys':
				console.log('before slack.keys')
				if (!commands[1]) { // account missing, Getting logged in account for slack user
					commands.push(await getCurrentNearAccountFromSlackUsername(payload.user_name))
				} else if (!validateNEARAccount(commands[1])) {
					response = 'Invalid Near Account'
					break
				}

				response = await slack.keys(payload, commands, fl)
				break
			case 'call':
				if (!validateNEARAccount(commands[1])) {
					response = 'Invalid Near Account'
					break
				}
				if (!commands[2]) {
					response = 'Missing Call Method Name'
					break
				}
				console.log('before slack.call')
				response = await slack.call(payload, commands, fl)
				break
			case 'view':
				if (!validateNEARAccount(commands[1])) {
					response = 'Invalid Near Account'
					break
				}
				if (!commands[2]) {
					response = 'Missing View Method Name'
					break
				}
				console.log('before slack.view')
				response = await slack.view(payload, commands, fl)
				break
			case 'send':
				if (!validateNEARAccount(commands[1])) {
					response = 'Invalid Near Account'
					break
				}
				console.log('before slack.view')
				response = await slack.view(payload, commands, fl)
				break
			case 'help':
				console.log('before slack.help')
				response = await slack.help(commands)
				break
			default:
				// fl.log('No such command.');
		}

		if(response) {
			if (typeof response === 'string')
				response = { text: response }
			res.send(response)
		} else
			res.end()
	} catch (e){
		fl.log(e, 'slackHook ERROR: ')
		let err_msg = formatErrorMsg(e)
		res.send(err_msg)
	}
})

exports.loginPubSub = functions.pubsub.topic('slackLoginFlow').onPublish(async (message) => {
	console.log('loginPubSub Start')
	// console.log('loginPubSub Start', message)
	if (!message.data) return

	try {
		const data = JSON.parse(Buffer.from(message.data, 'base64').toString())
		// console.log('loginPubSub data', data)
		const payload = data.payload
		const commands = data.commands
		// console.log('loginPubSub payload', payload)
		// console.log('loginPubSub commands', commands)

		let login_data = await slack.login(payload, commands, fl)
		fl.log('slack.login Success Start'+JSON.stringify(login_data))

		// Record Response URL to be used after Login Success/Failure
		if (payload.user_name && payload.response_url)
			db.collection('users').doc(slack.createUserDocId(payload.user_name)).update({
				response_url: payload.response_url
			})

		await sendDataToResponseURL(payload.response_url, login_data)
	} catch (e) {
		fl.log('loginPubSub err: '+JSON.stringify(e))
	}
})

exports.nearLoginRedirect = functions.https.onRequest(async (req, res) => {
	try {
		if(!req.query.account_id || !req.query.all_keys) return res.status(502).end('Missing required fields')
		fl.log(req.query, 'nearLoginRedirect query')

		let response_url = req.query.response_url || ''
		let team_domain = req.query.team_domain || ''
		let channel_id = req.query.channel_id || ''

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
			// Creating Contract FunctionCall Access Key
			let { user, contract } = await getContractByAccountAndPublicKey(req.query.slack_username, req.query.account_id, req.query.public_key)

			let near_acc_key = createUserDocId(user.near_account)
			let contract_key = createUserDocId(contract.contract_name)

			let userDoc = db.collection('users').doc(createUserDocId(req.query.slack_username))
			if (req.query.all_keys && req.query.public_key) {
				await userDoc.update({ ['near.'+near_acc_key+'.contracts'+'.'+contract_key+'.status']: 'active' })

				if (response_url) {
					await sendDataToResponseURL(response_url, {
						text: `FunctionCall Access Key for ${req.query.account_id} is ready to use`,
						replace_original: true
					})
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

const { connect, account, keyStores, WalletConnection, KeyPair, utils, Contract} = require('near-api-js')
//
// exports.send = functions.https.onRequest(async (req, res) => {
//
// 	// This key can be found in the browser local storage when you are logged in to https://wallet.testnet.near.org/
// 	// this is the key for maix2.testnet
// 	const private_key = "ed25519:2uQXpkXWPG9Ybfy5CTirR5NcGP287ESzFQaNz6e4NjbYVQ732rdCTpaBGesyshBdagTZJhr2w5ASUaghZcxRM33t"; //full access
// 	// this is the key for maix.testnet
// 	// const private_key = "ed25519:3cUC27BLE7JnoiDUGFbbc7mcTLjMcSZish3cWjnjmm1yK7TPM44LzsWFzmAQAiTsiHUtjfjrJPGn9spLXkjgjniP"; //full access
// 	// this is the key for maix2.testnet but changed the first letter after the eliptic curve e.g. ed25519:2.. to ed25519:1..
// 	// const invalid_private_key = "ed25519:1uQXpkXWPG9Ybfy5CTirR5NcGP287ESzFQaNz6e4NjbYVQ732rdCTpaBGesyshBdagTZJhr2w5ASUaghZcxRM33t"; // using to test what happens if we get the wrong key
// 	// changing  ed25519 to ed25512 gives unknown curve error
// 	// changing the value after ed25519 gives us Error: bad secret key size
// 	// using a valid key but from a different account gives us
// 	// Error: Can not sign transactions for account maix2.testnet on network testnet, no matching key pair found in InMemorySigner(InMemoryKeyStore).
// 	const key_pair = KeyPair.fromString(private_key);
// 	const key_store = new keyStores.InMemoryKeyStore();
// 	key_store.setKey("testnet", "maix2.testnet", key_pair);
//
// 	// console.log(key_store.toString())
//
// 	const config = {
// 		networkId: "testnet",
// 		keyStore: key_store,
// 		nodeUrl: "https://rpc.testnet.near.org",
// 		walletUrl: "https://wallet.testnet.near.org",
// 		helperUrl: "https://helper.testnet.near.org",
// 		explorerUrl: "https://explorer.testnet.near.org",
// 	};
//
// 	// sends NEAR tokens
// 	const near = await connect(config);
// 	const account = await near.account("maix2.testnet");
// 	const outcome = await account.sendMoney(
// 		"maix.testnet", // receiver account
// 		`2${'0'.repeat(24)}` // amount in yoctoNEAR meaning 10^-24 NEAR
// 	);
//
// 	console.log(outcome)
//
// 	res.send("Hello from Firebaseasdasd!");
// });
//
// exports.view = functions.https.onRequest(async (req, res) => {
//
// 	// This key can be found in the browser local storage when you are logged in to https://wallet.testnet.near.org/
// 	const private_key = "ed25519:2uQXpkXWPG9Ybfy5CTirR5NcGP287ESzFQaNz6e4NjbYVQ732rdCTpaBGesyshBdagTZJhr2w5ASUaghZcxRM33t"; //full access
// 	const key_pair = KeyPair.fromString(private_key);
// 	const key_store = new keyStores.InMemoryKeyStore(key_pair);
// 	key_store.setKey("testnet", "maix2.testnet", key_pair);
//
// 	const config = {
// 		networkId: "testnet",
// 		keyStore: key_store,
// 		nodeUrl: "https://rpc.testnet.near.org",
// 		walletUrl: "https://wallet.testnet.near.org",
// 		helperUrl: "https://helper.testnet.near.org",
// 		explorerUrl: "https://explorer.testnet.near.org",
// 	};
//
// 	// sends NEAR tokens
// 	const near = await connect(config);
// 	const account = await near.account("maix2.testnet");
// 	const outcome =await account.sendMoney(
// 		"maix.testnet", // receiver account
// 		"1000000000000000000000000" // amount in yoctoNEAR
// 	);
//
// 	console.log(outcome)
//
// 	res.send("Hello from Firebaseasdasd!");
// });


async function exampleDBReadWrite() {
	const docRef = db.collection('users').doc('alovelace');
	let result = await docRef.set({
		first: 'Ada',
		last: 'Lovelace',
		born: 1815
	});
	console.log("Result: ", result);

	const snapshot = await db.collection('users').get();
	snapshot.forEach((doc) => {
		console.log("User: ", doc.id, '=>', doc.data());
	});

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

	return err_msg
}
async function getContractByAccountAndPublicKey(slack_username, near_account, public_key) {
	let contract = ''

	let slack_user_key = createUserDocId(slack_username)
	let near_acc_key = createUserDocId(near_account)

	let user = await db.collection('users').doc(slack_user_key).get()

		if (user && user.near && user.near[near_acc_key] && user.near[near_acc_key].contracts) {
			let contracts = user.near[near_acc_key].contracts
			for (let contract_key in contracts){
				let contract_obj = user.near[near_acc_key].contracts[contract_key]
				if (contract_obj.public_key === public_key) {
					contract = contract_obj
					break
				}
			}
		} else {
			for (let acc_key in user.near){
				let contracts = user.near[acc_key].contracts
				for (let contract_key in contracts){
					let contract_obj = user.near[acc_key].contracts[contract_key]
					if (contract_obj.public_key === public_key) {
						contract = contract_obj
						await user.update({ ['near.'+near_acc_key+'.contracts'+'.'+contract_key]: {
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
	console.log('parseSlackPayload payload', payload);
	// console.log('slackHook payload.payload', payload.payload);
	if(payload.payload) {
		payload2 = JSON.parse(payload.payload);
		console.log('slackHook payload.callback_id', payload2.callback_id);

		if(payload2.user) { //In case of coming from Interactive buttons username is located in a different place ...
			payload = {...payload2}
			fl.log('slackHook 2payload: ', payload);
			payload.user_name = payload2.user.name;
			console.log('slackHook payload.user_name', payload.user_name);
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
	// console.log('commands_array1', commands_array)

	if (commands_array[0] === 'call' && commands_array[3]){
		// Parsing JSON arguments Input
		if(commands_array[3].charAt(0) !== '{')
			return Promise.reject('Invalid Arguments, please check /near help call')

		//Parsing call function JSON arguments
		let first_json_index = commands.indexOf('{')
		let last_json_index = commands.indexOf('}')+1
		let json_str = commands.slice(first_json_index, last_json_index)
		try {
			JSON.parse(json_str);
		} catch (e) {
			return Promise.reject('Arguments are not a valid JSON')
		}
		commands = commands.replace(commands.substring(first_json_index, last_json_index+2), '')
		commands_array = commands.split(' ')
		commands_array.splice(2,0, json_str)
	}
	console.log('commands_array3', commands_array)
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
		console.time('account db.collection(users)')
		let user = (await db.collection('users').doc(slack.createUserDocId(user_name)).get()).data()
		if(!user.near_account) {
			let response = {
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
			return Promise.reject(response)
		}
		console.timeEnd('account db.collection(users)')
		return user.near_account
	} catch (e) {
		return Promise.reject(e)
	}
}
