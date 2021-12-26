export default {
	getConfig (network, contract_name = null) {
		switch (network) {
			case 'production':
			case 'mainnet':
				return {
					networkId: 'mainnet',
					nodeUrl: 'https://rpc.mainnet.near.org',
					contractName: contract_name,
					walletUrl: 'https://wallet.near.org',
					helperUrl: 'https://helper.mainnet.near.org'
				}
			case 'development':
			case 'testnet':
				return {
					networkId: 'testnet',
					nodeUrl: 'https://rpc.testnet.near.org',
					contractName: contract_name,
					walletUrl: 'https://wallet.testnet.near.org',
					helperUrl: 'https://helper.testnet.near.org'
				}
			default:
				throw Error(`Unconfigured environment '${env}'. Can be configured in src/config.js.`)
	}
}
}
