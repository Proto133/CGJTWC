<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed, watch, nextTick } from 'vue'
import { useSettingsStore } from '../stores/settings'
import { useXFeedStore } from '../stores/xFeed'

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
const xFeed = useXFeedStore()

// Falls back to the configured account, which an admin can change at runtime.
const handle = computed(() => props.handle || settings.xHandle)
const brandIcon = computed(() => settings.xSocial?.svgPath ?? '')

/** Admin-curated post URLs, embedded via the widget script. */
const featuredPosts = computed(() =>
  (settings.org.social.featuredPosts ?? []).filter((url) => url.trim() !== ''))

const hasFeatured = computed(() => featuredPosts.value.length > 0)

/**
 * Posts pulled through the paid X API by the scheduled job. These are preferred
 * over anything the widget script can give us: X's profile-timeline endpoint
 * returns an empty result set for this account, and rendering the posts
 * ourselves also means no third-party script and no syndication rate limits.
 */
const apiPosts = computed(() => xFeed.posts)
const hasApiPosts = computed(() => apiPosts.value.length > 0)

/** The widget script is only needed when we have nothing of our own to show. */
const usesWidget = computed(() => !hasApiPosts.value)

/** False until a widget render attempt has finished, either way. */
const loaded = ref(false)
/** True when there is nothing to show at all, so we show a plain link. */
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

// ---------------------------------------------------------------------------
// Native rendering of API posts
// ---------------------------------------------------------------------------

interface TextToken {
  value: string
  href?: string
}

/** Matches links, @mentions and #hashtags; everything else is plain text. */
const ENTITY_PATTERN = /(https?:\/\/\S+)|(@\w{1,15})|(#\w+)/g

/**
 * Splits post text into renderable tokens.
 *
 * Deliberately returns data for the template to render with interpolation
 * rather than building an HTML string: post text is third-party content and
 * v-html on it would be an injection hole. Only https links and word-character
 * handles can produce an href, so no `javascript:` URL can slip through.
 */
function tokenize(text: string): TextToken[] {
  const tokens: TextToken[] = []
  let lastIndex = 0

  // exec with /g mutates lastIndex, so reset before walking a new string.
  ENTITY_PATTERN.lastIndex = 0
  let match = ENTITY_PATTERN.exec(text)

  while (match !== null) {
    if (match.index > lastIndex) {
      tokens.push({ value: text.slice(lastIndex, match.index) })
    }

    const [value, link, mention, hashtag] = match
    if (link) {
      tokens.push({ value, href: link })
    } else if (mention) {
      tokens.push({ value, href: `https://x.com/${mention.slice(1)}` })
    } else if (hashtag) {
      tokens.push({ value, href: `https://x.com/hashtag/${hashtag.slice(1)}` })
    }

    lastIndex = match.index + value.length
    match = ENTITY_PATTERN.exec(text)
  }

  if (lastIndex < text.length) {
    tokens.push({ value: text.slice(lastIndex) })
  }

  return tokens
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : dateFormatter.format(date)
}

// ---------------------------------------------------------------------------
// Widget fallback
// ---------------------------------------------------------------------------

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

/**
 * Only pulls in the third-party script when we actually need it. Once the
 * scheduled job has populated Firestore this never runs, so the home page
 * makes no request to X at all.
 */
function startWidget() {
  if (!usesWidget.value) return
  whenReady(() => {
    void renderWidget()
  })
}

onMounted(() => {
  // The listener is left running for the app's lifetime: it is a single
  // document, and other pages may show the feed later.
  xFeed.subscribe()
  startWidget()
})

// Settings and the cached feed both arrive from Firestore after mount, so the
// first pass can happen with neither. Re-evaluate when any of them lands.
watch([handle, featuredPosts, usesWidget], () => {
  if (!usesWidget.value) {
    // API posts arrived; abandon any widget work still in flight.
    renderToken += 1
    stopChecking()
    unavailable.value = false
    return
  }
  if (!getTwttr()?.widgets) {
    startWidget()
    return
  }
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
        <a
          class="x-handle text-caption"
          :href="`https://x.com/${handle}`"
          target="_blank"
          rel="noopener"
        >@{{ handle }}</a>
      </div>
    </div>

    <!-- Posts fetched through the API and rendered by us. -->
    <ul v-if="hasApiPosts" class="x-posts-list">
      <li v-for="post in apiPosts" :key="post.id" class="x-post">
        <p v-if="post.text" class="x-post__text">
          <template v-for="(token, index) in tokenize(post.text)" :key="index">
            <a
              v-if="token.href"
              :href="token.href"
              target="_blank"
              rel="noopener"
            >{{ token.value }}</a>
            <template v-else>{{ token.value }}</template>
          </template>
        </p>

        <div v-if="post.media.length" class="x-post__media">
          <img
            v-for="item in post.media"
            :key="item.url"
            :src="item.url"
            :alt="item.alt"
            loading="lazy"
          />
        </div>

        <!-- X's display requirements: every post links back to itself. -->
        <a class="x-post__date" :href="post.permalink" target="_blank" rel="noopener">
          {{ formatDate(post.createdAt) }}
        </a>
      </li>
    </ul>

    <!-- Fallback path: the widget script owns this node, populated by
         createTweet or createTimeline and never by the template. -->
    <div
      v-show="usesWidget && !unavailable"
      ref="widgetHost"
      class="x-posts"
    ></div>

    <div v-if="usesWidget && !loaded && !unavailable"
         class="text-caption text-center q-mt-sm text-grey">
      Loading latest posts...
    </div>

    <!-- Nothing rendered at all; a plain link beats an empty box. -->
    <div v-if="usesWidget && unavailable" class="x-fallback">
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
.x-handle {
  color: var(--grey-600, #6b7280);
  text-decoration: none;
}

.x-handle:hover {
  text-decoration: underline;
}

.x-posts-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.x-post {
  padding: 12px 0;
  border-top: 1px solid var(--grey-200, #e5e7eb);
}

.x-post:first-child {
  border-top: none;
  padding-top: 0;
}

.x-post__text {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.5;
  /* Post text arrives with real newlines and can contain long URLs. */
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.x-post__text a {
  color: var(--navy-700, #1d4ed8);
  text-decoration: none;
}

.x-post__text a:hover {
  text-decoration: underline;
}

.x-post__media {
  display: grid;
  gap: 6px;
  margin-top: 10px;
}

.x-post__media img {
  width: 100%;
  border-radius: 10px;
  display: block;
}

.x-post__date {
  display: inline-block;
  margin-top: 8px;
  font-size: 0.78rem;
  color: var(--grey-500);
  text-decoration: none;
}

.x-post__date:hover {
  text-decoration: underline;
}

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
