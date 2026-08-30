// =============================================================================
// ORGANIZATION DATA — DEFAULTS
// =============================================================================
// Everything about the club that appears on the site starts here. Edit this
// file, commit, and every page updates.
//
// Admins can also override these values from the dashboard, which writes to the
// Firestore document `settings/organization`. Precedence is:
//
//     Firestore override  >  this file
//
// A blank or missing override falls back to the value below, and "Reset to
// defaults" in the admin UI deletes the override document entirely. So this file
// remains both the seed and the safety net.
//
// Social accounts accept either a handle or a full URL:
//     x: 'CGJTWrestling'                      -> https://x.com/CGJTWrestling
//     x: '@CGJTWrestling'                     -> same (the @ is stripped)
//     x: 'https://x.com/some/custom/path'     -> used exactly as written
// Leave a social account as an empty string to hide it everywhere.
// =============================================================================

export interface OrganizationIdentity {
  /** Full display name. Used in the footer, page titles and copyright. */
  name: string
  /** Short form for tight spaces such as the admin header. */
  shortName: string
  /** The header/footer lockup renders these on two lines. */
  brandLine1: string
  brandLine2: string
  /** Large hero headline, also rendered on two lines. */
  heroLine1: string
  heroLine2: string
  /** Short phrase under the hero headline. */
  heroTagline: string
  /** Short phrase beside the footer logo. */
  footerTagline: string
}

export interface OrganizationContact {
  email: string
  /** Optional. Leave empty to hide the phone row on the contact page. */
  phone: string
}

export interface OrganizationLocation {
  /** One line per venue. Add or remove freely. */
  venues: string[]
  city: string
  state: string
}

export interface OrganizationSocial {
  x: string
  facebook: string
  instagram: string
  /**
   * Specific post URLs to embed, newest first.
   *
   * Now a manual override rather than the main path: posts fetched through the
   * API take priority, and these only render when the fetch job has not
   * populated social/xFeed. Useful for pinning something before the first run.
   */
  featuredPosts: string[]
}

export interface OrganizationProgram {
  grades: string
  skillLevels: string
  seasonMonths: string
}

/**
 * One question and answer on the FAQ page.
 *
 * Stored in the settings document rather than its own collection: these are
 * page copy that changes a few times a season, so they belong with the rest of
 * the editable text rather than warranting a collection and its own rules.
 */
export interface FaqItem {
  /** Stable key so reordering or rewording does not remount every panel. */
  id: string
  question: string
  answer: string
}

/**
 * An outbound link on the resources page.
 *
 * Only http(s) URLs are ever rendered — see LinksPage. That guard exists
 * because these are admin-editable, and a `javascript:` URL in an href would
 * otherwise execute in a visitor's browser.
 */
export interface ExternalLink {
  id: string
  label: string
  url: string
  /** One line on what the site is for; shown under the label. */
  description: string
}

export interface OrganizationContent {
  /** Short teaser used in the About section on the home page. */
  aboutTeaser: string
  /** Longer intro at the top of the About page. */
  aboutIntro: string
  /** Bullet list on the About page. */
  offerings: string[]
  /** Values paragraph on the About page. */
  values: string
  /** Home page closing call to action. */
  ctaHeading: string
  ctaText: string
  /** Intro line on the contact page. */
  contactIntro: string
  /** Shown in order on /faq. Empty hides the page's list entirely. */
  faqs: FaqItem[]
  /** Optional lead paragraph above the questions. */
  faqIntro: string
  /** Outbound links shown in order on /links. */
  links: ExternalLink[]
  /** Optional lead paragraph above the links. */
  linksIntro: string
}

/** One row of the registration pricing table. */
export interface PricingTier {
  /** Stable key stored on registrations; keep it when renaming the label. */
  id: string
  label: string
  /** Whole dollars. */
  amount: number
  description: string
  /**
   * True when this is a per-extra-wrestler rate rather than a base fee.
   *
   * Additional rates are never offered as a primary choice on the registration
   * form — a family picking one on its own would owe the sibling price for
   * their first child. They are applied on top, once per extra wrestler.
   */
  additional?: boolean
  /**
   * For an additional rate, the id of the base tier it accompanies.
   *
   * The relationship has to be explicit because a club can run several windows
   * at once — a standard and a late sibling rate, say — and nothing about the
   * ids or amounts says which belongs to which.
   */
  appliesTo?: string
}

