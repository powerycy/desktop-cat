<script setup lang="ts">
import { watchEffect } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

watchEffect(() => {
  const lockScroll = route.path === '/' || route.path === '/rest'
  const overflow = lockScroll ? 'hidden' : 'auto'
  document.documentElement.style.overflow = overflow
  document.body.style.overflow = overflow
})
</script>

<template>
  <RouterView />
</template>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html,
body,
#app {
  min-height: 100%;
  background: transparent !important;
}
</style>
