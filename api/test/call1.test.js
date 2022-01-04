module.exports = async (myFunctions, slackHookData, assert) => {
	console.warn('myFunctions', myFunctions)
	console.warn('slackHookData', slackHookData)
	let payload, commands
	await describe('/near call devtest.testnet sayHi', () => {
		it('should return slack response object', (done) => {
			// A fake request object, with req.query.text set to 'input'
			const req = {
				body: {
					...slackHookData,
					text: 'call devtest.testnet sayHi'
				},
				query: {text: 'input'}
			};
			// A fake response object, with a stubbed redirect function which does some assertions
			const res = {
				set: (a, b) => {},
				end: () => {},
				send: (res) => {
					console.warn('myFunctions send', res)
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

					console.warn('\nResponse payload', payload)
					console.warn('Response payload\n')
					assert.isTrue(!!payload.user_name)
					assert.isTrue(!!payload.team_domain)
					assert.isTrue(!!payload.token)
					assert.isTrue(!!payload.response_url)

					console.log('\nResponse commands', commands)
					console.log('Response commands\n')
					assert.isTrue(commands.indexOf('devtest.testnet') === 1)
					assert.isTrue(commands.indexOf('sayHi') === 2)
					done();
				}
			};

			myFunctions.slackHook(req, res);
		});
	});


	await describe('/near call devtest.testnet sayHi-> PubSub', () => {
		it('should return success', async () => {
			try {
				const messageObject = {
					payload: payload,
					commands: commands
				};
				console.log('\nResponse messageObject', messageObject)
				console.log('Response messageObject\n')

				let res = await myFunctions.slackCallContractFlow.run(messageObject, {})
				console.log('slackCallContractFlow res', res)
				if (res.text)
					return Promise.resolve(res.text)
				else
					throw res

			} catch (e) {
				console.error('slackCallContractFlow err', e)
				return Promise.reject(e)
			}
		});
	})

	return Promise.resolve()
}
