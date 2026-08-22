<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed, watch, nextTick } from 'vue'
import { useSettingsStore } from '../stores/settings'

/**
 * The factory half of the widgets API. Both factories resolve with the element
 * they built, or with `undefined` when X declined to build it — that undefined
 * is the only explicit failure signal the script offers, so it is typed and
 * checked rather than discarded.
 */
type WidgetOptions = Record<string, unknown>
type Twttr = {
  widgets: {
    createTimeline: (
      source: { sourceType: 'profile'; screenName: string },
      target: HTMLElement,
      options?: WidgetOptions,
    ) => Promise<HTMLElement | undefined>
    createTweet: (
      id: string,
      target: HTMLElement,
      options?: WidgetOptions,
    ) => Promise<HTMLElement | undefined>
  }
  ready?: (cb: () => void) => void
}

const props = defineProps<{
  handle?: string
}>()

const settings = useSettingsStore()

// Falls back to the configured account, which an admin can change at runtime.
const handle = computed(() => props.handle || settings.xHandle)
const brandIcon = computed(() => settings.xSocial?.svgPath ?? '')

/**
 * Admin-curated post URLs. When present these are shown instead of relying on
 * the profile timeline, which X serves empty for this account.
 */
const featuredPosts = computed(() =>
  (settings.org.social.featuredPosts ?? []).filter((url) => url.trim() !== ''))

const hasFeatured = computed(() => featuredPosts.value.length > 0)

/** False until a render attempt has finished, either way. */
const loaded = ref(false)
/** True when X gave us nothing, so we show a plain link instead. */
const unavailable = ref(false)
/** The node the widget script owns. Never touched by the template. */
const widgetHost = ref<HTMLElement | null>(null)

let checkTimer: ReturnType<typeof setInterval> | null = null
let checkDeadline = 0
let disposed = false
/** Guards against an in-flight render finishing after a newer one started. */
let renderToken = 0

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
/** Below this the iframe exists but is empty rather than genuinely rendered. */
const MIN_RENDERED_HEIGHT = 40
const TIMELINE_HEIGHT = 320

function getTwttr(): Twttr | undefined {
  return (window as unknown as { twttr?: Twttr }).twttr
}

function stopChecking() {
  if (checkTimer) clearInterval(checkTimer)
  checkTimer = null
}

/** createTweet wants the numeric status id; admins paste whole post URLs. */
function tweetIdFromUrl(url: string): string | null {
  return /status(?:es)?\/(\d+)/.exec(url)?.[1] ?? null
}

/**
 * A profile timeline can resolve with an element and still be empty, which is
 * exactly what X returns for this account. Height is the only way to tell the
 * difference, and it is polled because the widget can paint late.
 */
function checkRendered() {
  const iframe = widgetHost.value?.querySelector('iframe')
  const height = iframe?.getBoundingClientRect().height ?? 0

  if (height >= MIN_RENDERED_HEIGHT) {
    unavailable.value = false
    stopChecking()
    return
  }

  if (Date.now() >= checkDeadline) {
    unavailable.value = true
    stopChecking()
  }
}

function startRenderWatch() {
  stopChecking()
  checkDeadline = Date.now() + RENDER_TIMEOUT_MS
  checkTimer = setInterval(checkRendered, RENDER_POLL_MS)
}

/** Returns how many of the curated posts X actually built. */
async function renderFeatured(twttr: Twttr, host: HTMLElement, token: number) {
  let rendered = 0

  for (const url of featuredPosts.value) {
    const id = tweetIdFromUrl(url)
    if (!id) continue

    const slot = document.createElement('div')
    host.appendChild(slot)

    const el = await twttr.widgets.createTweet(id, slot, {
      theme: 'light',
      dnt: true,
      align: 'center',
      conversation: 'none',
    })

    if (token !== renderToken) return rendered
    if (el) rendered += 1
    else slot.remove()
  }

  return rendered
}

async function renderWidget() {
  const twttr = getTwttr()
  const host = widgetHost.value
  if (!twttr?.widgets || !host) return

  const token = ++renderToken
  stopChecking()
  host.replaceChildren()
  unavailable.value = false

  try {
    if (hasFeatured.value) {
      const rendered = await renderFeatured(twttr, host, token)
      if (token !== renderToken || disposed) return
      // Curated posts are discrete iframes, so their own success count decides
      // the fallback; there is no timeline height to poll.
      unavailable.value = rendered === 0
      return
    }

    const el = await twttr.widgets.createTimeline(
      { sourceType: 'profile', screenName: handle.value },
      host,
      {
        height: TIMELINE_HEIGHT,
        theme: 'light',
        dnt: true,
        lang: 'en',
        // Our own header already names the account, so drop the widget's.
        chrome: 'noheader nofooter',
      },
    )

    if (token !== renderToken || disposed) return

    if (!el) {
      unavailable.value = true
      return
    }

    startRenderWatch()
  } catch (error) {
    if (token !== renderToken || disposed) return
    console.warn('X embed failed to render:', error)
    unavailable.value = true
  } finally {
    if (token === renderToken && !disposed) loaded.value = true
  }
}

/**
 * `twttr.ready` fires once the widget API is usable, which is not the same as
 * the script tag's load event. Note it returns undefined, so it must not be
 * chained with `??` onto a direct call or the callback runs twice.
 */
function whenReady(cb: () => void) {
  const existing = getTwttr()
  if (existing?.ready) {
    existing.ready(cb)
    return
  }
  if (existing?.widgets) {
    cb()
    return
  }

  const onLoad = () => {
    const twttr = getTwttr()
    if (twttr?.ready) twttr.ready(cb)
    else cb()
  }

  // Reuse an in-flight script tag instead of appending a duplicate.
  const existingTag = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`)
  if (existingTag) {
    existingTag.addEventListener('load', onLoad, { once: true })
    return
  }

  const script = document.createElement('script')
  script.src = SCRIPT_SRC
  script.async = true
  script.addEventListener('load', onLoad, { once: true })
  script.addEventListener('error', () => {
    if (disposed) return
    unavailable.value = true
    loaded.value = true
  }, { once: true })
  document.head.appendChild(script)
}

onMounted(() => {
  whenReady(() => {
    void renderWidget()
  })
})

// Settings arrive from Firestore after mount, so the first render can happen
// against the default handle with no curated posts. Rebuild when either lands.
watch([handle, featuredPosts], () => {
  if (!getTwttr()?.widgets) return
  void nextTick(() => renderWidget())
})

onBeforeUnmount(() => {
  disposed = true
  stopChecking()
})
</script>

<template>
  <div class="x-embed q-pa-md bg-white">
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

    <!-- The widget script owns this node: it is populated by createTweet or
         createTimeline, never by the template, and hidden rather than removed
         on failure so the script's own teardown stays valid. -->
    <div ref="widgetHost" v-show="!unavailable" class="x-posts"></div>

    <div v-if="!loaded && !unavailable"
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
