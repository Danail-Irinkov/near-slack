# near-slack
##Integration of NEAR protocol with Slack
With this integration Slack users are able to access most features of the NEAR Protocol

### Demo

### NEAR features:
* Create Account
* Login
* Account Info
* Balance
* Send Tokens
* Parsing Contract Methods
* Call Contract Methods
* Get Results from RPC query by transaction Hash
* NEAR Postgres SQL indexer for transaction List

### Slack features:
* Slash Commands
* Interactive Messages/Actions
* Block Kit
* App Installation Auth
* Slack Request Auth

## Tech Stack
* Firebase Functions
* Firebase Hosting
* Firebase Firestore
* Node.js
* Vue3
* Vite

## Documentation References
https://www.near.university/
https://examples.near.org/
https://docs.near.org/docs/api/javascript-library
https://github.com/near/near-api-js
https://github.com/encody/near-contract-parser
https://github.com/near/near-indexer-for-explorer
https://api.slack.com/interactivity/slash-commands
https://api.slack.com/interactivity/components
https://api.slack.com/block-kit
https://slack.dev/node-slack-sdk/
https://github.com/firebase/firebase-admin-node
https://github.com/firebase/firebase-functions
https://github.com/googleapis/nodejs-pubsub

## Challenges and Solutions
1. Security
    * Being non-Custodial - We avoided having NEAR Full Access keys on the system to eliminate most safety concerns. All transactions require the user to go through the official NEAR website.
    * Authenticating incoming requests - ```validateRequest()``` - W**e are using the Slack Request hashes to make sure that the commands are coming from an authenticated Slack user

2. Executing NEAR Transactions and Change Methods, without having Full Access Keys in the App
    * There are a lot of redirects needed to accomplish the desired flow
    * Slack -> Backend -> Slack -> NEAR -> Backend -> Slack
    * This means including a lot of meta into most URLs
    * redirect_url, response_url, callbackURL, slack_username, team_domain, channel_id, commands, receiverId, amount
    * ``` generateWalletLoginURL() ``` - Generates a URL for a button in Slack that starts the initial Login flow
    * ``` generateSignTransactionURL() ``` - Generates a URL that signs a transaction, that we have prepared with ```generateTransaction```

3. Getting logs and results from the Contract Functions
    * In the case of View Functions and deposit-less Change Functions the result is easy to get with a simple async call
    * But when there is a deposit involved and a redirects to NEAR and back, we had to use the NEAR RPC to ge information about the Transaction
    * ```queryTransactionHash()``` -> transaction.receipts_outcome[0].outcome.status.SuccessValue (that is a base64 encoded string, of what the function returns)

4. Handling NEAR Function Call Access Keys(FC)
    * Each slack user can call Functions on different contracts
    * Each FC is scoped for one NEAR account and one Contract (and has an allowance of 0.25 NEAR)
    * This means that one Slack user might have multiple NEAR accounts calling multiple Contracts
    * We need to generate and store all these FC keys, so that users can call Functions without friction

5. Querying NEAR Account's Transactions
    * In order to display a list of Transactions, we had to use the NEAR Postgres SQL Indexer
    * Directly querying the RPC requires us to process ALL blocks between two specific dates
    * Blocks on NEAR occur every second, which renders this method completely impractical
    * However, using the postgres SQL index we can quickly serve an approximate list of transactions, with a redirection link to the NEAR Explorer for blockchain confirmation

6. Handling the different Slack Payloads from Slash Commands, Interactive Messages and Block Kit
    * ``` parseSlackPayload() ``` - Standardizes the different payloads
    * ``` parseSlackCommands() ``` - Extracts the relevant command input from Slack

7. Meeting the 3-second response limit of Slack
    * The limit includes ping times, which tend to vary, but I found the actual limit for backend processing is maximum 2 sec
    * When executing async requests to NEAR, this limit is breached
    * In these cases we have to respond to slack with status 200 and then use the response_url to send messages to the chat
    * However, in Firebase, once a response is sent, the function is marked for garbage collection, thus we cannot do any further computation
    * This forced the use of Google PubSub functions, which run in the background and are a bit tricky to use
   
# Project Structure

# Deployment
## Install Dependencies
```
yarn
```

## Frontend App
Dev server
```
yarn dev
```

Production server test
```
yarn serve
```

Production build static files
```
yarn build
```

## Functions Emulator Workflow
```
yarn apie
```
Then test function with this URL in your browser/Postman
http://localhost:5001/near-api-1d073/us-central1/helloWorld
http://localhost:5001/near-api-1d073/us-central1/slackOauth?code=2726521633969.2873201781250.b6a168a805429b0f10c75ff73f85c748ac614dac3294e8c673f96627cf7c8287&state=

## Deployment
npm install -g firebase-tools
