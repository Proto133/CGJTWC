#!/usr/bin/env node
// =============================================================================
// Fetch the club's latest X posts into Firestore.
// =============================================================================
// Runs from GitHub Actions on a schedule. The browser cannot do this itself:
// the X bearer token would be readable by anyone who opened the bundle, and a
// leaked token spends real credits.
//
// Billing notes, because this costs money per call:
//   - Reading your own account's posts is an "owned read" at $0.001 per post.
//   - Resolving a handle to an id is a *user* read at $0.010, so the id is
//     cached in the X_USER_ID variable after the first run and the lookup is
//     skipped from then on.
//   - X deduplicates charges for the same resource within a UTC day, so polling
//     several times a day costs little more than polling once. It calls that a
//     soft guarantee though, so the schedule stays modest.
//
// Failure policy: if anything goes wrong we exit non-zero WITHOUT touching
// Firestore, leaving the last good feed in place. A broken run should never
// blank the website.
// =============================================================================

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const API_BASE = 'https://api.x.com/2'
const FEED_DOC = 'social/xFeed'
const MENTIONS_COLLECTION = 'xMentions'

const bearer = required('X_BEARER_TOKEN')
const handle = required('X_HANDLE').replace(/^@/, '')
const serviceAccountJson = required('FIREBASE_SERVICE_ACCOUNT')
/** Optional: set this once the first run has printed it, to skip a paid lookup. */
const configuredUserId = (process.env.X_USER_ID ?? '').trim()
/** X requires between 5 and 100. */
const maxPosts = clamp(Number(process.env.X_MAX_POSTS ?? 6), 5, 100)
/**
 * Mentions are written to a moderation queue rather than straight to the site:
 * anyone on X can mention the club, and this is a youth organisation. Set
 * X_FETCH_MENTIONS to 'false' to stop paying for them entirely.
 */
const fetchMentions = (process.env.X_FETCH_MENTIONS ?? 'true') !== 'false'
const maxMentions = clamp(Number(process.env.X_MAX_MENTIONS ?? 10), 5, 100)

function required(name) {
  const value = process.env[name]
  if (!value) {
    console.error(`Missing required environment variable: ${name}`)
    process.exit(1)
  }
  return value
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min
  return Math.min(Math.max(value, min), max)
}

async function callX(path, params) {
  const url = new URL(`${API_BASE}${path}`)
  for (const [key, value] of Object.entries(params ?? {})) {
    url.searchParams.set(key, String(value))
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${bearer}` },
  })

  if (response.status === 429) {
    const reset = response.headers.get('x-rate-limit-reset')
    throw new Error(
      `Rate limited by X${reset ? `; resets at ${new Date(Number(reset) * 1000).toISOString()}` : ''}`,
    )
  }

  const body = await response.text()
  if (!response.ok) {
    throw new Error(`X API ${response.status} on ${path}: ${body.slice(0, 400)}`)
  }

  let parsed
  try {
    parsed = JSON.parse(body)
  } catch {
    throw new Error(`X API returned non-JSON on ${path}: ${body.slice(0, 200)}`)
  }

  // A 200 can still carry errors for individual expansions; only a total
  // absence of data is fatal.
  if (parsed.errors && !parsed.data) {
    throw new Error(`X API error on ${path}: ${JSON.stringify(parsed.errors).slice(0, 400)}`)
  }

  return parsed
}

async function resolveAuthor() {
  if (configuredUserId) {
    // Still need the display name and avatar, but those come back with the
    // timeline's author expansion rather than a separate paid lookup.
    return { id: configuredUserId, profile: null }
  }

  console.log(`Resolving @${handle} to a user id (one-off $0.010 user read)...`)
  const { data } = await callX(`/users/by/username/${encodeURIComponent(handle)}`, {
    'user.fields': 'name,username,profile_image_url',
  })

  if (!data?.id) throw new Error(`No such X account: @${handle}`)

  console.log(
    `Resolved to id ${data.id}. Set X_USER_ID to this value as a repository ` +
      `variable to skip this lookup on future runs.`,
  )
  return { id: data.id, profile: data }
}

/**
 * X puts a t.co link in the text for every attached photo and every link. The
 * media ones are noise once the image is rendered separately, and the rest read
 * better expanded.
 */
function cleanText(post) {
  let text = post.text ?? ''

  for (const url of post.entities?.urls ?? []) {
    const isMediaLink = /^pic\.(x|twitter)\.com/.test(url.display_url ?? '')
    text = text.replaceAll(url.url, isMediaLink ? '' : (url.expanded_url ?? url.url))
  }

  return text.trim()
}

function mapPosts(payload) {
  const mediaByKey = new Map(
    (payload.includes?.media ?? []).map((item) => [item.media_key, item]),
  )

  return (payload.data ?? []).map((post) => {
    const media = (post.attachments?.media_keys ?? [])
      .map((key) => mediaByKey.get(key))
      .filter(Boolean)
      // Videos expose a poster frame rather than a playable url here; showing
      // the poster and linking out is enough for a club site.
      .map((item) => ({
        type: item.type,
        url: item.url ?? item.preview_image_url ?? '',
        alt: item.alt_text ?? '',
      }))
      .filter((item) => item.url !== '')

    return {
      id: post.id,
      text: cleanText(post),
      createdAt: post.created_at ?? null,
      permalink: `https://x.com/${handle}/status/${post.id}`,
      media,
    }
  })
}

