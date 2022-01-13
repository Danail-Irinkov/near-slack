const { connect: nearConnect, utils, providers, keyStores, KeyPair, transactions} = require('near-api-js')
const { parseContract } = require('near-contract-parser');
// const chalk = require('chalk')
// const inspectResponse = require('./utils/inspect-response')
// const checkCredentials = require('./utils/check-credentials')
// const eventtracking = require('./utils/eventtracking')
// const capture = require('./utils/capture-login-success')
// const readline = require('readline')
const verify = require('./utils/verify-account')
const fs = require('fs')
const config = require('./config')
const open = require('open')
const getConfig = require('../near/config')
const {transfer, createTransaction, functionCall} = require('near-api-js/lib/transaction');
// const inspectResponse = require('./utils/inspect-response')

// let login_url = 'asd2'
// global.window = { //Mocking window object to capture the URL
// 	localStorage: {
// 		getItem: ()=>'{"allKeys":[]}',
// 		setItem: ()=>'{"asd": "asd"}'
// 	},
// 	location: {
// 		href: '',
// 		assign: (url)=>{
// 			console.log('location.assign URL: ', url)
// 			login_url=url
// 		}
// 	}
// }

async function connect(options) {
	// TODO: Avoid need to wrap in deps
	return await nearConnect(options);
}

function userHasActiveContractFCKey (user, contract_name) {
	let near_acc_key = createUserDocId(user.near_account)
	let contract_key = createUserDocId(contract_name)

	let bool = false
	if (user.near && user.near[near_acc_key]
		&& user.near[near_acc_key].contracts
		&& user.near[near_acc_key].contracts[contract_key]
		&& user.near[near_acc_key].contracts[contract_key].status === 'active'
	)
		bool = true

	return bool
}
function getUserContractFCPrivateKey (user, contract_name) {
	let near_acc_key = createUserDocId(user.near_account)
	let contract_key = createUserDocId(contract_name)
	fl.log('call near_acc_key', near_acc_key)
	fl.log('call contract_key', contract_key)
	fl.log('call getUserContractFCPrivateKey', user.near[near_acc_key].contracts[contract_key])
	return user.near[near_acc_key].contracts[contract_key].private_key
}

async function generateKeyStore(network, account, access_key) {
	try {
		fl.log('generateKeyStore network', network)
		fl.log('generateKeyStore account', account)
		fl.log('generateKeyStore access_key', access_key)
		const keyStore = new keyStores.InMemoryKeyStore()
		const keyPair = KeyPair.fromString(access_key)
		await keyStore.setKey(network, account, keyPair)
		fl.log('generateKeyStore keyStore', keyStore)

		return keyStore
	} catch (e) {
		return Promise.reject(e)
	}
}
function encodeURIComponentForFirebase(str) {
	return encodeURIComponent(str).replace(/[\.\#\$\[\]]/g, function (c) {
		return '%' + c.charCodeAt(0).toString(16);
	});
}
async function generateWalletLoginURL(redirect = 'login', payload = null, near_account, contract_name = null, method_names = []) {
	try {
		console.log('generateWalletLoginURL Start', payload.user_name, near_account)
		let options = getConnectOptions(null,
			getNetworkFromAccount(near_account),
			{
				accountId: near_account,
			})

		let redirect_url = `https://us-central1-near-api-1d073.cloudfunctions.net/nearLoginRedirect/`
		if (payload.user_name) redirect_url+= `?slack_username=${payload.user_name}`
		if (payload.channel_id) redirect_url+= `&channel_id=${payload.channel_id}`
		if (payload.team_domain) redirect_url+= `&team_domain=${payload.team_domain}`
		if (payload.response_url) redirect_url+= `&response_url=${payload.response_url}`
		if (payload.text) redirect_url+= `&text=${payload.text}`
		if (redirect) redirect_url+= `&redirect=${redirect}`
		console.log('generateWalletLoginURL requestSignIn Start', redirect_url)

		// const currentUrl = new URL(window.location.href);
		let login_url = options.walletUrl + '/login/'
		login_url +='?success_url='+encodeURIComponentForFirebase(redirect_url)
		// login_url +='&failure_url='+redirect_url
		login_url +='&context=testString'
		if (contract_name) {
			let userDoc = db.collection('users').doc(createUserDocId(payload.user_name))
			const accessKey = KeyPair.fromRandom('ed25519')
			let public_key = accessKey.getPublicKey().toString()
			let private_key = accessKey.toString()

			let near_acc_key = createUserDocId(near_account)
			let contract_key = createUserDocId(contract_name)
			userDoc.update({
				['near.'+near_acc_key+'.near_account']: near_account,
				['near.'+near_acc_key+'.contracts'+'.'+contract_key+'.public_key']: public_key,
				['near.'+near_acc_key+'.contracts'+'.'+contract_key+'.private_key']: private_key,
				['near.'+near_acc_key+'.contracts'+'.'+contract_key+'.contract_name']: contract_name,
				['near.'+near_acc_key+'.contracts'+'.'+contract_key+'.status']: 'pending',
			})
			console.log('generateWalletLoginURL public_key: ' + public_key)
			console.log('generateWalletLoginURL privateKey: ' + private_key)

			login_url +='&contract_id='+contract_name
			login_url +='&public_key='+accessKey.getPublicKey().toString()
		}

		if (method_names.length) {
			method_names.forEach(methodName => {
				login_url +='&methodNames='+String(methodName)
			});
		}

		console.log('generateWalletLoginURL login_url: '+login_url)
		return login_url
	}catch (e) {
		console.log('generateWalletLoginURL Err: '+e)
		return Promise.reject(e)
	}
}
async function generateSignTransactionURL(options, transaction, context) {
	try {
		const walletUrl = options.walletUrl;
		const signTransactionUrl = new URL('sign', walletUrl);

		// the key names must not be changed because this is what wallet is expecting
		// console.warn('transaction', transaction)
		const searchParams = {
			transactions: Buffer.from(transaction.encode()).toString('base64'),
			meta:	 JSON.stringify(context),
			callbackUrl: 'https://us-central1-near-api-1d073.cloudfunctions.net/nearSignTransactionCallback',
		};

		Object.entries(searchParams).forEach(([key, value]) => {
			signTransactionUrl.searchParams.set(key, value);
		});

		return signTransactionUrl.href;
	} catch (e) {
		return Promise.reject(e)
	}
}
function getNetworkFromAccount(near_account) {
	return near_account.split('.').pop()
}
function getConnectOptions(keyStore, network, additional_options = {}) {
	return {
		...config(network),
		...additional_options,
		deps: { keyStore }
	}
}

