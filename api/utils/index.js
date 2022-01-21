const axios = require('axios')

const testUserDbSnapshot = {
	api_app_id:	"A02RLUK9PFV",
	channel_name:	"near-test1",
	near: {
		dan21_1testnet: {
			contracts: {
				devtest1_1testnet: {
					contract_name: "devtest.testnet",
					private_key: "ed25519:64zKWH3aZLcJUSTqE4UyyUHdoJ8846jhHGfRZ4NjaXxT1a2QspYT8ZMSStw3BN64W2poAG91kcw3uY1k6BQQhktE",
					public_key: "ed25519:A1AXx2oLHhMKrHpd7c8Kcr3E1bzuLtmLhQKPpPPdqydp",
					status: "active",
				}
			},
			near_account: "dan2.testnet",
		},
	},
	near_account:	"dan2.testnet",
	near_account_last: "danail.testnet",
	near_fn_key: "ed25519:As4umurSTn79ZpNNxgnarBYhqtbC3LQXHWSJ1tQqNU42",
	slack_token: "gh18PaaAfvc2I0W7SJzcPOkY",
	slack_username:	"procc.main_test",
	team_domain: "proccmaingmai-tc79872",
	team_id: "T02MCFBJMUH"
}

async function setupTestDBUser(req, res) {
	try {
		// console.log("setupTestDBUser Start: ", req?.query);
		let write, deletion, doc
		if (req?.query?.add_test_user) {
			const docRef = db.collection('users').doc('procc1_1main_test');
			write = await docRef.set(testUserDbSnapshot);
			// console.log("setupTestDBUser write: ", write);
		}
		if (req?.query?.get_test_user) {
			doc = await db.collection('users').doc('procc1_1main_test').get();
			// console.log("setupTestDBUser user: ", doc.id, '=>', doc.data());
		}
		if (req?.query?.delete_test_user) {
			deletion = await db.collection('users').doc('procc1_1main_test').delete()
			// console.log("setupTestDBUser deletion: ", deletion);
		}

		return {
			write,
			doc,
			deletion
		}
	} catch (e) {
		console.warn("setupTestDBUser err: ", e);
		return Promise.reject(e)
	}

}

function validateNEARAccount(account) {
	// TODO: after the dot we should check for either testnet or mainnet

	// console.log('before validateNEARAccount')
	return /[a-z0-9]*\.(near|testnet)/.test(account)
}

function sendDataToResponseURL(response_url, data) {
	if (process.env.IS_TEST) return 'Axios Call Mocked'
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
	else if (typeof e === 'object' && e.text)
		err_msg = e

	let err_obj = e?.text ? err_msg : { text: err_msg }
	err_obj.delete_original = true

	return err_obj
}
async function getContractByAccountAndPublicKey(slack_username, near_account, public_key) {
	let contract = {}

	fl.log('getContractByAccountAndPublicKey 1 public_key', public_key)
	let slack_user_key = createUserDocId(slack_username)
	let near_acc_key = createUserDocId(near_account)

	let userDoc = await db.collection('users').doc(slack_user_key).get()
	let user = userDoc.data()
	fl.log('getContractByAccountAndPublicKey 1 slack_user_key', slack_user_key)
	fl.log('getContractByAccountAndPublicKey 1 near_acc_key', near_acc_key)
	if (user && user.near && user.near[near_acc_key] && user.near[near_acc_key].contracts) {
		let contracts = user.near[near_acc_key].contracts
		fl.log('getContractByAccountAndPublicKey 2 contracts', contracts)
		for (let contract_key in contracts){
			let contract_obj = user.near[near_acc_key].contracts[contract_key]
			fl.log('getContractByAccountAndPublicKey 2 contract_obj', contract_obj)
			if (contract_obj.public_key === public_key) {
				contract = contract_obj
				break
			}
		}
	} else {
		for (let acc_key in user.near){
			let contracts = user.near[acc_key].contracts
			fl.log('getContractByAccountAndPublicKey 3', contracts)
			for (let contract_key in contracts){
				let contract_obj = user.near[acc_key].contracts[contract_key]
				if (contract_obj.public_key === public_key) {
					contract = contract_obj
					await userDoc.update({ ['near.'+near_acc_key+'.contracts'+'.'+contract_key]: {
							...contract_obj,
							status: 'active'
						} })
					break
				}
			}
		}
	}

	return { user, contract }
}

