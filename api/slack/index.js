const { InstallProvider } = require('@slack/oauth');
const { firebaseConfig } = require('firebase-functions/v1');
const nearAPI = require('near-api-js');

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

	function userIsLoggedIn(user) {
		let bool = false
		// TODO: check

		return bool
	}

// function assert(bool, err_msg) { // throw not available in functions
// 	if (!bool) return throw err_msg
// }

	async function login(user, token, fl) {

		fl.log('login user', user);
		fl.log('login token', token);
		
		db.collection('users').doc(user).set({token});
		
		const doc = db.collection('users').doc(user).get();

		if (!doc.exists) {

			const config = {
				networkId: "testnet",
				keyStore: new keyStores.BrowserLocalStorageKeyStore(),
				nodeUrl: "https://rpc.testnet.near.org",
				walletUrl: "https://wallet.testnet.near.org",
				helperUrl: "https://helper.testnet.near.org",
				explorerUrl: "https://explorer.testnet.near.org",
			};

			// connect to NEAR
			const near = await nearAPI.connect(config);
			// create wallet connection
			const wallet = new nearAPI.WalletConnection(near);
			wallet.
			const accountId = this.walletAccount.getAccountId();
		}


		try {
			// TODO: check if current user is logged in
			// if not -> redirect to login page
			// if yes -> response with 'You are already logged in'
		} catch (e) {
			console.log('near-cli login err: ', e)
			return Promise.reject(e)
		}
	}
	async function send(user) {
		try {
			if (userIsLoggedIn(user)) return 'Please login'

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

	return {
		installer,
		login,
		send,
		view,
		call
	}
}