/**
 * Mentions come from arbitrary accounts, so each one carries its own author
 * rather than the club's.
 */
function mapMentions(payload) {
  const usersById = new Map((payload.includes?.users ?? []).map((user) => [user.id, user]))
  const mediaByKey = new Map(
    (payload.includes?.media ?? []).map((item) => [item.media_key, item]),
  )

  return (payload.data ?? []).map((post) => {
    const user = usersById.get(post.author_id)
    const username = user?.username ?? 'i'

    const media = (post.attachments?.media_keys ?? [])
      .map((key) => mediaByKey.get(key))
      .filter(Boolean)
      .map((item) => ({
        type: item.type,
        url: item.url ?? item.preview_image_url ?? '',
        alt: item.alt_text ?? '',
      }))
      .filter((item) => item.url !== '')

    return {
      id: post.id,
      text: cleanText(post),
      createdAt: post.created_at ?? null,
      permalink: `https://x.com/${username}/status/${post.id}`,
      author: {
        name: user?.name ?? username,
        username,
        avatar: (user?.profile_image_url ?? '').replace('_normal', '_bigger'),
      },
      media,
    }
  })
}

async function syncOwnPosts(db, author) {
  const payload = await callX(`/users/${author.id}/tweets`, {
    max_results: maxPosts,
    // Replies are conversational noise and retweets need separate attribution
    // handling; neither belongs on the home page.
    exclude: 'replies,retweets',
    'tweet.fields': 'created_at,entities,attachments',
    expansions: 'attachments.media_keys,author_id',
    'media.fields': 'type,url,preview_image_url,alt_text',
    'user.fields': 'name,username,profile_image_url',
  })

  const posts = mapPosts(payload)
  console.log(`Fetched ${posts.length} post(s) for @${handle}.`)

  const profile =
    payload.includes?.users?.find((user) => user.id === author.id) ?? author.profile
  const ref = db.doc(FEED_DOC)

  // Skip the write when nothing changed, so the site's realtime listeners do
  // not churn and the document history stays meaningful.
  const existing = await ref.get()
  const priorIds = (existing.data()?.posts ?? []).map((post) => post.id).join(',')
  if (existing.exists && priorIds === posts.map((post) => post.id).join(',')) {
    console.log('No new posts; leaving the feed document untouched.')
    return
  }

  await ref.set({
    handle,
    author: {
      name: profile?.name ?? handle,
      username: profile?.username ?? handle,
      // The default avatar is served at "_normal" size; _bigger survives retina.
      avatar: (profile?.profile_image_url ?? '').replace('_normal', '_bigger'),
    },
    posts,
    updatedAt: FieldValue.serverTimestamp(),
  })

  console.log(`Wrote ${posts.length} post(s) to ${FEED_DOC}.`)
}

async function syncMentions(db, author) {
  const payload = await callX(`/users/${author.id}/mentions`, {
    max_results: maxMentions,
    'tweet.fields': 'created_at,entities,attachments,author_id',
    expansions: 'author_id,attachments.media_keys',
    'media.fields': 'type,url,preview_image_url,alt_text',
    'user.fields': 'name,username,profile_image_url',
  })

  const mentions = mapMentions(payload)
  console.log(`Fetched ${mentions.length} mention(s).`)
  if (mentions.length === 0) return

  const refs = mentions.map((mention) => db.collection(MENTIONS_COLLECTION).doc(mention.id))
  const snapshots = await db.getAll(...refs)
  const seen = new Set(snapshots.filter((snap) => snap.exists).map((snap) => snap.id))

  // Only ever create. Re-writing an existing document would reset a mention an
  // admin had already approved or rejected back to pending on the next run.
  const fresh = mentions.filter((mention) => !seen.has(mention.id))
  if (fresh.length === 0) {
    console.log('No new mentions; existing moderation decisions left alone.')
    return
  }

  const batch = db.batch()
  for (const mention of fresh) {
    batch.create(db.collection(MENTIONS_COLLECTION).doc(mention.id), {
      ...mention,
      // Nothing reaches the public site until an admin approves it.
      status: 'pending',
      fetchedAt: FieldValue.serverTimestamp(),
    })
  }
  await batch.commit()

  console.log(`Queued ${fresh.length} new mention(s) for moderation.`)
}

async function main() {
  const author = await resolveAuthor()

  const app = initializeApp({ credential: cert(JSON.parse(serviceAccountJson)) })
  const db = getFirestore(app)

  await syncOwnPosts(db, author)

  if (fetchMentions) {
    await syncMentions(db, author)
  } else {
    console.log('Mentions disabled via X_FETCH_MENTIONS=false.')
  }
}

main().catch((error) => {
  console.error(error.message ?? error)
  console.error('Firestore was not modified; the previous feed is still live.')
  process.exit(1)
})
