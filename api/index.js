const { getAnalytics,	isSupported } = require('firebase/analytics');
const functions = require("firebase-functions");
const { initializeApp, applicationDefault, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');
const near = require("./near-slack");
process.env.GCLOUD_PROJECT = 'near-api-1d073'

const firebaseConfig = {
  apiKey: "AIzaSyCL0TqPIAx-HOb12mWeS7iP_uB-RMYfm1w",
  authDomain: "near-api-1d073.firebaseapp.com",
  projectId: "near-api-1d073",
  storageBucket: "near-api-1d073.appspot.com",
  messagingSenderId: "77148669093",
  appId: "1:77148669093:web:0723fee1a7ba423907394c",
  measurementId: "G-DGTKFVLVL2"
};

const firebaseApp = initializeApp(firebaseConfig);
const analytics = initAnalytics();
const db = getFirestore();

async function initAnalytics() {
	if(await isSupported())
		return getAnalytics(firebaseApp);
}
async function f() {
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

exports.helloWorld = functions.https.onRequest((req, res) => {
	res.send("Hello from Firebase!");
});

exports.slackOauth = functions.https.onRequest(async (req, res) => {
	if (req.method !== "GET") {
		console.error(`Got unsupported ${req.method} request. Expected GET.`);
		return res.status(405).send("Only GET requests are accepted");
	}

	if (!req.query && !req.query.code) {
		return res.status(401).send("Missing query attribute 'code'");
	}

	// TODO: configure functions.config().slack.id and secret
	// TODO: refactor to actually make the request to https://slack.com/api/oauth.access
	// TODO: COPY a Success page and mount on FrontEND
	// TODO: HOST frontend on Firebase Hosting

	const options = {
		uri: "https://slack.com/api/oauth.access",
		method: "GET",
		json: true,
		qs: {
			code: req.query.code,
			client_id: functions.config().slack.id,
			client_secret: functions.config().slack.secret,
			redirect_uri: `https://us-central1-${process.env.GCLOUD_PROJECT}.cloudfunctions.net/oauth_redirect`
		}
	};

	const result = await rp(options);
	if (!result.ok) {
		console.error("The request was not ok: " + JSON.stringify(result));
		return res.header("Location", `https://${process.env.GCLOUD_PROJECT}.firebaseapp.com`).send(302);
	}

	await db.collection('installations').doc(result.team_id).set({
		token: result.access_token,
		team: result.team_id,
		webhook: {
			url: result.incoming_webhook.url,
			channel: result.incoming_webhook.channel_id
		}
	});
	res.header("Location", `https://${process.env.GCLOUD_PROJECT}.firebaseapp.com/success.html`).send(302);
});

exports.slackHook = functions.https.onRequest(async (req, res) => {
	console.log('slackHook query', req.query)
	console.log('slackHook body', req.body)
	let payload = String(req.body).split(' ')
	console.log('slackHook payload', payload)

	let response = {message: "Hello from slackHook!"}
	switch (payload[0]) {
		case 'login':
			response = await near.login()
			break
		case 'help':
			response = 'Help is under development'
			break
	}

	res.send(response);
})

