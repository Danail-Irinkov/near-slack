# near-slack
An integration of NEAR protocol with Slack API

# Install Dependencies
```
yarn
```

# Frontend App
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

# Functions Emulator Workflow
```
yarn apie
```
Then test function with this URL in your browser/Postman
http://localhost:5001/near-api-1d073/us-central1/helloWorld
http://localhost:5001/near-api-1d073/us-central1/slackOauth?code=2726521633969.2873201781250.b6a168a805429b0f10c75ff73f85c748ac614dac3294e8c673f96627cf7c8287&state=

# Deployment
npm install -g firebase-tools
