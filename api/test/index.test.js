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

describe('Slack Slash Commands Tests', () => {
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

	describe('Setting Up Test DB User', () => {
		it('Success', async () => {
			try {
				let res = await testHTTPFunction(myFunctions, 'healthDB', '',
					{ query: { add_test_user: true }})
				console.log('Testing DB access health res: ', res)
				assert.isTrue(!!(
					res.write
					// && res.doc.exists
					// && res.deletion
					// res.deletion
					// && !res.deleted_doc.exists
				))
			}catch (e) {
				return Promise.reject(e)
			}
		})
	})

	describe('/near create', () => {
		it('returns a button redirecting to NEAR wallet create', async () => {
			try {
				let res = await testHTTPFunction(myFunctions, 'slackHook', 'create')
				console.log('/near create', res)
				assert.isTrue(!!(res.text && res.attachments && res.attachments[0] && res.attachments[0].actions && res.attachments[0].actions.length))
			}catch (e) {
				return Promise.reject(e)
			}
		})
	})
	describe('/near login', () => {
		it('returns "Initializing account"', async () => {
			try {
				let res = await testHTTPFunction(myFunctions, 'slackHook',
					'login', {add_payload_and_commands: true})
				console.log('/near login', res)
				// extract payload and commands
				payload = {...res.payload}
				commands = [...res.commands]
				delete res.payload
				delete res.commands

				// Assert Payload and Commands
				assert.isTrue(!!payload.user_name)
				assert.isTrue(!!payload.team_domain)
				assert.isTrue(!!payload.token)
				assert.isTrue(!!payload.response_url)
				assert.isTrue(commands.indexOf('login') === 0)

				// Assert code
				assert.isTrue(!!(res.text && res.text.indexOf('Initializing account') !== -1))
			}catch (e) {
				return Promise.reject(e)
			}
		})
	})

	describe('/near login -> PubSub', () => {
		it('returns button to redirect to NEAR wallet Login', async () => {
			try {
				const messageObject = {
					payload: { ...payload, mock_near_request: true },
					commands: commands
				};

				let res = await myFunctions.loginPubSub.run(messageObject, {})
				console.log('loginPubSub res', res)
				assert.isTrue(!!(res.text && res.text.indexOf('Login Successful') !== -1))
			} catch (e) {
				console.error('loginPubSub err', e)
				return Promise.reject(e)
			}
		});
	})

	describe('/near login other_account.testnet', () => {
		it('returns "Initializing account"', async () => {
			try {
				let res = await testHTTPFunction(myFunctions, 'slackHook', 'login other_account.testnet')
				console.log('/near login other_account.testnet', res)
				assert.isTrue(!!(res.text && res.text.indexOf('Initializing account') !== -1))
			}catch (e) {
				return Promise.reject(e)
			}
		})
	})
	describe('/near call devtest.testnet sayHi', () => {
		it('returns interactive input fields for function arguments and deposit', async () => {
			try {
				let res = await testHTTPFunction(myFunctions, 'slackHook',
					'call devtest.testnet sayHi', {add_payload_and_commands: true})
				console.log('/near call devtest.testnet sayHi', res)
				// extract payload and commands
				payload = {...res.payload}
				commands = [...res.commands]
				delete res.payload
				delete res.commands

				// Assert Payload and Commands
				assert.isTrue(!!payload.user_name)
				assert.isTrue(!!payload.team_domain)
				assert.isTrue(!!payload.token)
				assert.isTrue(!!payload.response_url)
				assert.isTrue(commands.indexOf('devtest.testnet') === 1)
				assert.isTrue(commands.indexOf('sayHi') === 2)

				// Assert code
				assert.isTrue(!!res.blocks && !!res.blocks[0] && !!res.blocks[0].text)

			}catch (e) {
				return Promise.reject(e)
			}
		})
	})

	describe('/near call devtest.testnet sayHi -> PubSub', () => {
		it('returns function call result', async () => {
			try {
				const messageObject = {
					payload: { ...payload, mock_near_request: true },
					commands: commands
				};

				let res = await myFunctions.slackCallContractFlow.run(messageObject, {})
				console.log('slackCallContractFlow res', res)
				assert.isTrue(!!(res.text && res.text.indexOf('sayHi():') !== -1))
			} catch (e) {
				console.error('slackCallContractFlow err', e)
				return Promise.reject(e)
			}
		});
	})

	describe('/near call devtest.testnet sayHi {"test_params": "adsasd"} 3', () => {
		it('returns "Contract calls with deposit require your signature"', async () => {
			try {
				let res = await testHTTPFunction(myFunctions,
					'slackHook', 'call devtest.testnet sayHi {"test_params": "adsasd"} 3',
					{add_payload_and_commands: false}
				)

				// Assert code
				console.log('Response slackHook call with deposit', res)
				assert.isTrue(!!(res.text && res.text.indexOf('Contract calls with deposit require your signature') !== -1
					&& res.attachments && res.attachments[0] && res.attachments[0].actions && res.attachments[0].actions.length))

			}catch (e) {
				return Promise.reject(e)
			}
		})
	})

	describe('/near call devtest.testnet whoSaidHi {"test_params2": "adsasd"} 2', () => {
		it('returns "Contract calls with deposit require your signature"', async () => {
			try {
				let res = await testHTTPFunction(myFunctions,
					'slackHook', 'call devtest.testnet whoSaidHi {"test_params2": "adsasd"} 2',
					{add_payload_and_commands: false}
				)

				// Assert code
				console.log('Response slackHook call View-Method whoSaidHi with deposit', res)
				assert.isTrue(!!(res.text && res.text.indexOf('Contract calls with deposit require your signature') !== -1
					&& res.attachments && res.attachments[0] && res.attachments[0].actions && res.attachments[0].actions.length))

			}catch (e) {
				return Promise.reject(e)
			}
		})
	})

	describe('/near view devtest.testnet whoSaidHi', () => {
		it('returns result from whoSaidHi', async () => {
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
		it('returns current NEAR wallet balance', async () => {
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
		it('returns a dropdown menu with the contract\'s methods', async () => {
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
				// console.log('Response /near contract dan2.testnet', res)
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
				// console.log('Response /near send maix2.testnet', res)
				// console.log('Response /near send maix.testnet maix2.testnet', res.attachments[0]?.actions[0]?.url)
				assert.isTrue(!!(res.text && res.attachments && res.attachments[0] && res.attachments[0].actions && res.attachments[0].actions.length))
				assert.isTrue(!!(res.attachments[0]?.actions[0]?.url))
			} catch (e) {
				return Promise.reject(e)
			}
		});
	})

	describe('/near transactions', () => {
		it('returns a list of user transactions', async () => {
			try {
				let res = await testHTTPFunction(myFunctions, 'slackHook', 'transactions')
				console.log('Response /near transactions: ', res?.rows?.length);
				// assert.isTrue(!!(res.text && res.attachments && res.attachments[0] && res.attachments[0].actions && res.attachments[0].actions.length))
				// assert.isTrue(!!(res.attachments[0]?.actions[0]?.url))
			} catch (e) {
				return Promise.reject(e)
			}
		});
	})

	describe('/near logout', () => {
		it('returns "Logged out"', async () => {
			try {
				let res = await testHTTPFunction(myFunctions, 'slackHook', 'logout')
				console.log('/near logout', res)
				assert.isTrue(!!(res.text && res.text.indexOf('Logged out NEAR Account: dan2.testnet') !== -1))
			}catch (e) {
				return Promise.reject(e)
			}
		})
	})

	describe('/near delete personal data', () => {
		it('returns WARNING and Confirm Button', async () => {
			try {
				let res = await testHTTPFunction(myFunctions, 'slackHook', 'delete personal data')
				console.log('/near delete personal data', res)
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
		it('returns LAST WARNING! and Confirm Button', async () => {
			try {
				let res = await testHTTPFunction(myFunctions, 'slackHook', 'delete personal data check')
				console.log('/near delete personal data check', res)
				assert.isTrue(!!(
					res.text
					&& res.text.indexOf('LAST WARNING!') !== -1
					&& res.attachments && res.attachments[0]
					&& res.attachments[0].actions
					&& res.attachments[0].actions.length
				))
			}catch (e) {
				return Promise.reject(e)
			}
		})
	})
	describe('/near delete personal data check force', () => {
		it('returns "Sorry to see you go"', async () => {
			try {
				let res = await testHTTPFunction(myFunctions, 'slackHook', 'delete personal data force')
				console.log('/near delete personal data force', res)
				assert.isTrue(!!(
					res.text
					&& res.text.indexOf('Sorry to see you go') !== -1
				))
			}catch (e) {
				return Promise.reject(e)
			}
		})
	})
	// describe('Deleting Test DB User', () => {
	// 	it('Success', async () => {
	// 		try {
	// 			let res = await testHTTPFunction(myFunctions, 'healthDB', '',
	// 				{ query: { delete_test_user: true }})
	// 			console.log('Testing DB access health res: ', res)
	// 			assert.isTrue(!!(
	// 				// res.write
	// 				// && res.doc.exists
	// 				// && res.deletion
	// 				res.deletion
	// 				// && !res.deleted_doc.exists
	// 			))
	// 		}catch (e) {
	// 			return Promise.reject(e)
	// 		}
	// 	})
	// })

})

// function importTest(name, path) {
// 	describe(name, function () {
// 		require(path).bind(this);
// 	});
// }

const slackHookData = {
	user_name: 'procc.main_test',
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

function testHTTPFunction(myFunctions, function_name, commands, manual_request = {}, manual_response = {}) {
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
					text: commands
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