async function keys(options) {
	let near = await connect(options);
	let account = await near.account(options.accountId);
	let accessKeys = await account.getAccessKeys();
	console.log(`Keys for account ${options.accountId}`, accessKeys);
	return accessKeys
};

async function account(options) {
	let near = await connect(options);
	let account = await near.account(options.accountId);
	let state = await account.state();
	if (state && state.amount) {
		state['formattedAmount'] = utils.format.formatNearAmount(state.amount);
	}
	// fl.log(`Account ${options.accountId}`, state);
	return state
};
async function balance(options) {
	let near = await connect(options);
	let account = await near.account(options.accountId);
	let state = await account.state();;
	return  'N' + utils.format.formatNearAmount(state.amount || 0 )
};
async function scheduleFunctionCall(options) {
	try {
		fl.log('scheduleFunctionCall Start', options.deposit);
		const deposit = options.depositYocto ? options.depositYocto : options.deposit ? utils.format.parseNearAmount(options.deposit) : 0;

		fl.log('scheduleFunctionCall deposit', deposit);
		const near = await connect(options);
		const account = await near.account(options.accountId);
		fl.log('scheduleFunctionCall options.args', options.args);
		const parsedArgs = options.base64 ? Buffer.from(options.args, 'base64') : JSON.parse(options.args || '{}');
		fl.log('scheduleFunctionCall parsedArgs', parsedArgs);


		console.time('functionCall result');
		let params = {
			contractId: options.contractName,
			methodName: options.methodName,
			args: parsedArgs,
		}
		if (deposit) params.attachedDeposit = deposit

		const functionCallResponse = await account.functionCall(params);
		const result = providers.getTransactionLastResult(functionCallResponse);
		// inspectResponse.prettyPrintResponse(functionCallResponse, options);
		console.timeEnd('functionCall result');
		fl.log('getTransactionLastResult result', result);
		return result
	} catch (e) {
		return Promise.reject(JSON.stringify(e))
	}
}
async function callViewFunction(options) {
	try {
		console.log(`View call: ${options.contractName}.${options.methodName}(${options.args || ''})`);
		const near = await connect(options);
		const account = await near.account(options.accountId || options.masterAccount || options.contractName);
		return account.viewFunction(options.contractName, options.methodName, JSON.parse(options.args || '{}'))
	} catch (e) {
		return Promise.reject(e)
	}
}
async function queryTransactionHash (txHash, accountId) {
	try {
		fl.log("queryTransactionHash Start: ", {txHash, accountId});
		let network = getNetworkFromAccount(accountId)
		const provider = new providers.JsonRpcProvider(
			`https://archival-rpc.${network}.near.org`
		);

		const result = await provider.txStatus(txHash, accountId);
		fl.log("transaction Result: ", result);
		fl.log("transaction Result.transaction: ", result.transaction);
		return result
	} catch (e) {
		return Promise.reject(e)
	}
}
async function generateTransaction (options, action = 'transfer') {
	try {
		// console.warn('generateTransaction options', options)
		const nearConnection = await connect(options)
		const account = await nearConnection.account(options.accountId)

		// We don't need a fullAccessKey to create a transaction, but we need to provide one anyway
		let key = (await account.getAccessKeys())
			.filter(key => key.access_key.permission === 'FullAccess')[0];

		if (key === undefined)
			return `${options.accountId} doens't have any full access keys. Cannot send near.`

		key = utils.key_pair.PublicKey.from(key.public_key);

		let near_action
		if (action === 'transfer')
			near_action = transfer(utils.format.parseNearAmount(options.amount))
		if (action === 'function') {
			near_action = functionCall(options.methodName, JSON.parse(options.args),
			options.gas || "300000000000000",
			utils.format.parseNearAmount(options.deposit))
		}
		// It seems that nonce and block hash can be random values
		const nonce = 7560000005
		const blockHash = [...new Uint8Array(32)].map( _ => Math.floor(Math.random() * 256))
		return createTransaction(options.accountId, key, options.receiverId, nonce, [near_action], blockHash)
	} catch (e) {
		return Promise.reject(e)
	}
}
async function viewContract (options) {
	try {
		const near = await connect(options);
		const { code_base64 } = await near.connection.provider.query({
			account_id: options.accountId,
			finality: 'final',
			request_type: 'view_code',
		});
		return parseContract(code_base64)
	}catch (e) {
		return Promise.reject(e)
	}
}

