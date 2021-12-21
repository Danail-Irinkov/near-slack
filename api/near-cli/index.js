function userIsLoggedIn(user) {
	let bool = false
	// TODO: check

	return bool
}

function assert(bool, err_msg) {
	if (!bool) return throw new Error(err_msg)
}

exports.login = async function () {
	try {
		// TODO: check if current user is logged in
		// if not -> redirect to login page
		// if yes -> response with 'You are already logged in'
	} catch (e) {
		console.log('near-cli login err: ', e)
		return Promise.reject(e)
	}
}
exports.send = async function (user) {
	try {
		assert(userIsLoggedIn(user), 'Please login')

		// TODO: research what send does?!?

	} catch (e) {
		console.log('near-cli send err: ', e)
		return Promise.reject(e)
	}

}
exports.view = async function () {
	try {

	} catch (e) {
		console.log('near-cli view err: ', e)
		return Promise.reject(e)
	}

}
exports.call = async function () {
	try {

	} catch (e) {
		console.log('near-cli call err: ', e)
		return Promise.reject(e)
	}

}
