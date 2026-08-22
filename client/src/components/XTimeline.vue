<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed } from 'vue'
import { useSettingsStore } from 'stores/settings'

type Twttr = { widgets: { load: (el?: HTMLElement) => void } }

const props = defineProps<{
  handle?: string
  limit?: number
}>()

const settings = useSettingsStore()

// Falls back to the configured account, which an admin can change at runtime.
const handle = computed(() => props.handle || settings.xHandle)
const limit = props.limit || 4
const brandIcon = computed(() => settings.xSocial?.svgPath ?? '')
const loaded = ref(false)
/** True when X did not actually render a timeline, so we show a link instead. */
const unavailable = ref(false)
const container = ref<HTMLElement | null>(null)
let checkTimer: ReturnType<typeof setTimeout> | null = null

const SCRIPT_SRC = 'https://platform.twitter.com/widgets.js'
/** Generous: the widget does script load, iframe insert, then a data fetch. */
const RENDER_GRACE_MS = 6000

/**
 * X frequently answers the syndication endpoint with 429 for embeds. When that
 * happens the script still injects an iframe, but it stays zero-height, leaving
 * an empty bordered box on the page. Height is therefore the only reliable
 * signal of success — the script reports nothing and the iframe is cross-origin,
 * so neither load events nor its contents can be inspected.
 */
function checkRendered() {
  const iframe = container.value?.querySelector('iframe')
  const height = iframe?.getBoundingClientRect().height ?? 0
  unavailable.value = height < 40
}

// The widget script only auto-scans the DOM the first time it loads. On any
// subsequent SPA navigation the script is already cached, so we have to ask it
// to re-scan our container explicitly or the embed never renders.
function renderWidget() {
  const twttr = (window as unknown as { twttr?: Twttr }).twttr
  if (!twttr?.widgets || !container.value) return
  twttr.widgets.load(container.value)
  loaded.value = true

  if (checkTimer) clearTimeout(checkTimer)
  checkTimer = setTimeout(checkRendered, RENDER_GRACE_MS)
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

onBeforeUnmount(() => {
  if (checkTimer) clearTimeout(checkTimer)
})
</script>

<template>
  <div ref="container" class="x-embed q-pa-md bg-white">
    <div class="row items-center q-mb-md">
      <!-- Inline brand mark: the bundled material-icons set has no brand glyphs,
           and the previous "fab fa-x-twitter" name required Font Awesome, which
           is not installed, so nothing rendered. -->
      <svg v-if="brandIcon" viewBox="0 0 24 24" class="x-brand q-mr-sm" aria-hidden="true">
        <path :d="brandIcon" fill="currentColor" />
      </svg>
      <div>
        <div class="text-weight-bold">Follow us on X</div>
        <div class="text-caption text-grey-6">@{{ handle }}</div>
      </div>
    </div>

    <!-- Official X Embedded Timeline. Hidden rather than removed when it fails,
         because the script owns this node once it has run. -->
    <div v-show="!unavailable">
      <a
        class="twitter-timeline"
        :data-height="320"
        :data-tweet-limit="limit"
        :href="`https://x.com/${handle}`"
        data-theme="light"
      >
        Tweets by @{{ handle }}
      </a>
    </div>

    <div v-if="!loaded && !unavailable" class="text-caption text-center q-mt-sm text-grey">
      Loading latest posts...
    </div>

    <!-- X rate-limits embeds aggressively; a plain link beats an empty box. -->
    <div v-if="unavailable" class="x-fallback">
      <p class="x-fallback__text">
        Latest posts could not be loaded right now.
      </p>
      <q-btn
        :href="`https://x.com/${handle}`"
        target="_blank"
        rel="noopener"
        unelevated
        no-caps
        color="primary"
        :label="`View @${handle} on X`"
        icon-right="open_in_new"
      />
    </div>
  </div>
</template>

<style scoped>
.x-fallback {
  text-align: center;
  padding: 8px 0 4px;
}

.x-fallback__text {
  margin: 0 0 12px;
  font-size: 0.9rem;
  color: var(--grey-500);
}
</style>