export interface OrganizationPayment {
  /** Zelle tag or enrolled email shown on the registration page. */
  zelleTag: string
  /**
   * Optional URL of the official QR image generated by your bank's app.
   * A scannable Zelle QR cannot be synthesised — the encoding is bank-issued —
   * so this is a paste-in field rather than something the app generates.
   */
  zelleQrImageUrl: string
  /** Payee line for cheques. */
  checkPayableTo: string
  /** Where cheques should be mailed, one line per entry. */
  mailingAddress: string[]
  /** Free text shown under the payment instructions. */
  instructions: string
  tiers: PricingTier[]
}

export interface OrganizationSettings {
  identity: OrganizationIdentity
  contact: OrganizationContact
  location: OrganizationLocation
  social: OrganizationSocial
  program: OrganizationProgram
  payment: OrganizationPayment
  content: OrganizationContent
}

export const defaultOrganization: OrganizationSettings = {
  identity: {
    name: 'Trojans Wrestling Club',
    shortName: 'Trojans',
    brandLine1: 'Trojans',
    brandLine2: 'Wrestling Club',
    heroLine1: 'Trojans',
    heroLine2: 'Wrestling Club',
    heroTagline: 'Building strength, discipline and champions.',
    footerTagline: 'Building champions on and off the mat',
  },

  contact: {
    email: 'admin@trojanswrestlingclub.com',
    phone: '',
  },

  location: {
    venues: [
      'Cary Grove Community Center',
      'District 26 Schools',
    ],
    city: 'Cary',
    state: 'IL',
  },

  social: {
    x: 'CaryTrojansWC',
    facebook: '',
    instagram: '',
    // Deliberately empty; manage this list from the dashboard. See the note on
    // OrganizationSocial.featuredPosts for why a non-empty default is a trap.
    featuredPosts: [],
  },

  program: {
    grades: 'K–8',
    skillLevels: 'All',
    seasonMonths: 'Nov–Feb',
  },

  payment: {
    zelleTag: '',
    zelleQrImageUrl: '',
    checkPayableTo: 'Trojans Wrestling Club',
    mailingAddress: [],
    instructions:
      'Include your registration reference code in the memo so we can match ' +
      'your payment to your registration.',
    tiers: [
      {
        id: 'early',
        label: 'Early Registration',
        amount: 0,
        description: 'Discounted rate before the season opens.',
      },
      {
        id: 'standard',
        label: 'Standard Registration',
        amount: 0,
        description: 'Regular season rate.',
      },
      {
        id: 'multi',
        label: 'Additional Wrestler',
        amount: 0,
        description: 'Reduced rate for each extra wrestler in the same family.',
      },
    ],
  },

  content: {
    aboutTeaser:
      'The Trojans Wrestling Club develops young athletes in the Cary Grove community ' +
      'through hard work, sportsmanship and a love for the sport. We welcome wrestlers ' +
      'of all experience levels.',
    aboutIntro:
      'The Trojans Wrestling Club serves young athletes in the Cary Grove area. Our ' +
      'mission is to teach the fundamentals of wrestling while instilling discipline, ' +
      'respect, hard work and teamwork.',
    offerings: [
      'Age-appropriate training for elementary and middle school wrestlers',
      'Experienced volunteer coaches focused on safety and development',
      'Participation in local dual meets and tournaments',
      'A positive, supportive environment for beginners and experienced wrestlers alike',
    ],
    values:
      'Every wrestler matters. We emphasize effort over outcome and personal growth ' +
      'over trophies. Parents and families are an essential part of our team.',
    ctaHeading: 'Ready to wrestle?',
    ctaText: 'New wrestlers and families are always welcome.',
    contactIntro:
      'Questions about the program, registration or volunteering? Reach out anytime.',
    linksIntro:
      'The sites families use most often during the season. These are run by '
      + 'other organisations, so their sign-in and support are handled on their '
      + 'end — ask a coach if you get stuck.',
    // Editable from Admin > Settings > Useful links. Descriptions are a starting
    // point and worth a check by someone who uses each site regularly.
    links: [
      {
        id: 'link-usaw',
        label: 'USA Wrestling membership',
        url: 'https://www.usawmembership.com/login',
        description:
          'Create or renew a USA Wrestling card. Most tournaments require a '
          + 'current membership.',
      },
      {
        id: 'link-ikwf',
        label: 'IKWF',
        url: 'https://www.ikwf.org/',
        description:
          'Illinois Kids Wrestling Federation — rules, age and weight classes, '
          + 'and the Illinois state series.',
      },
      {
        id: 'link-trackwrestling',
        label: 'Trackwrestling',
        url: 'https://www.trackwrestling.com/TWHome.jsp?loadBalanced=true',
        description: 'Event registration, brackets and live results.',
      },
      {
        id: 'link-usabracketing',
        label: 'USA Bracketing',
        url: 'https://www.usabracketing.com/login',
        description: 'Registration and brackets for some events.',
      },
      {
        id: 'link-flowrestling',
        label: 'FloWrestling',
        url: 'https://www.flowrestling.org/',
        description: 'Wrestling news and streaming coverage. Subscription.',
      },
    ],
    faqIntro:
      'Answers to what parents ask us most. If yours is not here, get in touch.',
    // Starter content, editable from Admin > Settings > FAQ.
    //
    // Answers are plain text, not markdown: they render with white-space
    // pre-wrap, so newlines matter and a bullet is a literal • character.
    //
    // IMPORTANT: because pre-wrap honours every newline, a paragraph must be a
    // single unbroken string. Splitting prose across source lines with '\n'
    // would hard-wrap it at that width on every screen, breaking sentences
    // mid-flow on a phone. Concatenate prose with '+' and reserve array
    // entries for whole paragraphs, blank lines and individual bullets.
    faqs: [
      {
        id: 'faq-experience',
        question: 'Does my child need any wrestling experience?',
        answer: [
          'No. Youth rooms are built for first-timers. Coaches start with how to',
          'stand, how to move, how to fall safely, and how to treat a partner.',
          'Nobody is expected to know a move on day one.',
        ].join(' '),
      },
      {
        id: 'faq-safety',
        question: 'Is wrestling safe? It looks intense.',
        answer: [
          'It is a contact sport, so bumps, mat burns and sore muscles happen. '
          + 'Serious injury rates in youth wrestling are generally lower than in '
          + 'football, hockey and some other contact sports when kids are paired '
          + 'by size and coached with technique first.',
          '',
          'What actually keeps kids safer:',
          '• Pairing by size and experience, not just age',
          '• Teaching how to fall and how to stop a drill',
          '• Headgear for the ears',
          '• Clean mats and clean clothes — skin issues are the more common '
          + 'problem, and they are preventable',
          '• No weight cutting at the youth level',
          '',
          'If something looks too rough for your child\u2019s age group, say so. '
          + 'A good room wants that conversation.',
        ].join('\n'),
      },
      {
        id: 'faq-first-practice',
        question: 'What happens at the first practice?',
        answer: [
          'Usually about an hour. Warm-up games and movement, a couple of basic '
          + 'positions, partner drills, maybe a fun game at the end. They will '
          + 'not be thrown into a real match. First day success is: they showed '
          + 'up, they moved, they left willing to come back.',
          '',
          'It is normal if they are shy, clingy or unsure. We see that every '
          + 'season.',
        ].join('\n'),
      },
      {
        id: 'faq-what-to-wear',
        question: 'What should they wear to the first practice?',
        answer: [
          'Comfortable, close-fitting athletic clothes and a water bottle. No '
          + 'jewelry. No baggy hoodies. If you already have wrestling shoes, '
          + 'great; if not, clean socks or clean indoor shoes are fine for a '
          + 'first look.',
          '',
          'We would rather they show up than wait until the perfect kit is in '
          + 'the cart.',
        ].join('\n'),
      },
      {
        id: 'faq-equipment',
        question: 'What equipment does my child need?',
        answer: [
          'Less than it looks like from the outside. For the first practice, '
          + 'most kids just need:',
          '• Athletic shorts with no zippers, buttons or pockets',
          '• A snug T-shirt or compression shirt — loose shirts get grabbed',
          '• Clean socks or clean indoor shoes',
          '• A water bottle with their name on it',
          '• Hair pulled back if it can get in their eyes',
          '• Trimmed fingernails — long nails scratch partners',
          '',
          'That is enough to try the sport. If they stick with it, the two '
          + 'pieces that actually matter are:',
          '',
          'Wrestling shoes — light, snug shoes made for the mat. They give grip '
          + 'and ankle support. Regular sneakers usually are not allowed on the '
          + 'mats: they track dirt and do not grip the same way. A solid youth '
          + 'pair is typically $30\u2013$60. Do not buy a size to grow into; loose '
          + 'shoes cause rolled ankles.',
          '',
          'Headgear — this is ear protection, not a helmet. It helps prevent '
          + 'cauliflower ear, a permanent thickening from repeated rubbing. Most '
          + 'clubs want it once kids start live wrestling, and it is required at '
          + 'almost every tournament. $20\u2013$40 is plenty.',
          '',
          'Optional, not required:',
          '• Knee pads — some kids like one on the shooting knee; many never '
          + 'use them',
          '• Mouthguard — useful with braces, otherwise uncommon at youth level',
          '• Singlet — the tight one-piece competition uniform, not everyday '
          + 'practice. Many clubs loan or issue one, so do not buy until you '
          + 'know what the club uses.',
          '',
          'Ask us before you spend. A lot of rooms have loaner shoes and '
          + 'headgear for first-year families.',
        ].join('\n'),
      },
      {
        id: 'faq-not-athletic',
        question: 'My child is small, quiet or not sporty. Can they still wrestle?',
        answer: [
          'Yes. Wrestling is one of the few sports that sorts kids by weight, so a',
          'smaller child is not lining up against the biggest kid in the grade.',
          'Quiet kids often do well, because the sport rewards listening and',
          'repeating a skill. Prior sports help but are not required.',
        ].join(' '),
      },
      {
        id: 'faq-weight-cutting',
        question: 'Will they have to cut weight?',
        answer: [
          'Not in a healthy youth program. Kids should wrestle near their natural',
          'weight, eat normally and grow. If anyone ever suggests dehydration or',
          'skipping meals for a youth wrestler, that is a red flag. Talk to the',
          'coach.',
        ].join(' '),
      },
      {
        id: 'faq-competing',
        question: 'Do they have to compete?',
        answer: [
          'Not on day one, and not if the family is not ready. Practice can '
          + 'stand on its own for a while.',
          '',
          'When they do compete, youth brackets are grouped by age and weight. '
          + 'First tournaments are often more about learning the routine — '
          + 'weigh-in, warm-up, handshake — than about the win-loss record. '
          + 'Plenty of strong wrestlers lost a lot early.',
        ].join('\n'),
      },
      {
        id: 'faq-girls',
        question: 'Can girls wrestle?',
        answer: [
          'Yes. Many youth rooms are co-ed in practice. Girls can wrestle girls,',
          'boys, or both depending on the event. The rules and equipment are the',
          'same.',
        ].join(' '),
      },
      {
        id: 'faq-time',
        question: 'How much time does this take?',
        answer: [
          'A typical youth week is two practices of about 60\u201390 minutes each.',
          'Tournaments, if you choose them, are often Saturday mornings that can run',
          'long. You do not have to do every extra event in year one.',
        ].join(' '),
      },
      {
        id: 'faq-cost',
        question: 'What does it cost?',
        answer: [
          'Wrestling is one of the cheaper youth sports to start. Budget for:',
          '• Club fee for the season — current rates are on the registration page',
          '• Shoes and headgear if you are not borrowing them, roughly $50\u2013$100',
          '• A singlet later, if the club does not issue one',
          '• Tournament entry fees later, often $15\u2013$40 each',
          '',
          'Ask about scholarships, sibling discounts and used or loaner gear. '
          + 'Kids outgrow shoes fast, so used pairs from last year\u2019s team are '
          + 'common and perfectly fine.',
        ].join('\n'),
      },
      {
        id: 'faq-skin',
        question: 'What about skin issues? I have heard stories.',
        answer: [
          'Close contact plus shared mats means hygiene matters. The simple '
          + 'habits work:',
          '• Clean practice clothes after every session',
          '• Shower soon after practice',
          '• Clean shoes worn only on the mat',
          '• Check skin; stay home and get cleared if there is a suspicious rash',
          '• We disinfect mats regularly',
          '',
          'This is housekeeping, not a reason to skip the sport.',
        ].join('\n'),
      },
      {
        id: 'faq-how-to-help',
        question: 'I do not know anything about wrestling. How do I help?',
        answer: [
          'You do not need to coach from the chair.',
          '',
          'Helpful:',
          '• Get them there on time, fed, with water and clean gear',
          '• Ask “Did you have fun?” and “What did you try?” before “Did you win?”',
          '• Let the coach be the coach',
          '• Pack patience for tournament days — they start early and move slowly',
          '',
          'Unhelpful:',
          '• Yelling technique during a match',
          '• Comparing them to the kid who started three years ago',
          '• Making the car ride home a film session',
          '',
          'Your job is ride, snack, hug, and keep the sport theirs.',
        ].join('\n'),
      },
    ],
  },
}

