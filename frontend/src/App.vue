<template>
	<router-view>
	</router-view>
</template>

<script setup>
</script>

<style>
#app {
	font-family: Inter, Lato, "Lucida Grande", Tahoma, sans-serif !important;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  /*margin-top: 60px;*/
}
.max-w-fit {
	max-width: fit-content;
}
.link {
	@apply no-underline hover:underline cursor-pointer
}
</style>
