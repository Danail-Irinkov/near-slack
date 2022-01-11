<template>
  <div class="container mx-auto my-auto" style="max-width: 600px;padding-top: 15vh; padding-bottom: 15vh">
    <SlackIntegration />




  </div>
</template>

<script setup>
import SlackIntegration from "../components/SlackIntegration.vue";

// This starter template is using Vue 3 experimental <script setup> SFCs
// Check out https://github.com/vuejs/rfcs/blob/script-setup-2/active-rfcs/0000-script-setup.md

import { testRequest } from '../test/slackHookTEST.js'
import axios from 'axios'

</script>

<style>
</style>
