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
		it('should return slack response object with buttons', async () => {
			try {
				let res = await testHTTPFunction(myFunctions, 'slackHook', 'delete personal data')
				console.warn('/near delete personal data', res)
				assert.isTrue(!!(
					res.text
					&& res.text.indexOf('WARNING!') !== -1
					&& res.attachments && res.attachments[0]
					&& res.attachments[0].actions
					&& res.attachments[0].actions.length
				))
			}catch (e) {
				return Promise.reject(e)
			}
		})
	})
	describe('/near delete personal data check', () => {
		it('should return slack response object with buttons', async () => {
			try {
				let res = await testHTTPFunction(myFunctions, 'slackHook', 'delete personal data check')
				console.log('/near delete personal data', res)

				assert.isTrue(!!(
					res.text
					&& res.text.indexOf('LAST WARNING') !== -1
					&& res.attachments && res.attachments[0]
					&& res.attachments[0].actions
					&& res.attachments[0].actions.length
				))
			}catch (e) {
				return Promise.reject(e)
			}
		})
	})
	describe('/near call devtest.testnet sayHi', () => {
		it('should return result from sayHi', async () => {
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

	describe('/near call devtest.testnet sayHi {"test_params": "adsasd"} 3', () => {
		it('should return result from sayHi', async () => {
			try {
				let res = await testHTTPFunction(myFunctions,
					'slackHook', 'call devtest.testnet sayHi {"test_params": "adsasd"} 3',
					{add_payload_and_commands: false}
				)

				// Assert code
				console.warn('Response slackHook call with deposit', res)
				console.log('Response /near send maix.testnet maix2.testnet', res.attachments[0]?.actions[0]?.url)

			}catch (e) {
				return Promise.reject(e)
			}
		})
	})

	describe('/near call devtest.testnet whoSaidHi {"test_params2": "adsasd"} 2', () => {
		it('should return result from sayHi', async () => {
			try {
				let res = await testHTTPFunction(myFunctions,
					'slackHook', 'call devtest.testnet whoSaidHi {"test_params2": "adsasd"} 2',
					{add_payload_and_commands: false}
				)

				// Assert code
				console.warn('Response slackHook call with deposit', res)
				console.log('Response /near call devtest.testnet whoSaidHi {"test_params2": "adsasd"} 2', res.attachments[0]?.actions[0]?.url)

			}catch (e) {
				return Promise.reject(e)
			}
		})
	})

	describe('/near view devtest.testnet whoSaidHi', () => {
		it('should return result from whoSaidHi', async () => {
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
		it('returns slack response object with amount', async () => {
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

	describe('/near contract dan2.testnet', () => {
		it('returns `No Contract deployed`', async () => {
			try {
				let res = await testHTTPFunction(myFunctions, 'slackHook', 'contract dan2.testnet')
				// console.warn('Response /near contract dan2.testnet', res)
				assert.isTrue(!!(res.text && res.text.indexOf(`doesn't have a contract deployed`) !== -1))
			} catch (e) {
				return Promise.reject(e)
			}
		});
	})

	describe('/near contract devtest_fake.testnet', () => {
		it('returns `Account Does Not Exist`', async () => {
			try {
				let res = await testHTTPFunction(myFunctions, 'slackHook', 'contract devtest_fake.testnet')
				console.log('Response /near contract devtest_fake.testnet', res)
				assert.isTrue(!!(res.text && res.text.indexOf('Account Does Not Exist') !== -1))
			} catch (e) {
				return Promise.reject(e)
			}
		});
	})

	describe('/near send maix2.testnet 1', () => {
		it('returns some text and a link to sign the transaction', async () => {
			try {
				let res = await testHTTPFunction(myFunctions, 'slackHook', 'send maix2.testnet 1')
				// console.warn('Response /near send maix2.testnet', res)
				// console.log('Response /near send maix.testnet maix2.testnet', res.attachments[0]?.actions[0]?.url)
				assert.isTrue(!!(res.text && res.attachments && res.attachments[0] && res.attachments[0].actions && res.attachments[0].actions.length))
				assert.isTrue(!!(res.attachments[0]?.actions[0]?.url))
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
			let current_timestamp = String(Math.round(Date.now()/1000))
			const req = {
				headers: { // Sample Slack request header
					"x-cloud-trace-context":"84aa81bd3c5a4c67e70cbfa63349c450/8351297077662228663;o=1",
					"function-exeion-id":"b6eax4isrnrv",
					"x-appengine-user-ip":"52.90.135.175",
					"transfer-encoding":"chunked",
					"accept-encoding":"gzip,deflate",
					"user-agent":"Slackbot 1.0 (+https://api.slack.com/robots)",
					"traceparent":"00-84aa81bd3c5a4c67e70cbfa63349c450-73e5c471efd0a0b7-01",
					"x-appengine-timeout-ms":"599999",
					"x-slack-signature":"v0=42c8e35824ac2b9bf66146a326aec2b60d38da1e02caf78371808c73b6242482",
					"x-appengine-country":"US",
					"host":"us-central1-near-api-1d073.cloudfunctions.net",
					"x-appengine-city":"ashburn",
					"x-appengine-https":"on",
					"x-slack-request-timestamp": current_timestamp,
					"x-forwarded-proto":"https",
					"accept":"application/json,*/*",
					"x-appengine-region":"va",
					"x-appengine-citylatlong":"39.043757,-77.487442",
					"forwarded":"for=\"52.90.135.175\";proto=https",
					"x-forwarded-for":"52.90.135.175",
					"content-type":"application/x-www-form-urlencoded",
					"connection":"close",
					"x-appengine-request-log-id":"61d877d100ff0c3fbcf78edf180001737e6365346465323934363565353865643230702d7470000132336232303236653333626332353133356332326561306666653937373938363a31373300010114",
					"x-appengine-defacutult-version-hostname":"ce4de29465e58ed20p-tp.appspot.com"
				},
				body: {// Sample Slack request body
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
			console.warn('testHTTPFunction err: ', e)
			reject(e)
		}
	});
}
