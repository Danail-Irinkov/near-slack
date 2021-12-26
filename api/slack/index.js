const { InstallProvider } = require('@slack/oauth');
const { firebaseConfig } = require('firebase-functions/v1');

module.exports = function (db, functions) {
	// initialize the installProvider
	const installer = new InstallProvider({
		clientId: functions.config().slack.client_id,
		clientSecret: functions.config().slack.client_secret,
		stateSecret: functions.config().slack.random_encryption_string,
		stateVerification: false,
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


	async function login(user_name, token_slack, fl) {
				
		fl.log("user_name", user_name);
		const doc = await db.collection('users').doc(user_name).get();


		fl.log("doc", doc);

		return "Successfully logged in";
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
	async function view () {
		try {

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

	async function hello () {
		return "Hello from near-cli";
	}

	return {
		installer,
		login,
		send,
		view,
		call,
		hello
	}
}