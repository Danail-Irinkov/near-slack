/**
 * For information on how to use node pg go to https://node-postgres.com/features
 */

const { Pool, Client } = require('pg')

const pool_testnet = new Pool({connectionString: 'postgres://public_readonly:nearprotocol@testnet.db.explorer.indexer.near.dev/testnet_explorer'})
const pool_mainnet = new Pool({connectionString: 'postgres://public_readonly:nearprotocol@mainnet.db.explorer.indexer.near.dev/mainnet_explorer'})

async function query(text, params, pool) {
	const start = Date.now()
	const res = await pool.query(text, params)
	const duration = Date.now() - start
	console.log('executed query', { text, duration, rows: res.rowCount })
	return res
}

module.exports = {
	/**
	 * THIS IS A READ-ONLY DATABASE
	 * 
	 * Example text and params: 
	 * ```
	 * const text = 'SELECT * FROM user WHERE id = $1'
	 * const params = [1]
	 * ```
	 * * Take note that params is an array
	 * * Transactions - https://node-postgres.com/features/transactions won't work for that you would need a create a client
	 */
  async queryTestnet(text, params) {
		return query(text,params, pool_testnet);
	},
	/**
	 * THIS IS A READ-ONLY DATABASE
	 * Example text and params:
	 * ```
	 * const text = 'SELECT * FROM user WHERE id = $1'
	 * const params = [1]
	 * ```
	 * * Take note that params is an array
	 * * Transactions - https://node-postgres.com/features/transactions won't work for that you would need a create a client
	 */
  async queryMainnet(text, params) {
		return query(text,params, pool_mainnet);
	},
	// Don't really see a need for a client
  // async getClient() {
  //   const client = await pool.connect()
  //   const query = client.query
  //   const release = client.release
  //   // set a timeout of 5 seconds, after which we will log this client's last query
  //   const timeout = setTimeout(() => {
  //     console.error('A client has been checked out for more than 5 seconds!')
  //     console.error(`The last executed query on this client was: ${client.lastQuery}`)
  //   }, 5000)
  //   // monkey patch the query method to keep track of the last query executed
  //   client.query = (...args) => {
  //     client.lastQuery = args
  //     return query.apply(client, args)
  //   }
  //   client.release = () => {
  //     // clear our timeout
  //     clearTimeout(timeout)
  //     // set the methods back to their old un-monkey-patched version
  //     client.query = query
  //     client.release = release
  //     return release.apply(client)
  //   }
  //   return client
  // }
}

