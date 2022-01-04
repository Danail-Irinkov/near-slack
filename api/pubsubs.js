// const functions = require('firebase-functions')
//
// exports.loginPubSub = functions.pubsub.topic('slackLoginFlow').onPublish(async (message) => {
// 	console.log('loginPubSub Start')
// 	// console.log('loginPubSub Start', message)
// 	if (!message.data) return
//
// 	try {
// 		const data = JSON.parse(Buffer.from(message.data, 'base64').toString())
// 		// console.log('loginPubSub data', data)
// 		const payload = data.payload
// 		const commands = data.commands
// 		// console.log('loginPubSub payload', payload)
// 		// console.log('loginPubSub commands', commands)
//
// 		let login_data = await slack.login(payload, commands, fl)
// 		fl.log('slack.login Success Start'+JSON.stringify(login_data))
//
// 		await sendDataToResponseURL(payload.response_url, login_data)
// 	} catch (e) {
// 		fl.log('loginPubSub err: '+JSON.stringify(e))
// 	}
// })
//
// exports.slackCallContractFlow = functions.pubsub.topic('slackCallContractFlow').onPublish(async (message) => {
// 	console.log('slackCallContractFlow PubSub Start')
// 	// console.log('loginPubSub Start', message)
// 	if (!message.data) return
//
// 	try {
// 		const data = JSON.parse(Buffer.from(message.data, 'base64').toString())
// 		// console.log('loginPubSub data', data)
// 		const payload = data.payload
// 		const commands = data.commands
// 		// console.log('loginPubSub payload', payload)
// 		// console.log('loginPubSub commands', commands)
//
// 		let call_res = await slack.call(payload, commands, fl)
// 		fl.log('slackCallContractFlow after Call', )
//
// 		await sendDataToResponseURL(payload.response_url, call_res)
// 	} catch (e) {
// 		fl.log('slackCallContractFlow err: '+JSON.stringify(e))
// 	}
// })