// TODO: Rework near-cli deploy to work with our backend
async function deploy(options) {
	await checkCredentials(options.accountId, options.networkId, options.keyStore);

	const near = await connect(options);
	const account = await near.account(options.accountId);
	let prevState = await account.state();
	let prevCodeHash = prevState.code_hash;

	if (options.force || await checkExistingContract(prevCodeHash)) {
		console.log(
			`Starting deployment. Account id: ${options.accountId}, node: ${options.nodeUrl}, helper: ${options.helperUrl}, file: ${options.wasmFile}`);

		// Deploy with init function and args
		const txs = [transactions.deployContract(fs.readFileSync(options.wasmFile))];

		if (options.initFunction) {
			if (!options.initArgs) {
				console.error('Must add initialization arguments.\nExample: near deploy --accountId near.testnet --initFunction "new" --initArgs \'{"key": "value"}\'');
				// await eventtracking.track(eventtracking.EVENT_ID_DEPLOY_END, { success: false, error: 'Must add initialization arguments' }, options);
				process.exit(1);
			}
			txs.push(transactions.functionCall(
				options.initFunction,
				Buffer.from(options.initArgs),
				options.initGas,
				utils.format.parseNearAmount(options.initDeposit)),
			);
		}

		const result = await account.signAndSendTransaction({
			receiverId: options.accountId,
			actions: txs
		});
		// inspectResponse.prettyPrintResponse(result, options);
		let state = await account.state();
		let codeHash = state.code_hash;
		// await eventtracking.track(eventtracking.EVENT_ID_DEPLOY_END, { success: true, code_hash: codeHash, is_same_contract: prevCodeHash === codeHash, contract_id: options.accountId }, options);
		// eventtracking.trackDeployedContract();
		console.log(`Done deploying ${options.initFunction ? 'and initializing' : 'to'} ${options.accountId}`);
	}
};
// TODO: Rework near-cli login to work with our backend and skip frontend Connection step
async function login(options) {
	// await eventtracking.askForConsentIfNeeded(options);
	if (!options.walletUrl) {
		console.log('Log in is not needed on this environment. Please use appropriate master account for shell operations.');
		// await eventtracking.track(eventtracking.EVENT_ID_LOGIN_END, { success: true, login_is_not_needed: true }, options);
	} else {
		const newUrl = new URL(options.walletUrl + '/login/');
		const referrer = 'NEAR CLI';
		newUrl.searchParams.set('referrer', referrer);
		const keyPair = await KeyPair.fromRandom('ed25519');
		newUrl.searchParams.set('public_key', keyPair.getPublicKey());

		console.log(`\n{bold.yellow Please authorize NEAR CLI} on at least one of your accounts.`);

		// attempt to capture accountId automatically via browser callback
		let tempUrl;
		const isWin = process.platform === 'win32';

		// find a callback URL on the local machine
		try {
			if (!isWin) { // capture callback is currently not working on windows. This is a workaround to not use it
				// tempUrl = await capture.callback(5000);
			}
		} catch (error) {
			// console.error("Failed to find suitable port.", error.message)
			// TODO: Is it? Try triggering error
			// silent error is better here
		}

		// if we found a suitable URL, attempt to use it
		if (tempUrl) {
			if (process.env.GITPOD_WORKSPACE_URL) {
				const workspaceUrl = new URL(process.env.GITPOD_WORKSPACE_URL);
				newUrl.searchParams.set('success_url', `https://${tempUrl.port}-${workspaceUrl.hostname}`);
				// Browser not opened, as will open automatically for opened port
			} else {
				newUrl.searchParams.set('success_url', `http://${tempUrl.hostname}:${tempUrl.port}`);
				openUrl(newUrl);
			}
		} else if (isWin) {
			// redirect automatically on windows, but do not use the browser callback
			openUrl(newUrl);
		}

		console.log(`\n{dim If your browser doesn't automatically open, please visit this URL\n${newUrl.toString()}}`);

		const getAccountFromWebpage = async () => {
			// capture account_id as provided by NEAR Wallet
			// const [accountId] = await capture.payload(['account_id'], tempUrl, newUrl);
			return accountId;
		};

		// const rl = readline.createInterface({
		// 	input: process.stdin,
		// 	output: process.stdout
		// });
		const redirectAutomaticallyHint = tempUrl ? ' (if not redirected automatically)' : '';
		const getAccountFromConsole = async () => {
			return await new Promise((resolve) => {
				rl.question(
					`Please authorize at least one account at the URL above.\n\n` +
					`Which account did you authorize for use with NEAR CLI?\n` +
					`{bold Enter it here${redirectAutomaticallyHint}:}\n`, async (accountId) => {
						resolve(accountId);
					});
			});
		};

		let accountId;
		if (!tempUrl) {
			accountId = await getAccountFromConsole();
		} else {
			accountId = await new Promise((resolve, reject) => {
				let resolved = false;
				const resolveOnce = (result) => { if (!resolved) resolve(result); resolved = true; };
				getAccountFromWebpage()
					.then(resolveOnce); // NOTE: error ignored on purpose
				getAccountFromConsole()
					.then(resolveOnce)
					.catch(reject);
			});
		}
		// rl.close();
		// capture.cancel();
		// verify the accountId if we captured it or ...
		try {
			const success = await verify(accountId, keyPair, options);
			// await eventtracking.track(eventtracking.EVENT_ID_LOGIN_END, { success }, options);
		} catch (error) {
			// await eventtracking.track(eventtracking.EVENT_ID_LOGIN_END, { success: false, error }, options);
			console.error('Failed to verify accountId.', error.message);
		}
	}
}

