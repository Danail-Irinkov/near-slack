process.env.GCLOUD_PROJECT = 'near-api-1d073'
const { getAnalytics } = require('firebase/analytics')
const { initializeApp } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const functions = require('firebase-functions')

const firebaseConfig = {
	apiKey: "AIzaSyCL0TqPIAx-HOb12mWeS7iP_uB-RMYfm1w",
	authDomain: "near-api-1d073.firebaseapp.com",
	projectId: "near-api-1d073",
	storageBucket: "near-api-1d073.appspot.com",
	messagingSenderId: "77148669093",
	appId: "1:77148669093:web:0723fee1a7ba423907394c",
	measurementId: "G-DGTKFVLVL2"
};

const firebaseApp = initializeApp(firebaseConfig)
// console.log('BEFORE ERR 2', firebaseApp)
// const analytics = getAnalytics(firebaseApp)
// console.log('BEFORE ERR 3')
const db = getFirestore()
db.settings({ ignoreUndefinedProperties: true })

const slack = require('./slack')(db, functions)
const fl = functions.logger //Logging shortcut

exports.helloWorld = functions.https.onRequest((req, res) => {
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

	let response = {message: "Hello from slackHook!"}
	switch (commands[0]) {
		case 'login':
			// response = await slack.hello()
			response = await slack.login(payload.user_name, payload.token, fl)
			// response = "login"
			break
		case 'help':
			response = 'Help is under development'
			break
		default:
			// fl.log('No such command.');
	}
	res.send(response);
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
