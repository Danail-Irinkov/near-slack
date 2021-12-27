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

		res.header("Location", `https://${process.env.GCLOUD_PROJECT}.firebaseapp.com/slackAuthSuccess.html`).send(302);
	} catch (e) {
		fl.error(e)
		// return res.status(502).end()
		// return res.header("Location", `https://${process.env.GCLOUD_PROJECT}.firebaseapp.com/slackAuthFailed.html`).send(302);
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

	let payload = req.body;
	// fl.log('slackHook payload', payload);
	let commands = String(payload.text).split(' ');
	// fl.log('slackHook commands', commands, count++);
	// fl.log('slackHook commands[0]', commands[0]);

	// fl.log('payload.token', payload.token);

	let response = "Hello from slackHook!"
	switch (commands[0]) {
		case 'login':
			if (!validateNEARAccount(commands[1])) {
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

			response = 'Initializing account...'
			break
		case 'help':
			console.log('before slack.help')
			response = await slack.help(commands)
			break
		default:
			// fl.log('No such command.');
	}

	if(response)
		res.send(response)
	else
		res.end()
})
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
	return /[a-z0-9]*\.[a-z0-9]*/.test(account)
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
