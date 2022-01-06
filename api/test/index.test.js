const path = require('path')
const service_account_key_path = path.resolve('near-api-1d073-beca07097e06.json')
const test =  require('firebase-functions-test')({
	databaseURL: `https://${process.env.GCLOUD_PROJECT}.firebaseio.com`,
	storageBucket: `${process.env.GCLOUD_PROJECT}.appspot.com`,
	projectId: `${process.env.GCLOUD_PROJECT}`,
}, service_account_key_path);

// Access env config
// const functions = require('firebase-functions');
// const key = functions.config().stripe.key;
// Mock functions config values
// test.mockConfig({ stripe: { key: '23wr42ewr34' }});

const admin = require('firebase-admin');
const functions = require('firebase-functions');
const chai = require('chai');// Chai is a commonly used library for creating unit test suites. It is easily extended with plugins.
const assert = chai.assert;
const sinon = require('sinon'); // Sinon is a library used for mocking or verifying function calls in JavaScript.

const slackHookData = {
	user_name: 'procc.main',
	command: '/near',
	team_domain: 'proccmaingmai-tc79872',
	token: 'gh18PaaAfvc2I0W7SJzcPOkY',
	channel_id: 'D02RZHPUWHF',
	trigger_id: '2898159688640.2726521633969.939b92e730bde0c5050b4d579d3bf99d',
	channel_name: 'directmessage',
	api_app_id: 'A02RLUK9PFV',
	is_enterprise_install: false,
	user_id: 'U02MPHH5FC0',
	text: 'help',
	team_id: 'T02MCFBJMUH',
	response_url: 'https://hooks.slack.com/commands/T02MCFBJMUH/2867751902902/UGlFPuHJFzqWb9w3tSjvfFQU'
}

