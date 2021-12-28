const { connect: nearConnect, utils, providers, KeyPair, transactions} = require('near-api-js')
// const chalk = require('chalk')
// const inspectResponse = require('./utils/inspect-response')
// const checkCredentials = require('./utils/check-credentials')
// const eventtracking = require('./utils/eventtracking')
const {URL} = require('url')
// const capture = require('./utils/capture-login-success')
// const readline = require('readline')
const verify = require('./utils/verify-account')
const fs = require('fs')
const config = require('./config')
const open = require('open')

async function connect({ keyStore, ...options }) {
	// TODO: Avoid need to wrap in deps
	return await nearConnect({ ...options, deps: { keyStore }});
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

async function viewAccount(options) {
	let near = await connect(options);
	let account = await near.account(options.accountId);
	let state = await account.state();
	if (state && state.amount) {
		state['formattedAmount'] = utils.format.formatNearAmount(state.amount);
	}
	console.log(`Account ${options.accountId}`);
	// console.log(inspectResponse.formatResponse(state));
};
async function scheduleFunctionCall(options) {
	await checkCredentials(options.accountId, options.networkId, options.keyStore);
	const deposit = options.depositYocto != null ? options.depositYocto : utils.format.parseNearAmount(options.deposit);
	console.log(`Scheduling a call: ${options.contractName}.${options.methodName}(${options.args || ''})` +
		(deposit && deposit != '0' ? ` with attached ${utils.format.formatNearAmount(deposit)} NEAR` : ''));

	const near = await connect(options);
	const account = await near.account(options.accountId);
	const parsedArgs = options.base64 ? Buffer.from(options.args, 'base64') : JSON.parse(options.args || '{}');
	console.log('Doing account.functionCall()');
	try {
		const functionCallResponse = await account.functionCall({
			contractId: options.contractName,
			methodName: options.methodName,
			args: parsedArgs,
			gas: options.gas,
			attachedDeposit: deposit,
		});
		const result = providers.getTransactionLastResult(functionCallResponse);
		// inspectResponse.prettyPrintResponse(functionCallResponse, options);
		// console.log(inspectResponse.formatResponse(result));
	} catch (error) {
		switch (JSON.stringify(error.kind)) {
			case '{"ExecutionError":"Exceeded the prepaid gas."}': {
				handleExceededThePrepaidGasError(error, options);
				break;
			}
			default: {
				console.log(error);
			}
		}
	}
}
async function callViewFunction(options) {
	console.log(`View call: ${options.contractName}.${options.methodName}(${options.args || ''})`);
	const near = await connect(options);
	const account = await near.account(options.accountId || options.masterAccount || options.contractName);
	return account.viewFunction(options.contractName, options.methodName, JSON.parse(options.args || '{}'))
}
async function sendMoney (options) {
	await checkCredentials(options.sender, options.networkId, options.keyStore);
	console.log(`Sending ${options.amount} NEAR to ${options.receiver} from ${options.sender}`);
	const near = await connect(options);
	const account = await near.account(options.sender);
	const result = await account.sendMoney(options.receiver, utils.format.parseNearAmount(options.amount));
	// inspectResponse.prettyPrintResponse(result, options);
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
	getNetworkFromAccount,
	getConnectOptions,
	viewAccount,
	scheduleFunctionCall,
	callViewFunction,
	sendMoney,
	deploy,
	login,
}