// =============================================================================
// Below this line is wiring, not configuration. You should rarely need to edit
// it — only when adding support for a brand-new social platform.
//
// These are pure functions rather than precomputed constants, because live
// values can change at runtime when an admin edits the settings. The settings
// store calls them inside computed properties.
// =============================================================================

interface SocialPlatform {
  label: string
  baseUrl: string
  /** 24x24 viewBox path. Brand marks are inlined because the icon set bundled
   *  with this project (material-icons) contains no brand glyphs. */
  svgPath: string
}

/** Only the account handles; featuredPosts is not a linkable platform. */
type SocialPlatformKey = Exclude<keyof OrganizationSocial, 'featuredPosts'>

const SOCIAL_PLATFORMS: Record<SocialPlatformKey, SocialPlatform> = {
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

/** Strips a leading @ or a full URL prefix, leaving the bare handle. */
function bareHandle(value: string): string {
  return value.trim().replace(/^https?:\/\/[^/]+\//i, '').replace(/^@/, '')
}

/**
 * Social accounts that have been filled in, ready to render.
 * Accepts a bare handle, an @handle, or a full URL.
 */
export function buildSocialLinks(social: OrganizationSocial): SocialLink[] {
  return (Object.keys(SOCIAL_PLATFORMS) as SocialPlatformKey[])
    .filter((key) => (social[key] ?? '').trim() !== '')
    .map((key) => {
      const platform = SOCIAL_PLATFORMS[key]
      const raw = social[key].trim()
      const isUrl = /^https?:\/\//i.test(raw)
      const handle = bareHandle(raw)

      return {
        key,
        label: platform.label,
        handle: `@${handle}`,
        url: isUrl ? raw : `${platform.baseUrl}${handle}`,
        svgPath: platform.svgPath,
      }
    })
}

/** The X handle without the @, for the embedded timeline widget. */
export function buildXHandle(social: OrganizationSocial): string {
  return bareHandle(social.x ?? '')
}

/** "Cary, IL" */
export function buildCityState(location: OrganizationLocation): string {
  return [location.city, location.state].filter(Boolean).join(', ')
}

/** Venue lines followed by the city/state, for address blocks. */
export function buildAddressLines(location: OrganizationLocation): string[] {
  return [...location.venues.filter(Boolean), buildCityState(location)].filter(Boolean)
}

/** `mailto:` href for the club address. */
export function buildMailtoHref(email: string): string {
  return `mailto:${email}`
}

/** "© 2026 Trojans Wrestling Club · Cary, IL" */
export function buildCopyrightLine(
  name: string,
  cityState: string,
  year: number = new Date().getFullYear(),
): string {
  return [`© ${year} ${name}`, cityState].filter(Boolean).join(' · ')
}

export default defaultOrganization
