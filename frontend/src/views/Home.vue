<template>
  <div class="container mx-auto">
    <img class="mx-auto" alt="Vue logo" src="../assets/logo.png" />
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
