# NEAR for Slack
This is a demo project built as an assignment from WeLoveNoCode<br /> 
and NEAR Protocol Education.

NEAR for Slack will help you interact with the NEAR Protocol,  <br /> 
however if your actions involve any NEAR token usage,     <br /> 
you will always get redirected to the official NEAR website to sign the transactions.

We cannot guarantee 100% uptime and service availability.<br />
If you want to extend or scale the service to your own needs:

1. Fork the repo, clone and run ```yarn && yarn apii```
2. Create your own Firebase Project
3. Install firebase-cli and run ```firebase login```
4. Create a Slack App and configure it (can use the provided```./slack/slack.yaml```)
5. Add your Slack credentials to Firebase with ```firebase functions:config:set```
6. Now you can deploy both frontend and backend by ```yarn buildd & yarn apid```
7. (Optional) To run the tests ```yarn test``` you will need to provide service account keys as per the Firebase Testing Guide   

If you have questions feel free to contact me by [email](mailto:dan@ezlaunder.com) 

##Integration of NEAR protocol with Slack
The first Slack Integration, 
that allows Slack users to directly monitor and control the NEAR Protocol.

### Install In Slack
[Install NEAR-Slack](https://us-central1-near-api-1d073.cloudfunctions.net/installSlackNear)

### Demo Video
[![Watch the video](https://i.imgur.com/AvI9gLG.jpg)](https://youtu.be/WkPLb2e2_ws)


After you install the app in your Slack workspace,  
you will be able to access it with Slash command:  
```
/near {command}
```  

Available commands:  
login, contract, send, view, call, account, balance, transactions, ...  
for more details use
```
/near help {?command}
```  

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

### Tech Stack
* Firebase Functions
* Firebase Hosting
* Firebase Firestore
* Node.js
* Vue3
* Vite

## Documentation References
#### NEAR
https://wallet.near.org/ (Create your NEAR Wallet)  
https://www.near.university  
https://examples.near.org   
https://docs.near.org/docs/api/javascript-library  
https://github.com/near/near-api-js  
https://github.com/encody/near-contract-parser  
https://github.com/near/near-indexer-for-explorer

#### Slack
https://api.slack.com/apps (Create your Slack app)  
https://api.slack.com/interactivity/slash-commands  
https://api.slack.com/interactivity/components  
https://api.slack.com/block-kit  
https://slack.dev/node-slack-sdk  

#### Firebase
https://console.firebase.google.com/ (Create your Firebase app)  
https://github.com/firebase/firebase-admin-node  
https://github.com/firebase/firebase-functions  
https://github.com/googleapis/nodejs-pubsub  

# Project Structure
Most requests from Slack are processed by  
➔  api/index.js/slackHook - Analyses the payload from Slack and executes the requested commands

➔  api/index.js/installSlackNear - Handles NEAR-Slack installation into Slack Workspace

➔  api/index.js/slackOauth - Handles Slack Oauth redirect  
...

```
.\
├── api\
│   ├── index.js        ➔  Main Backend File, Firebase Functions Hooks
│   ├── slack           ➔  Slack Helper, generates Slack Responses
│   ├── near            ➔  NEAR Helper, Executes NEAR Protocol Calls
│   │   ├── config.js   ➔  Generates NEAR connect options
│   │   └── utils       ➔  Random NEAR utils from near-sdk-js
│   └── pgDB            ➔  PostgreSQL connection to NEAR Indexer
│   
├── frontend            ➔  Slack App Homepage + Fallback for Redirects
└── slack
    └── slack.yaml      ➔  api.slack.com/apps Config by YAML
```


## Challenges and Solutions
1. Security
    * Being non-Custodial - We avoided having NEAR Full Access keys on the system to eliminate most safety concerns. All transactions require the user to go through the official NEAR website.
    * Authenticating incoming requests - ```validateRequest()``` - We are using the Slack Request hashes to make sure that the commands are coming from an authenticated Slack user

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

# Deployment
## Notice: 
Backend Tests and Emulators, 
will NOT work if not properly configured 
with a Firebase project under your control

## Install Dependencies
```
yarn       ➔ Installs Frontend Dependencies
yarn apii  ➔ Installs Backend Dependencies
```

## Backend
```
yarn apie  ➔ Starts Functions Dev Emulator
```

## Frontend App
```
yarn dev  ➔ Starts Dev Frontend
```

```
yarn serve  ➔ Production server test
```

```
yarn build  ➔ Production build static files
```

## Deployment
```
yarn apid   ➔ Deploys Backend to Firebase Functions
yarn buildd ➔ Deploys Frontend to Firebase Hosting
```

## Run tests 
The fastest way to run your code during development
```
yarn test    ➔ Tests with hidden logs
yarn testdev ➔ Verbose
```

# Support and TODO list
If you want to support the project NEAR @ danail.near  
Or want to work on **adding features**,  
please submit a Feature Request  
  or contact me by email: [dan@ezlaunder.com](mailto:dan@ezlaunder.com)

Pending Features:
1. Add a slack bot to capture commands from chat messages, 
to avoid typing "/near" in front of each command
2. Add Link-drop support
3. Add 1 more backend redirect to set header.referer = 'NEAR-Slack' to fix the Unknown App issue at wallet login
4. Fix issue with pgDB two simultaneous connections (mainnet, testnet) not allowed by NEAR Indexer
5. Add flow for brand-new users who discover NEAR via Slack


MIT License

Copyright (c) 2022 Danail Irinkov

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
