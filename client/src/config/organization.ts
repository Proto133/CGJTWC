// =============================================================================
// ORGANIZATION DATA — SINGLE SOURCE OF TRUTH
// =============================================================================
// Everything about the club that appears on the site lives here. Edit this
// file, commit, and every page updates. You should not need to touch any
// component to change a name, email, social account, venue or blurb.
//
// Social accounts accept either a handle or a full URL:
//     x: 'CGJTWrestling'                      -> https://x.com/CGJTWrestling
//     x: '@CGJTWrestling'                     -> same (the @ is stripped)
//     x: 'https://x.com/some/custom/path'     -> used exactly as written
// Leave a social account as an empty string to hide it everywhere.
// =============================================================================

export const organization = {
  /** Names and taglines. */
  identity: {
    /** Full legal/display name. Used in the footer, page titles and copyright. */
    name: 'Trojans Wrestling Club',
    /** Short form for tight spaces such as the admin header. */
    shortName: 'Trojans',
    /** The header/footer lockup renders these on two lines. */
    brandLine1: 'Trojans',
    brandLine2: 'Wrestling Club',
    /** Large hero headline, also rendered on two lines. */
    heroLine1: 'Trojans',
    heroLine2: 'Wrestling Club',
    /** Short phrase under the hero headline. */
    heroTagline: 'Building strength, discipline and champions.',
    /** Short phrase beside the footer logo. */
    footerTagline: 'Building champions on and off the mat',
  },

  /** How people reach the club. */
  contact: {
    email: 'admin@trojanswrestlingclub.com',
    /** Optional. Leave empty to hide the phone row on the contact page. */
    phone: '',
  },

  /** Where the club practises and competes. */
  location: {
    /** One line per venue. Add or remove freely. */
    venues: [
      'Cary Grove Community Center',
      'District 26 Schools',
    ],
    city: 'Cary',
    state: 'IL',
  },

  /**
   * Social accounts. Handle or full URL; empty string hides the link.
   * Only these keys are supported — add a new one to SOCIAL_PLATFORMS below.
   */
  social: {
    x: 'CGJTWrestling',
    facebook: '',
    instagram: '',
  },

  /** Program facts shown as tiles on the About page. */
  program: {
    grades: 'K–8',
    skillLevels: 'All',
    seasonMonths: 'Nov–Feb',
  },

  /** Editable body copy. */
  content: {
    /** Short teaser used in the About section on the home page. */
    aboutTeaser:
      'The Trojans Wrestling Club develops young athletes in the Cary Grove community ' +
      'through hard work, sportsmanship and a love for the sport. We welcome wrestlers ' +
      'of all experience levels.',
    /** Longer intro at the top of the About page. */
    aboutIntro:
      'The Trojans Wrestling Club serves young athletes in the Cary Grove area. Our ' +
      'mission is to teach the fundamentals of wrestling while instilling discipline, ' +
      'respect, hard work and teamwork.',
    /** Bullet list on the About page. */
    offerings: [
      'Age-appropriate training for elementary and middle school wrestlers',
      'Experienced volunteer coaches focused on safety and development',
      'Participation in local dual meets and tournaments',
      'A positive, supportive environment for beginners and experienced wrestlers alike',
    ],
    /** Values paragraph on the About page. */
    values:
      'Every wrestler matters. We emphasize effort over outcome and personal growth ' +
      'over trophies. Parents and families are an essential part of our team.',
    /** Home page closing call to action. */
    ctaHeading: 'Ready to wrestle?',
    ctaText: 'New wrestlers and families are always welcome.',
    /** Intro line on the contact page. */
    contactIntro:
      'Questions about the program, registration or volunteering? Reach out anytime.',
  },
} as const

// =============================================================================
// Below this line is wiring, not configuration. You should rarely need to edit
// it — only when adding support for a brand-new social platform.
// =============================================================================

interface SocialPlatform {
  label: string
  baseUrl: string
  /** 24x24 viewBox path. Brand marks are inlined because the icon sets bundled
   *  with this project (material-icons) contain no brand glyphs. */
  svgPath: string
}