async function transactionsCommand(options) {
	const pg = require('../pgDB');
	const query = options.networkId === 'testnet' ? pg.queryTestnet : pg.queryMainnet;
	const res = query(
// prefer using spaces not tabs
`\
SELECT converted_into_receipt_id, block_timestamp, signer_account_id, receiver_account_id, action_kind, args, data \
FROM transactions \
LEFT JOIN transaction_actions \
ON transactions.transaction_hash = transaction_actions.transaction_hash \
RIGHT JOIN data_receipts \
ON transactions.converted_into_receipt_id = data_receipts.receipt_id \
WHERE signer_account_id = $1 OR receiver_account_id = $1 \
`,
		[options.accountId]
	);
	return res;
}

function handleExceededThePrepaidGasError(error, options) {
	console.log(`\nTransaction ${error.transaction_outcome.id} had ${options.gas} of attached gas but used ${error.transaction_outcome.outcome.gas_burnt} of gas`);
	console.log('View this transaction in explorer:', `https://explorer.${options.networkId}.near.org/transactions/${error.transaction_outcome.id}`);
}
// open a given URL in browser in a safe way.
async function openUrl(url) {
	try {
		await open(url.toString());
	} catch (error) {
		console.error(`Failed to open the URL [ ${url.toString()} ]`, error);
	}
}

module.exports = {
	connect,
	userHasActiveContractFCKey,
	getUserContractFCPrivateKey,
	generateKeyStore,
	generateWalletLoginURL,
	generateSignTransactionURL,
	getNetworkFromAccount,
	getConnectOptions,
	keys,
	account,
	balance,
	viewContract,
	scheduleFunctionCall,
	callViewFunction,
	queryTransactionHash,
	generateTransaction,
	deploy,
	login,
	transactionsCommand,
}
