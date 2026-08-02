<script setup lang="ts">
import { onMounted, ref } from 'vue'

type Twttr = { widgets: { load: (el?: HTMLElement) => void } }

const props = defineProps<{
  handle?: string
  limit?: number
}>()

const handle = props.handle || 'CGJTWrestling'
const limit = props.limit || 4
const loaded = ref(false)
const container = ref<HTMLElement | null>(null)

const SCRIPT_SRC = 'https://platform.twitter.com/widgets.js'

// The widget script only auto-scans the DOM the first time it loads. On any
// subsequent SPA navigation the script is already cached, so we have to ask it
// to re-scan our container explicitly or the embed never renders.
function renderWidget() {
  const twttr = (window as unknown as { twttr?: Twttr }).twttr
  if (!twttr?.widgets || !container.value) return
  twttr.widgets.load(container.value)
  loaded.value = true
}

function loadXScript() {
  if ((window as unknown as { twttr?: Twttr }).twttr) {
    renderWidget()
    return
  }

  // Reuse an in-flight script tag instead of appending a duplicate.
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`)
  if (existing) {
    existing.addEventListener('load', renderWidget, { once: true })
    return
  }

  const script = document.createElement('script')
  script.src = SCRIPT_SRC
  script.async = true
  script.addEventListener('load', renderWidget, { once: true })
  document.head.appendChild(script)
}

onMounted(() => {
  loadXScript()
})
</script>

<template>
  <div ref="container" class="x-embed q-pa-md bg-white">
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
