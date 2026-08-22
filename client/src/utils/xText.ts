/**
 * Helpers for displaying X post text.
 *
 * Shared by the public feed panel and the admin moderation queue so both render
 * third-party text the same way.
 */

export interface TextToken {
  value: string
  /** Present when the token should render as a link. */
  href?: string
}

/** Matches links, @mentions and #hashtags; everything else is plain text. */
const ENTITY_PATTERN = /(https?:\/\/\S+)|(@\w{1,15})|(#\w+)/g

/**
 * Splits post text into renderable tokens.
 *
 * Deliberately returns data for a template to render with interpolation rather
 * than building an HTML string: post text is third-party content and `v-html`
 * on it would be an injection hole. Only `https` URLs and word-character
 * handles can produce an href, so no `javascript:` URL can slip through.
 */
export function tokenizeXText(text: string): TextToken[] {
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

/** Formats the ISO 8601 timestamp the X API returns. */
export function formatXDate(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : dateFormatter.format(date)
}