const SOCIAL_PLATFORMS: Record<keyof typeof organization.social, SocialPlatform> = {
  x: {
    label: 'X',
    baseUrl: 'https://x.com/',
    svgPath:
      'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68' +
      'l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
  },
  facebook: {
    label: 'Facebook',
    baseUrl: 'https://facebook.com/',
    svgPath:
      'M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987' +
      'h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46' +
      'h-1.253c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z',
  },
  instagram: {
    label: 'Instagram',
    baseUrl: 'https://instagram.com/',
    svgPath:
      'M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.336 3.608 1.311.975.975 1.249 2.242 ' +
      '1.311 3.608.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.062 1.366-.336 2.633-1.311 ' +
      '3.608-.975.975-2.242 1.249-3.608 1.311-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.366' +
      '-.062-2.633-.336-3.608-1.311-.975-.975-1.249-2.242-1.311-3.608C2.175 15.584 2.163 15.204 ' +
      '2.163 12s.012-3.584.07-4.85c.062-1.366.336-2.633 1.311-3.608.975-.975 2.242-1.249 3.608' +
      '-1.311C8.416 2.175 8.796 2.163 12 2.163zm0 1.802c-3.15 0-3.503.012-4.74.068-.94.043-1.79' +
      '.208-2.36.778-.57.57-.735 1.42-.778 2.36-.056 1.237-.068 1.59-.068 4.74s.012 3.503.068 ' +
      '4.74c.043.94.208 1.79.778 2.36.57.57 1.42.735 2.36.778 1.237.056 1.59.068 4.74.068s3.503' +
      '-.012 4.74-.068c.94-.043 1.79-.208 2.36-.778.57-.57.735-1.42.778-2.36.056-1.237.068-1.59' +
      '.068-4.74s-.012-3.503-.068-4.74c-.043-.94-.208-1.79-.778-2.36-.57-.57-1.42-.735-2.36-.778' +
      '-1.237-.056-1.59-.068-4.74-.068zm0 3.063a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27z' +
      'm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 ' +
      '1.2 1.2 0 010-2.4z',
  },
}

export interface SocialLink {
  key: string
  /** Platform name, e.g. "X". */
  label: string
  /** Display text, e.g. "@CGJTWrestling". */
  handle: string
  /** Absolute profile URL. */
  url: string
  svgPath: string
}

/**
 * Social accounts that have been filled in, ready to render.
 * Accepts a bare handle, an @handle, or a full URL.
 */
export const socialLinks: SocialLink[] = Object.entries(organization.social)
  .filter(([, value]) => value.trim() !== '')
  .map(([key, value]) => {
    const platform = SOCIAL_PLATFORMS[key as keyof typeof organization.social]
    const raw = value.trim()
    const isUrl = /^https?:\/\//i.test(raw)
    const handle = raw.replace(/^https?:\/\/[^/]+\//i, '').replace(/^@/, '')

    return {
      key,
      label: platform.label,
      handle: `@${handle}`,
      url: isUrl ? raw : `${platform.baseUrl}${handle}`,
      svgPath: platform.svgPath,
    }
  })

/** The X entry, or null when no X account is configured. */
export const xSocial: SocialLink | null =
  socialLinks.find((link) => link.key === 'x') ?? null

/** The X/Twitter handle without the @, for the embedded timeline widget. */
export const xHandle: string = organization.social.x.trim()
  .replace(/^https?:\/\/[^/]+\//i, '')
  .replace(/^@/, '')

/** `mailto:` href for the club address. */
export const mailtoHref = `mailto:${organization.contact.email}`

/** "Cary, IL" */
export const cityState = `${organization.location.city}, ${organization.location.state}`

/** Venue lines followed by the city/state, for address blocks. */
export const addressLines: string[] = [...organization.location.venues, cityState]

/** "© 2026 Trojans Wrestling Club · Cary, IL" */
export function copyrightLine(year: number = new Date().getFullYear()): string {
  return `© ${year} ${organization.identity.name} · ${cityState}`
}

export default organization
