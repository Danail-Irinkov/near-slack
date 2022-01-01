process.env.GCLOUD_PROJECT = 'near-api-1d073'
const { getAnalytics } = require('firebase/analytics')
const { initializeApp, cert } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
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

// const slack = {}
const slack = require('./slack')(db, functions)
const fl = functions.logger //Logging shortcut

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

		res.header("Location", `https://${process.env.GCLOUD_PROJECT}.firebaseapp.com/redirection?status=success&key=slack`).send(302);
	} catch (e) {
		fl.error(e)
		// return res.status(502).end()
		return res.header("Location", `https://${process.env.GCLOUD_PROJECT}.firebaseapp.com/redirection?status=success&key=slack`).send(302);
	}
});

exports.nearLoginRedirect = functions.https.onRequest(async (req, res) => {
	try {
		if(!req.query.account_id || !req.query.all_keys) return res.status(502).end('Missing required fields')
		fl.log(req.query, 'nearLoginRedirect query')

		let { user, doc_id, contract_id } = await getUserByNearAccountAndPublicKey(req.query.account_id, req.query.public_key)
		let userDoc = db.collection('users').doc(doc_id)
		if (req.query.all_keys && req.query.public_key) {
			await userDoc.update({ ['fc_keys.'+contract_id+'.status']: 'active' })

			res.header("Location", `https://${process.env.GCLOUD_PROJECT}.firebaseapp.com/redirection?status=success&key=function&contract_id=${req.query.contract_id}`).send(302);
		} else {
			if(contract_id)
				await userDoc.update({ ['fc_keys.'+contract_id+'.status']: 'failed' })

			res.header("Location", `https://${process.env.GCLOUD_PROJECT}.firebaseapp.com/redirection?status=failure&key=function&contract_id=${req.query.contract_id}`).send(302);
		}
		res.end()
	} catch (e) {
		fl.error(e)
		return res.status(502).end('Oops, this is our fault, NEAR Login Redirect has Failed')
	}
});

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

		await sendDataToResponseURL(payload.response_url, login_data)
	} catch (e) {
		fl.log('loginPubSub err: '+JSON.stringify(e))
	}
});

exports.slackHook = functions.https.onRequest(async (req, res) => {
	// CORS enabled
	res.set('Access-Control-Allow-Origin' , '*');
	res.set('Access-Control-Allow-Methods', 'POST');
	res.set('Access-Control-Allow-Headers', '*');

	try {
		let payload = {...req.body};
		let payload2 = {}
		fl.log('slackHook payload', payload);
		// console.log('slackHook payload.payload', payload.payload);
		if(payload.payload) {
			payload2 = JSON.parse(payload.payload);
			console.log('slackHook payload.callback_id', payload2.callback_id);
			console.log('slackHook payload.callback_id', payload2.callback_id);
		}
		if(payload2.user) { //In case of coming from Interactive buttons username is located in a different place ...
			payload = {...payload2}
			fl.log('slackHook 2payload: ', payload);
			payload.user_name = payload2.user.name;
			console.log('slackHook payload.user_name', payload.user_name);
		}
		let commands = String(payload.text).split(' ');

		// Handling Payload from Interactive Help Menu
		if (payload2 && payload2.actions && payload2.actions[0]) {
			console.log('slackHook payload2.actions[0]', payload2.actions[0]);
			if(payload2.actions[0].selected_options && payload2.actions[0].selected_options[0]) {
				commands = String(payload2.actions[0].selected_options[0].value).split(' ')
			} else if (payload2.actions[0]) {
				console.log('slackHook payload2.actions[0].value', payload2.actions[0].value);
				commands = String(payload2.actions[0].value).split(' ')
			}
		}
		// Handling Payload from Interactive Help Menu - END

		// fl.log('slackHook commands', commands, count++);
		fl.log('slackHook commands', commands);

		// fl.log('payload.token', payload.token);

		let response = "Hello from Slack App. Try a different command or /near help"
		switch (commands[0]) {
			case 'login':
				// if (!validateNEARAccount(commands[1])) {
				// 	response = 'Invalid Near Account'
				// 	break
				// }
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

				response = 'Initializing account...'
				break
			case 'account':
				console.log('before slack.account')
				if (!commands[1]) { // account missing, Getting logged in account for slack user
					console.time('account db.collection(users)')
					let user = await db.collection('users').doc(slack.createUserDocId(payload.user_name)).get()
					console.timeEnd('account db.collection(users)')
					commands.push(user.data().near_account)
				}

				if (!validateNEARAccount(commands[1])) {
					response = 'Invalid Near Account'
					break
				}

				response = await slack.account(payload, commands, fl)
				break
			case 'keys':
				console.log('before slack.keys')
				if (!commands[1]) { // account missing, Getting logged in account for slack user
					console.time('keys db.collection(users)')
					let user = await db.collection('users').doc(slack.createUserDocId(payload.user_name)).get()
					console.timeEnd('keys db.collection(users)')
					commands.push(user.data().near_account)
				}

				if (!validateNEARAccount(commands[1])) {
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
async function getUserByNearAccountAndPublicKey(near_account, public_key) {
	let user = {}
	let doc_id = ''
	let contract_id = ''

	let users = await db.collection('users')
		.where('near_account', '==', near_account)
		.get()

	users.forEach(doc_raw => {
		let doc = doc_raw.data()
		if (doc && doc.fc_keys) {
			for (let contract_name in doc.fc_keys){
				let contract_keys = doc.fc_keys[contract_name]
				for (let network in contract_keys){
					let network_key = contract_keys[network]
					if (network_key.public_key === public_key) {
						contract_id = contract_name+'.'+network
						user = doc
						doc_id = doc_raw.id
						break
					}
				}
			}
		}
	});

	return { user, doc_id, contract_id }
}
