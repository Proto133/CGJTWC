<template>
  <router-view />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useMeta } from 'quasar'
import { useSettingsStore } from 'stores/settings'

const settings = useSettingsStore()

// Start the settings listener once for the whole app so both the public and
// admin layouts see live organization values.
onMounted(() => {
  settings.subscribe()
})

// The title in index.html is baked in at build time and cannot react to admin
// edits, so set it reactively here instead.
useMeta(() => ({
  title: settings.org.identity.name,
  meta: {
    description: {
      name: 'description',
      content: settings.org.identity.heroTagline,
    },
  },
}))
</script>
