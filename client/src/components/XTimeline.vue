<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed } from 'vue'
import { useSettingsStore } from '../stores/settings'

type Twttr = { widgets: { load: (el?: HTMLElement) => void } }

const props = defineProps<{
  handle?: string
  limit?: number
}>()

const settings = useSettingsStore()

// Falls back to the configured account, which an admin can change at runtime.
const handle = computed(() => props.handle || settings.xHandle)
const brandIcon = computed(() => settings.xSocial?.svgPath ?? '')

/**
 * Admin-curated post URLs. When present these are shown instead of relying on
 * the profile timeline, which X often serves empty for new or quiet accounts.
 */
const featuredPosts = computed(() =>
  (settings.org.social.featuredPosts ?? []).filter((url) => url.trim() !== ''))

const hasFeatured = computed(() => featuredPosts.value.length > 0)
const loaded = ref(false)
/** True when X did not actually render a timeline, so we show a link inste
/** True when X did not actually render a timeline, so we show a link instead. */
const unavailable = ref(false)
const container = ref<HTMLElement | null>(null)
let checkTimer: ReturnType<typeof setInterval> | null = null
let checkDeadline = 0

/**
 * X's publish tool now hands out platform.x.com rather than the older
 * platform.twitter.com. Both serve the same widget script, but matching the
 * documented host removes one variable when embeds misbehave.
 */
const SCRIPT_SRC = 'https://platform.x.com/widgets.js'
/** How often to re-measure while waiting for the widget to paint. */
const RENDER_POLL_MS = 1000
/** Total time to keep waiting before falling back to a plain link. */
const RENDER_TIMEOUT_MS = 15000
/** Below this the iframe is present but empty rather than genuinely rendered. */
const MIN_RENDERED_HEIGHT = 40

function stopChecking() {
  if (checkTimer) clearInterval(checkTimer)
  checkTimer = null
}

/**
 * X frequently answers the syndication endpoint with 429 for embeds. When that
 * happens the script still injects an iframe, but it stays zero-height, leaving
 * an empty bordered box on the page. Height is therefore the only reliable
 * signal of success — the script reports nothing and the iframe is cross-origin,
 * so neither load events nor its contents can be inspected.
 *
 * Polled rather than measured once: the widget can take a while to paint, and a
 * single early measurement would latch `unavailable` and hide a timeline that
 * was merely slow.
 */
function checkRendered() {
  // Featured posts render as their own iframes, so the timeline check does not
  // apply and the fallback link is unnecessary.
  if (hasFeatured.value) {
    unavailable.value = false
    stopChecking()
    return
  }

  const iframe = container.value?.querySelector('iframe')
  const height = iframe?.getBoundingClientRect().height ?? 0

  if (height >= MIN_RENDERED_HEIGHT) {
    // Rendered after all; make sure any earlier fallback is retracted.
    unavailable.value = false
    stopChecking()
    return
  }

  // Only give up once the whole grace period has elapsed.
  if (Date.now() >= checkDeadline) {
    unavailable.value = true
    stopChecking()
  }
}

// The widget script only auto-scans the DOM the first time it loads. On any
// subsequent SPA navigation the script is already cached, so we have to ask it
// to re-scan our container explicitly or the embed never renders.
function renderWidget() {
  const twttr = (window as unknown as { twttr?: Twttr }).twttr
  if (!twttr?.widgets || !container.value) return
  twttr.widgets.load(container.value)
  loaded.value = true

  stopChecking()
  checkDeadline = Date.now() + RENDER_TIMEOUT_MS
  checkTimer = setInterval(checkRendered, RENDER_POLL_MS)
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
  stopChecking()
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

    <!-- Curated posts take priority: single-post embeds are served reliably,
         whereas the profile timeline often is not for a new account. -->
    <div v-if="hasFeatured" class="x-posts">
      <blockquote
        v-for="url in featuredPosts"
        :key="url"
        class="twitter-tweet"
        data-theme="light"
        data-dnt="true"
      >
        <a :href="url">{{ url }}</a>
      </blockquote>
    </div>

    <!-- Official X Embedded Timeline. Hidden rather than removed when it fails,
         because the script owns this node once it has run. -->
    <div v-else v-show="!unavailable">
      <!-- Markup mirrors what publish.x.com generates, including ref_src.
           data-tweet-limit is deliberately omitted: it switches the widget into
           a fixed-set mode rather than a timeline, which is another thing to go
           wrong for no benefit here. -->
      <a
        class="twitter-timeline"
        data-lang="en"
        data-theme="light"
        :data-height="320"
        :href="`https://x.com/${handle}?ref_src=twsrc%5Etfw`"
      >
        Posts by {{ handle }}
      </a>
    </div>

    <div v-if="!loaded && !unavailable && !hasFeatured"
         class="text-caption text-center q-mt-sm text-grey">
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
.x-posts :deep(.twitter-tweet) {
  margin: 0 auto 12px;
}

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
