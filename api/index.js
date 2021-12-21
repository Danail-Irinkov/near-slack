const { getAnalytics } = require('firebase/analytics');
const functions = require("firebase-functions");
const { initializeApp, applicationDefault, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');
const near = require("./near-cli");

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
const db = getFirestore();

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

exports.slackHook = functions.https.onRequest(async (req, res) => {
	console.log('slackHook query', req.query)
	console.log('slackHook body', req.body)
	let params = String(req.body).split(' ')

	let response = {message: "Hello from slackHook!"}
	switch (params[0]) {
		case 'login':
			response = await near.login()
			break
	}

	res.send(response);
})

