<script setup lang="ts">
import { onMounted, ref } from 'vue'

const props = defineProps<{
  handle?: string
  limit?: number
}>()

const handle = props.handle || 'CGJTWrestling'
const limit = props.limit || 4
const loaded = ref(false)

// Load Twitter/X widget script once
function loadXScript() {
  if ((window as any).twttr) {
    loaded.value = true
    return
  }

  const script = document.createElement('script')
  script.src = 'https://platform.twitter.com/widgets.js'
  script.async = true
  script.onload = () => {
    loaded.value = true
  }
  document.head.appendChild(script)
}

onMounted(() => {
  loadXScript()
})
</script>

<template>
  <div class="x-embed q-pa-md bg-white">
    <div class="row items-center q-mb-md">
      <q-icon name="fab fa-x-twitter" size="md" class="q-mr-sm" />
      <div>
        <div class="text-weight-bold">Follow us on X</div>
        <div class="text-caption text-grey-6">@{{ handle }}</div>
      </div>
    </div>

    <!-- Official X Embedded Timeline -->
    <a
      class="twitter-timeline"
      :data-height="320"
      :data-tweet-limit="limit"
      :href="`https://x.com/${handle}`"
      data-theme="light"
    >
      Tweets by @{{ handle }}
    </a>

    <div v-if="!loaded" class="text-caption text-center q-mt-sm text-grey">
      Loading latest posts...
    </div>
  </div>
</template>