describe('Slack Cloud Functions', () => {
	let myFunctions
	let testSlackCall1

	before(() => {
		if (process.env.HIDE_LOGS) {
			sinon.stub(console, 'log')
			sinon.stub(functions.logger, 'log')
		}
		myFunctions = require('../index');
		// testSlackCall1 = require('./call1.test.js');
	});

	after(() => {
		// Do cleanup tasks.
		if (process.env.HIDE_LOGS) {
			console.log.restore()
			functions.logger.log.restore()
		}
		test.cleanup();
	});

	// delete personal data

	// describe("Call123", require('./call.test.js').bind(this));
	let payload, commands

	describe('Testing DB access health', () => {
		it('Success', async () => {
			try {
				let res = await testHTTPFunction(myFunctions, 'healthDB')
				console.log('Testing DB access health res: ', res)
				assert.isTrue(!!(
					// res.write
					// && res.doc.exists
					// && res.deletion
					res.deletion
					// && !res.deleted_doc.exists
				))
			}catch (e) {
				return Promise.reject(e)
			}
		})
	})

	describe('/near create', () => {
		it('should return slack response object', async () => {
			try {
				let res = await testHTTPFunction(myFunctions, 'slackHook', 'create')
				console.log('/near create', res)
				assert.isTrue(!!(res.text && res.attachments && res.attachments[0] && res.attachments[0].actions && res.attachments[0].actions.length))
			}catch (e) {
				return Promise.reject(e)
			}
		})
	})
	describe('/near delete personal data', () => {
		it('should return slack response object', async () => {
			try {
				let res = await testHTTPFunction(myFunctions, 'slackHook', 'delete personal data')
				console.warn('/near delete personal data', res)
				// assert.isTrue(!!(res.text && res.attachments && res.attachments[0] && res.attachments[0].actions && res.attachments[0].actions.length))
			}catch (e) {
				return Promise.reject(e)
			}
		})
	})
	describe('/near call devtest.testnet sayHi', () => {
		it('should return slack response object', async () => {
			try {
				let res = await testHTTPFunction(myFunctions, 'slackHook', 'call devtest.testnet sayHi', {add_payload_and_commands: true})
				console.log('/near call devtest.testnet sayHi', res)
				// extract payload and commands
				payload = {...res.payload}
				commands = [...res.commands]
				delete res.payload
				delete res.commands

				// Assert code
				console.log('Response slackHook', res)
				assert.deepStrictEqual(res,
					{
						text: 'Processing Function Call...',
						response_type: 'ephemeral'
					})

				console.log('\nResponse payload', payload)
				console.log('Response payload\n')
				assert.isTrue(!!payload.user_name)
				assert.isTrue(!!payload.team_domain)
				assert.isTrue(!!payload.token)
				assert.isTrue(!!payload.response_url)

				console.log('\nResponse commands', commands)
				console.log('Response commands\n')
				assert.isTrue(commands.indexOf('devtest.testnet') === 1)
				assert.isTrue(commands.indexOf('sayHi') === 2)
			}catch (e) {
				return Promise.reject(e)
			}
		})
	})

	// PubSub Test Disabled due taking too long, cuz of NEAR request need to stub it
	// describe('/near call devtest.testnet sayHi-> PubSub', () => {
	// 	before(() => {
	// 			sinon.stub(global, 'sendDataToResponseURL')
	// 	});
	//
	// 	after(() => {
	// 		global.sendDataToResponseURL.restore()
	// 	});
	//
	// 	it('should return success', async () => {
	// 		try {
	// 			const messageObject = {
	// 				payload: payload,
	// 				commands: commands
	// 			};
	// 			console.log('\nResponse messageObject', messageObject)
	// 			console.log('Response messageObject\n')
	//
	// 			let res = await myFunctions.slackCallContractFlow.run(messageObject, {})
	// 			console.log('slackCallContractFlow res', res)
	// 			if (res.text)
	// 				return Promise.resolve(res.text)
	// 			else
	// 				throw res
	//
	// 		} catch (e) {
	// 			console.error('slackCallContractFlow err', e)
	// 			return Promise.reject(e)
	// 		}
	// 	});
	// })

	describe('/near view devtest.testnet whoSaidHi', () => {
		it('should return slack response object', async () => {
			try {
					let res = await testHTTPFunction(myFunctions, 'slackHook', 'view devtest.testnet whoSaidHi')
					console.log('Response /near view devtest.testnet whoSaidHi', res)
					assert.isTrue(!!res.text && res.text.indexOf('whoSaidHi') !== -1)
			} catch (e) {
				return Promise.reject(e)
			}
		});
	})

	describe('/near balance', () => {
		it('returns slack response object', async () => {
			try {
				let res = await testHTTPFunction(myFunctions, 'slackHook', 'balance')
				console.log('Response /near balance', res)
				assert.isTrue(!!res.text)
			} catch (e) {
				return Promise.reject(e)
			}
		});
	})

	describe('/near contract devtest.testnet', () => {
		it('returns slack response object', async () => {
			try {
				let res = await testHTTPFunction(myFunctions, 'slackHook', 'contract devtest.testnet')
				console.log('Response /near contract devtest.testnet', res)
				assert.isTrue(!!(res.text && res.attachments && res.attachments[0] && res.attachments[0].actions && res.attachments[0].actions.length))
			} catch (e) {
				return Promise.reject(e)
			}
		});
	})

	describe('/near contract devtest_fake.testnet', () => {
		it('returns slack response object', async () => {
			try {
				let res = await testHTTPFunction(myFunctions, 'slackHook', 'contract devtest_fake.testnet')
				console.log('Response /near contract devtest_fake.testnet', res)
				assert.isTrue(!!(res.text && res.text.indexOf('Account Does Not Exist') !== -1))
			} catch (e) {
				return Promise.reject(e)
			}
		});
	})
})


// function importTest(name, path) {
// 	describe(name, function () {
// 		require(path).bind(this);
// 	});
// }

function testHTTPFunction(myFunctions, function_name, params, manual_request = {}, manual_response = {}) {
	return new Promise((resolve, reject) => {
		try {
			const req = {
				body: {
					...slackHookData,
					text: params
				},
				...manual_request
			};
			// A fake response object, with a stubbed redirect function which does some assertions
			const res = {
				set: (a, b) => {},
				end: () => {},
				send: (res) => {
					resolve(res);
				},
				...manual_response
			};

			myFunctions[function_name](req, res);
		} catch (e) {
			reject(e)
		}
	});
}