function parseSlackPayload(req) {
	let payload = {...req.body};
	let payload2 = {}
	// fl.log('parseSlackPayload payload', payload);
	// console.log('slackHook payload.payload', payload.payload);
	if(payload.payload) {
		payload2 = JSON.parse(payload.payload);
		// fl.log('slackHook payload.callback_id', payload2.callback_id);
		payload = {...payload2}

		if(payload2.user) { //In case of coming from Interactive buttons username is located in a different place ...
			payload.user_name = payload2.user.name;
		}
		if(payload2.container) { //In case of coming from Interactive buttons username is located in a different place ...
			payload.channel_id = payload2.container.channel_id;
		}
		if(payload2.team) { //In case of coming from Interactive buttons username is located in a different place ...
			payload.team_domain = payload2.team.domain;
			payload.team_id = payload2.team.id;
		}
	}
	return payload
}

async function parseSlackCommands(payload) {
	let commands = String(payload.text);

	// Handling Payload from Interactive Help Menu
	if (payload && payload.actions && payload.actions[0]) {
		if(payload.actions[0].selected_options && payload.actions[0].selected_options[0]) {
			// Parsing Commands from Interactive Menu Select
			commands = String(payload.actions[0].selected_options[0].value)
		} else if (payload.actions[0]) {
			// Parsing Commands from Interactive Button
			commands = String(payload.actions[0].value)
		}
	}
	// Handling Payload from Interactive Help Menu - END
	commands = commands.replace('  ', ' ')
	let commands_array = commands.split(' ')
	fl.log('commands_array1', commands_array)

	if (commands_array[0] === 'call' && commands_array[3]){
		// Parsing JSON arguments Input

		//Parsing call function JSON arguments
		let first_json_index = commands.indexOf('{')
		let last_json_index = commands.indexOf('}')+1
		let arguments = commands.slice(first_json_index, last_json_index)
		let deposit = commands_array[4] && !Number.isNaN(commands_array[commands_array.length - 1]) ? String(commands_array[commands_array.length - 1]) : '0'

		if(commands_array[3] === 'add') {
			// Inject slack input fields into commands
			arguments = payload?.state?.values?.call_arguments?.plain_input_arguments?.value || '{}'
			deposit = payload?.state?.values?.call_deposit?.plain_input_deposit?.value || '0'
		}	else if(commands_array[3] === 'skip') {
			// Inject slack input fields into commands
			arguments = '{}'
			deposit = '0'
		}	else if(commands_array[3] === 'cancel') {
			// Cancel and Delete Interractive BLocks
			arguments = 'cancel'
			deposit = '0'
		}
		else if(commands_array[3].charAt(0) !== '{') {
			return Promise.reject('Invalid Function Arguments, please check /near help call')
		}
		fl.log('slackHook commands_array3', commands_array)
		fl.log('slackHook arguments', arguments)
		fl.log('slackHook deposit', deposit)

		if(commands_array[3] !== 'cancel') {
			if (!IsJsonString(arguments)) {
				return Promise.reject('Arguments are not a valid JSON')
			}
		}

		commands_array = commands_array.slice(0, 3)
		if(arguments) {
			commands_array.push(arguments)
		}
		if(deposit) {
			commands_array.push(deposit)
		}
		// fl.log('commands.replace1', commands)
		fl.log('commands.spliced', commands_array)
	}
	// fl.log('commands_array final', commands_array)
	return commands_array
}
function IsJsonString(str) {
	try {
		JSON.parse(str);
	} catch (e) {
		return false;
	}
	return true;
}
async function getCurrentNearAccountFromSlackUsername(user_name) {
	try {
		console.time('getCurrentNearAccountFromSlackUsername db.collection(users)')
		let user = (await db.collection('users').doc(slack.createUserDocId(user_name)).get()).data()
		if(!user?.near_account) {
			let response = slack.notLoggedInResponse()
			console.timeEnd('getCurrentNearAccountFromSlackUsername db.collection(users)')
			return Promise.reject(response)
		}
		console.timeEnd('getCurrentNearAccountFromSlackUsername db.collection(users)')
		return user.near_account
	} catch (e) {
		return Promise.reject(e)
	}
}

module.exports = {
	setupTestDBUser,
	validateNEARAccount,
	sendDataToResponseURL,
	formatErrorMsg,
	parseSlackPayload,
	parseSlackCommands,
	IsJsonString,
	getCurrentNearAccountFromSlackUsername
}
