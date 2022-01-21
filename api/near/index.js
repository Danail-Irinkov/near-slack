const { connect: nearConnect, utils, providers, keyStores, KeyPair, transactions} = require('near-api-js')
const { parseContract } = require('near-contract-parser');
const config = require('./config')
const {transfer, createTransaction, functionCall} = require('near-api-js/lib/transaction');
const pg = require('../pgDB');

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
		// console.log('generateWalletLoginURL Start', payload.user_name, near_account)
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
		// console.log('generateWalletLoginURL requestSignIn Start', redirect_url)

		// const currentUrl = new URL(window.location.href);
		let login_url = options.walletUrl + '/login/'
		login_url +='?success_url='+encodeURIComponentForFirebase(redirect_url)
		// login_url +='&failure_url='+redirect_url

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
			// console.log('generateWalletLoginURL public_key: ' + public_key)
			// console.log('generateWalletLoginURL privateKey: ' + private_key)

			login_url +='&contract_id='+contract_name
			login_url +='&public_key='+accessKey.getPublicKey().toString()
		}

		if (method_names.length) {
			method_names.forEach(methodName => {
				login_url +='&methodNames='+String(methodName)
			});
		}

		// console.log('generateWalletLoginURL login_url: '+login_url)
		return login_url
	}catch (e) {
		fl.log('generateWalletLoginURL Err: '+e)
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
	// console.log(`Keys for account ${options.accountId}`, accessKeys);
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
		// fl.log("queryTransactionHash Start: ", {txHash, accountId});
		let network = getNetworkFromAccount(accountId)
		const provider = new providers.JsonRpcProvider(
			{ url: `https://archival-rpc.${network}.near.org`}
		);

		const result = await provider.txStatus(txHash, accountId);
		// console.log("transaction Result: ", result.receipts_outcome[0].outcome);
		// console.log("transaction Result.transaction: ", result.transaction);
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

async function queryTransactions(options) {
	const query = options.networkId === 'testnet' ? pg.queryTestnet : pg.queryMainnet;
	return query(`
		SELECT transactions.transaction_hash, converted_into_receipt_id, block_timestamp, signer_account_id, receiver_account_id, action_kind, args 
		FROM (
			SELECT transactions.transaction_hash, converted_into_receipt_id, block_timestamp, signer_account_id, receiver_account_id 
			FROM transactions
			WHERE signer_account_id = $1 OR receiver_account_id = $1
			ORDER BY block_timestamp DESC 
			LIMIT 5 OFFSET $2
		) as transactions
		LEFT JOIN transaction_actions 
		ON transactions.transaction_hash = transaction_actions.transaction_hash`,
		[options.accountId, options.offset]
	);
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
	queryTransactions,
}
