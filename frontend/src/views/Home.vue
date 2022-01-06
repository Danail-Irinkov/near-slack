<template>
  <div class="container mx-auto">
<!--    <img class="mx-auto" alt="Vue logo" src="../assets/logo.png" />-->
		<a href="https://slack.com/oauth/v2/authorize?client_id=2726521633969.2870971329539&scope=commands,chat:write,chat:write.public&user_scope="><img alt="Add to Slack" height="40" width="139" src="https://platform.slack-edge.com/img/add_to_slack.png" srcSet="https://platform.slack-edge.com/img/add_to_slack.png 1x, https://platform.slack-edge.com/img/add_to_slack@2x.png 2x" /></a>
    <HelloWorld msg="Hello Vue 3 + Vite + WindiCSS" />
  </div>
</template>

<script setup>
import HelloWorld from "../components/HelloWorld.vue";

// This starter template is using Vue 3 experimental <script setup> SFCs
// Check out https://github.com/vuejs/rfcs/blob/script-setup-2/active-rfcs/0000-script-setup.md

import { testRequest } from '../test/slackHookTEST.js'
import axios from 'axios'

</script>

<style>
</style>
