import type { Timestamp } from 'firebase/firestore'

export interface Event {
  id: string
  title: string
  date: Timestamp
  /**
   * @deprecated Free-text time, replaced by startTime/endTime/allDay.
   *
   * Still read as a display fallback so documents written before the split keep
   * rendering, which is what let the change ship without a data migration.
   * Editing an event converts it. Do not write this on new events.
   */
  time?: string
  /**
   * Wall-clock 'HH:MM' in 24-hour form, e.g. '16:15'.
   *
   * Deliberately not a UTC instant or an offset-bearing value: the season
   * crosses the November DST change, so anything carrying an offset would move
   * a 4:15 PM practice by an hour halfway through the year. See
   * src/utils/eventTimes.ts.
   */
  startTime?: string
  endTime?: string
  /**
   * Explicitly all day, as distinct from no time recorded at all. Absent plus
   * no startTime means nobody filled it in, and nothing is displayed.
   */
  allDay?: boolean
  location: string
  type: 'practice' | 'dual' | 'tournament' | 'other'
  opponent?: string
  description?: string
  /**
   * Which squad an event is for: TBI (Tot/Bantam/Intermediate), NS
   * (Novice/Senior), or 'ALL' for both.
   *
   * Absent or blank is not the same as 'ALL' — it means no squad was recorded,
   * and the event is badged with no squad at all. See src/utils/eventGroups.ts.
   *
   * Free text rather than an enum on purpose: the club's own naming was still
   * settling when this was added, and squad options are derived from the values
   * actually in use, so renaming a squad needs no migration.
   */
  group?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface Announcement {
  id: string
  title: string
  body: string
  pinned: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ---------------------------------------------------------------------------
// Contact form messages
// ---------------------------------------------------------------------------

export type ContactMessageStatus = 'new' | 'in-progress' | 'resolved'

/**
 * A message from the public contact form.
 *
 * Deliberately a separate collection from `tickets`: tickets require an
 * authenticated admin to create, and opening that up would let anyone on the
 * internet write into the internal tracker. These are write-only for the
 * public and readable only by admins, the same shape as registrations.
 */
export interface ContactMessage {
  id: string
  name: string
  email: string
  message: string
  status: ContactMessageStatus
  /** Free text: whoever picked it up. Not tied to an account. */
  assignedTo?: string
  /** Internal only, never shown to the sender. */
  adminNotes?: string
  createdAt: Timestamp
  updatedAt?: Timestamp
  updatedBy?: string
}

/** What the public form submits; everything else is set by rules or admins. */
export interface ContactFormPayload {
  name: string
  email: string
  message: string
}

// ---------------------------------------------------------------------------
// Admin discussion threads
// ---------------------------------------------------------------------------
//
//   adminThreads/{id}                admin only
//   adminThreads/{id}/messages/{id}  admin only
//
// Entirely internal. Threads rather than a flat chat on purpose: without Cloud
// Functions nothing can notify anybody, and a threaded board is asynchronous by
// nature, whereas a chat that nobody is alerted to is a noticeboard pretending
// to be a conversation.

export interface AdminThread {
  id: string
  title: string
  createdByUid: string
  createdByEmail: string
  createdAt: Timestamp
  /** Drives the sort, so the liveliest discussion is at the top. */
  lastMessageAt?: Timestamp
  messageCount: number
  /** Kept at the top of the list regardless of activity. */
  pinned: boolean
  /** Resolved threads stay readable but drop below the open ones. */
  resolved: boolean
}

export interface AdminThreadMessage {
  id: string
  body: string
  authorUid: string
  authorEmail: string
  createdAt: Timestamp
}

export type AdminRole = 'owner' | 'admin'

export interface AdminDoc {
  email?: string
  name?: string
  /** Absent means a plain admin. Only an owner can change ticket status. */
  role?: AdminRole
  addedAt?: Timestamp
}

// ---------------------------------------------------------------------------
// Internal bug reports / feature requests
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Account vault
// ---------------------------------------------------------------------------

/** AES-GCM ciphertext plus its nonce, both base64. Never a plaintext string. */
export interface CipherBlobDoc {
  ct: string
  iv: string
}

/**
 * A stored account. Only `password` is encrypted — everything else stays in
 * plaintext deliberately, so the inventory remains searchable and useful, and
 * because none of it is a secret on its own.
 */
export interface VaultItem {
  id: string
  /** e.g. Instagram, Facebook, Gmail. */
  platform: string
  /** Human label, e.g. "Club Instagram". */
  label: string
  username?: string
  url?: string
  recoveryEmail?: string
  /** Free text, e.g. "Authenticator app on Pete's phone". */
  twoFactor?: string
  /** Who is responsible for this account. */
  owner?: string
  notes?: string
  password: CipherBlobDoc
  createdAt?: Timestamp
  updatedAt?: Timestamp
  updatedBy?: string
}

export interface VaultItemInput {
  platform: string
  label: string
  username?: string
  url?: string
  recoveryEmail?: string
  twoFactor?: string
  owner?: string
  notes?: string
  /** Plaintext here; the store encrypts before writing. */
  password: string
}

export type TicketType = 'bug' | 'feature'
export type TicketStatus = 'open' | 'in-progress' | 'completed'
export type TicketPriority = 'low' | 'normal' | 'high'

export interface Ticket {
  id: string
  type: TicketType
  title: string
  description: string
  priority: TicketPriority
  /** Page the reporter was on when they hit the issue. */
  pageUrl?: string
  status: TicketStatus
  createdByUid: string
  createdByEmail: string
  createdAt: Timestamp
  updatedAt?: Timestamp
}

export interface TicketFormPayload {
  type: TicketType
  title: string
  description: string
  priority: TicketPriority
  pageUrl?: string
}

export interface TicketComment {
  id: string
  body: string
  authorUid: string
  authorEmail: string
  createdAt: Timestamp
}

// Written to /accessRequests/{uid} when someone signs up. The document ID is
// the Firebase Auth UID, which is what makes approval possible: granting access
// means creating /admins/{sameId}.
export interface AccessRequest {
  /** Also the requester's Firebase Auth UID. */
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  createdAt: Timestamp
}

export type EventType = Event['type']

// Shapes emitted by the admin forms.
export interface EventFormPayload {
  title: string
  date: Date
  /** Wall-clock 'HH:MM', 24-hour. */
  startTime?: string
  endTime?: string
  allDay?: boolean
  location: string
  type: EventType
  opponent?: string
  description?: string
  group?: string
}

export interface AnnouncementFormPayload {
  title: string
  body: string
  pinned: boolean
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

export interface StaffMember {
  id: string
  firstName: string
  lastName: string
  role: string
  bio: string
  /** Lower numbers sort first. */
  order: number
  email?: string
  /**
   * Reserved for the photo work that is blocked on Cloud Storage. Declared now
   * so adding photos later needs no data migration.
   */
  photoUrl?: string
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

export interface StaffFormPayload {
  firstName: string
  lastName: string
  role: string
  bio: string
  order: number
  email?: string
}

// ---------------------------------------------------------------------------
// Sponsors
// ---------------------------------------------------------------------------
//
// A sponsor is stored across two documents because security rules grant access
// per document, never per field:
//
//   sponsors/{id}                  public read  -> Sponsor
//   sponsors/{id}/private/details  admin only   -> SponsorPrivate
//
// Parent rules do not cascade into subcollections, and a query on `sponsors`
// never returns subcollection documents, so the commercial record stays out of
// reach of the public page and of anyone reading the network traffic.

export type SponsorTier = 'gold' | 'silver' | 'bronze'

/**
 * An extra labelled link on a sponsor card, e.g. "Book a free estimate".
 *
 * Capped at SPONSOR_LINK_LIMIT. Security rules cannot loop, so each slot is
 * validated by index; raising the cap means editing the rules too.
 */
export interface SponsorLink {
  label: string
  url: string
}

/** Optional business socials. A fixed set so rules can check each one. */
export interface SponsorSocials {
  facebook?: string
  instagram?: string
  x?: string
  linkedin?: string
}

/**
 * The public half of a sponsor record.
 *
 * IMPORTANT: every field here is world-readable. Do not add contact details,
 * donation amounts or contract terms to this interface — they belong in
 * SponsorPrivate. Anything added here is published the moment it is written,
 * whether or not the page renders it.
 */
export interface Sponsor {
  id: string
  name: string
  /** Copy supplied by the business for its card. Plain text, never HTML. */
  blurb: string
  logoUrl?: string
  /**
   * Optional brand colours, '#RRGGBB', washed into opposite corners of the
   * card: start at the top left, end at the bottom right.
   *
   * Colours rather than a background image, deliberately. An image cannot be
   * checked for contrast — a dark gradient or a busy photo would swallow the
   * dark text on the card, and there is no way to validate that server-side.
   * A corner wash leaves the middle of the card white by construction, so any
   * pair of colours is safe, and it costs no hosting and cannot 404.
   *
   * Rendered at partial opacity, so even #000000 becomes a soft wash rather
   * than a black corner.
   */
  brandColorStart?: string
  brandColorEnd?: string
  websiteUrl?: string
  /**
   * The business's public line, as it would appear on their own website.
   *
   * Deliberately separate from SponsorPrivate.contactPhone, which is the
   * person at the business the club deals with and is frequently a personal
   * mobile. Publishing that one because it happened to be on file would expose
   * a number given on the understanding it stayed internal.
   */
  phone?: string
  socials?: SponsorSocials
  /** Extra labelled links, beyond the website and socials. */
  links?: SponsorLink[]
  /**
   * A deal the business offers club families, e.g. "10% off any remodel".
   *
   * Set by the club on the business's instruction. The offer is theirs to
   * honour, not the club's — the page says so.
   */
  offer?: string
  /** Optional code or phrase a family mentions to claim it. */
  offerCode?: string
  /**
   * YYYY/MM/DD. Once past, the offer stops rendering automatically.
   *
   * Unlike a lapsed sponsor, which stays up deliberately while a renewal is
   * discussed, an expired offer must disappear on its own: the cost of getting
   * it wrong is a family at a counter being refused a discount the club
   * promised them.
   */
  offerExpires?: string
  /**
   * Drives card size on the public page.
   *
   * Derived from a thirds split of effective value, but stored rather than
   * computed at render time — the input is the donation figure, which is
   * private, so the public page has no way to work it out. Recomputed inside
   * the same batch as any mutation; see src/utils/sponsors.ts.
   */
  tier: SponsorTier
  /** Lower numbers sort first within a tier. */
  order: number
  /**
   * Manual switch rather than an expiry check on the term dates. A lapsed
   * sponsor mid-renewal should not vanish from the page while the conversation
   * is still going; the dashboard nudges instead.
   */
  active: boolean
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

/**
 * The commercial half, at sponsors/{id}/private/details.
 *
 * Admin read and write only. Never fetched by the public page.
 */
export interface SponsorPrivate {
  contactName?: string
  contactEmail?: string
  /** Whoever the club deals with. Often a mobile; never published. */
  contactPhone?: string
  /** Whole dollars of cash actually received. Never published. */
  amount?: number
  /**
   * Whole dollars, the estimated worth of donated goods or services.
   *
   * Added to `amount` rather than applied as a multiplier. A multiplier would
   * scale the extras with the cash, so the same donated shoes would be worth
   * five times as much from a $5,000 sponsor as from a $1,000 one. Keeping
   * these separate also leaves `amount` a clean record of money received.
   */
  inKindValue?: number
  /**
   * Keeps this sponsor's tier out of the automatic split.
   *
   * The escape hatch for what money cannot express: an in-kind-only partner
   * who would otherwise fall to Bronze for having no cash figure, or a
   * placement that has actually been promised to somebody and must survive the
   * next recompute.
   *
   * Private because it is an internal decision that is never rendered — the
   * public document holds only what the page draws.
   */
  tierLocked?: boolean
  /** YYYY/MM/DD, matching the convention used by registrations. */
  termStart?: string
  termEnd?: string
  notes?: string
  updatedAt?: Timestamp
}

export interface SponsorFormPayload {
  public: Omit<Sponsor, 'id' | 'createdAt' | 'updatedAt'>
  private: SponsorPrivate
}

// ---------------------------------------------------------------------------
// Wrestler registrations
// ---------------------------------------------------------------------------

export type RegistrationStatus = 'new' | 'contacted' | 'registered'

export type PaymentMethod = 'zelle' | 'check' | 'cash'

export type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'waived'

/**
 * Payment tracking for a registration.
 *
 * The first block is supplied by the registrant. The confirmation block is
 * admin-only and is what makes a payment auditable: security rules refuse to
 * set `status` to 'paid' without a confirmation reference, a positive amount
 * and a received date, so a payment can never be marked settled without the
 * identifying detail needed to find it on a bank statement later.
 */
export interface RegistrationPayment {
  method: PaymentMethod
  /** Matches a PricingTier id in the organization settings. */
  tierId: string
  /** Whole dollars, snapshotted at submit so later price changes do not rewrite history. */
  amountDue: number
  /** Short code the payer puts in the Zelle or cheque memo, e.g. TWC-4F2K9. */
  reference: string
  status: PaymentStatus

  // ----- admin-only confirmation detail -----
  /** Cheque number, Zelle confirmation number, or cash receipt number. */
  confirmationRef?: string
  amountReceived?: number
  /** YYYY/MM/DD */
  receivedAt?: string
  /** YYYY/MM/DD, cheques only. */
  depositedAt?: string
  confirmedBy?: string
  confirmedAt?: Timestamp
  notes?: string
}

/** The identifying detail an admin must supply to confirm a payment. */
export interface PaymentConfirmationInput {
  status: PaymentStatus
  confirmationRef: string
  amountReceived: number
  receivedAt: string
  depositedAt?: string
  notes?: string
}

export interface RegistrationWrestler {
  firstName: string
  lastName: string
  /** Stored as YYYY/MM/DD so it is trivially validatable in security rules. */
  dob: string
  grade: string
  /**
   * Free text rather than a number: "first year", "2 seasons" and "3" are all
   * answers a parent will give, and none of them are worth rejecting.
   */
  yearsExperience?: string
  previousClub?: string
  /**
   * @deprecated Superseded by registering siblings in one submission. Retained
   * so registrations captured while the question existed still render.
   */
  siblingName?: string
  /** USA Wrestling membership number, where the wrestler already has one. */
  usawNumber?: string
}

/**
 * Which club jobs a family is willing to help with.
 *
 * Belongs to the submission rather than the wrestler: it is the parent
 * volunteering, and a family with three wrestlers is still one set of answers.
 * The specific roles are only meaningful when `interested` is true.
 */
export interface RegistrationVolunteer {
  interested: boolean
  assistantCoach: boolean
  fundraisers: boolean
  sponsorships: boolean
  homeTournament: boolean
}

export interface RegistrationGuardian {
  firstName: string
  lastName: string
  email: string
  phone: string
}

export interface RegistrationAddress {
  street: string
  city: string
  state: string
  postalCode: string
}

export interface RegistrationEmergency {
  name: string
  phone: string
  relationship: string
}

/**
 * Identifying information about a minor. Readable by admins only — see the
 * `registrations` block in firebase/firestore.rules.
 */
export interface Registration {
  id: string
  /**
   * Legacy single-wrestler shape, on submissions predating multi-wrestler
   * support. Read it through `registrationWrestlers()` rather than directly.
   */
  wrestler?: RegistrationWrestler
  /** One family, one submission, one payment. Newest shape. */
  wrestlers?: RegistrationWrestler[]
  guardian: RegistrationGuardian
  address: RegistrationAddress
  emergency: RegistrationEmergency
  payment: RegistrationPayment
  /** Absent on registrations submitted before volunteering was asked about. */
  volunteer?: RegistrationVolunteer
  /** "How did you hear about us?" */
  referralSource?: string
  notes?: string
  status: RegistrationStatus
  createdAt: Timestamp
}

/** The payment fields a registrant may set. Everything else is admin-only. */
export interface RegistrationPaymentInput {
  method: PaymentMethod
  tierId: string
  amountDue: number
  /** Generated at submit; goes in the payment memo. */
  reference: string
}

export interface RegistrationFormPayload {
  /** At least one; the form starts with a single card. */
  wrestlers: RegistrationWrestler[]
  guardian: RegistrationGuardian
  address: RegistrationAddress
  emergency: RegistrationEmergency
  payment: RegistrationPaymentInput
  volunteer?: RegistrationVolunteer
  referralSource?: string
  notes?: string
}

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------
//
//   wrestlers/{id}                  what a bio card may show
//   wrestlers/{id}/private/details  date of birth, guardian contact, USAW number
//
// Split because rules grant access per document and never per field, and bio
// cards are planned. A date of birth in the public document is published the
// moment it is written, whatever the page chooses to render.

/** IKWF places a wrestler by their age on 31 December of the season. */
export type IkwfDivision = 'tot' | 'bantam' | 'intermediate' | 'novice' | 'senior'

export interface Wrestler {
  id: string
  firstName: string
  lastName: string
  /**
   * Derived from the date of birth and the season, never hand-maintained.
   * Public even though the date of birth is not: an age band is not a birthday.
   */
  division?: IkwfDivision
  weightClass?: string
  /** e.g. '2026-27'. The season this record was last enrolled for. */
  season?: string
  /** On the roster this season. Distinct from `published`. */
  active: boolean
  /**
   * Whether this wrestler may appear on the public site.
   *
   * A family asking to be left off flips this, which removes the bio card while
   * leaving the roster entry, stats and history untouched. Without it the only
   * way to honour the request would be deleting a season of results.
   */
  published: boolean
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

/** Admin-only half. Never fetched by a public page. */
export interface WrestlerPrivate {
  /** YYYY/MM/DD, matching the registration convention. */
  dob?: string
  grade?: string
  usawNumber?: string
  guardianName?: string
  guardianEmail?: string
  guardianPhone?: string
  emergencyName?: string
  emergencyPhone?: string
  emergencyRelationship?: string
  notes?: string
  /** Provenance only. Registrations are meant to be deleted, so nothing reads through it. */
  sourceRegistrationId?: string
  updatedAt?: Timestamp
}

// ---------------------------------------------------------------------------
// Match results
// ---------------------------------------------------------------------------
//
// A bout is stored as an ordered log of the calls made, not as a set of totals.
// Counts and the score are both derived from it — see src/utils/matchScoring.ts.
//
// The log is what makes live scoring workable: a mis-tap has to be removable,
// which a counter cannot offer. Bouts entered by hand from a bracket afterwards
// carry `counts` and no log instead, and every consumer reads through one
// accessor that takes whichever is present.

/**
 * A single call, in the order it was made.
 *
 * `side` names the wrestler the call was made ON, which for a scoring move is
 * the wrestler who scored and for an infraction is the offender. That is how
 * the official calls it — "stalling, red" — and therefore what a scorer hears
 * and taps under pressure. Working out who actually gains the point is the
 * derivation's job, not the scorer's.
 */
export type MatchEventType =
  | 'takedown'
  | 'escape'
  | 'reversal'
  /** Near fall values are in the name, so a rules change cannot misread history. */
  | 'nearFall2'
  | 'nearFall3'
  | 'nearFall4'
  | 'penalty1'
  | 'penalty2'
  /*
   * Stalling runs on its own chart, separate from the penalty progression
   * above, and is cumulative across the whole bout: warning, 1, 1, 2, then
   * disqualification. Each rung is its own type so the value stays in the name
   * rather than being inferred from position in the log, which would let a
   * deleted or reordered call silently reprice every stall after it.
   */
  /** First call. Recorded but scores nothing; it is the sequence that matters. */
  | 'stallWarning'
  /** Second and third. */
  | 'stallPoint'
  /** Fourth. Match stops and the opponent chooses position on the restart. */
  | 'stallPoint2'
  /** Fifth. Ends the bout by disqualification and scores nothing itself. */
  | 'stallDq'
  /*
   * False start or incorrect starting position (8-1-3), a third counter again
   * independent of the two above: two cautions are free, then every subsequent
   * one is a point. No disqualification rung.
   */
  /** First and second. Recorded, scores nothing. */
  | 'caution'
  /** Third onwards. */
  | 'cautionPoint'
  /*
   * Position choice at the start of a period. Not a call and worth nothing,
   * but part of a scoresheet: who had choice and what they took explains the
   * shape of the period that follows.
   *
   * Recorded against the period it governs rather than the one it was made at
   * the end of, so the mark sits in the column it belongs to.
   */
  | 'chooseUp'
  | 'chooseDown'
  | 'chooseNeutral'
  /** Hands the choice over, and takes the next period's choice in exchange. */
  | 'defer'

export interface MatchEvent {
  type: MatchEventType
  /** Who the call was made on. See the note above: offender for infractions. */
  side: 'wrestler' | 'opponent'
  /** 1, 2 or 3; overtime periods continue the sequence. */
  period: number
}

/**
 * Totals for a bout entered by hand, where no log exists.
 *
 * Mirrors the event types. Anything derived from a log produces this same
 * shape, so consumers never care which way a bout was captured.
 */
export interface MatchCounts {
  takedowns: number
  escapes: number
  reversals: number
  nearFall2: number
  nearFall3: number
  nearFall4: number
  penalties: number
  stalls: number
  /** False starts and incorrect starting positions. */
  cautions: number
}

export type MatchWinType =
  | 'decision'
  | 'majorDecision'
  | 'techFall'
  | 'fall'
  | 'forfeit'
  | 'injuryDefault'
  | 'disqualification'
  | 'bye'

export type MatchResult = 'win' | 'loss'

export interface Match {
  id: string
  wrestlerId: string
  /** e.g. '2026-27'. Every query is season-scoped. */
  season: string

  /**
   * The club event this bout belongs to, where there is one.
   *
   * Optional because a wrestler may compete at something that was never on the
   * club calendar, and forcing a fake event just to record a bout would be
   * worse than a free-text label.
   */
  eventId?: string
  /**
   * Event name and date copied at write time.
   *
   * Events can be deleted, including in bulk from the events tab. A match
   * holding only an eventId would lose its label entirely when that happens,
   * so the label is snapshotted rather than looked up.
   */
  eventName?: string
  date: Timestamp

  opponentName?: string
  opponentTeam?: string
  weightClass?: string
  /** Free text: "Championship quarterfinal", "Round 3". */
  round?: string

  result: MatchResult
  winType: MatchWinType

  /**
   * The score as the table recorded it, which is authoritative.
   *
   * Kept separate from anything derived: a live tally is a best-effort second
   * screen, and where the two disagree the official result stands while the
   * breakdown is treated as suspect.
   */
  officialFor?: number
  officialAgainst?: number

  /**
   * When the bout stopped, for the endings that stop it early: the period, and
   * how far into it the bout ended.
   *
   * A scoresheet records this, and it is not decoration — "pinned at 0:09 of
   * the first" and "pinned at 1:40 of the third" read as very different
   * results a season later.
   *
   * Absent on a decision, which by definition ran out the clock, and on a
   * forfeit or bye, where nobody wrestled and there was no clock to read.
   */
  endPeriod?: number
  /**
   * 'M:SS' into that period, not left on the clock.
   *
   * Elapsed rather than remaining because remaining only means something if
   * you also know how long the period was, and that varies by division. A
   * stored figure that needs an assumption to read is a figure that will one
   * day be read with the wrong one.
   *
   * 0:00 is legitimate: a technical fall can land exactly on the buzzer.
   */
  endTime?: string

  /** Present when scored live. Takes precedence over `counts`. */
  events?: MatchEvent[]
  /** Present when entered by hand from a bracket. */
  counts?: MatchCounts

  createdAt?: Timestamp
  updatedAt?: Timestamp
  createdByUid?: string
}

// ---------------------------------------------------------------------------
// Photo gallery (designed, not yet wired — blocked on Cloud Storage)
// ---------------------------------------------------------------------------

/**
 * `imageUrl` is deliberately independent of `storagePath` so the gallery works
 * both with pasted URLs today and with Firebase Storage uploads later, without
 * a schema change.
 */
export interface GalleryItem {
  id: string
  title: string
  caption?: string
  imageUrl: string
  thumbnailUrl?: string
  /** Null until Cloud Storage is provisioned. */
  storagePath?: string | null
  album?: string
  order: number
  createdAt?: Timestamp
}

// ---------------------------------------------------------------------------
// X (Twitter) feed
// ---------------------------------------------------------------------------
// Written by scripts/fetch-x-posts.mjs on a schedule, never by the browser.
// The embed widget is not used for these: X's profile-timeline endpoint returns
// an empty result set for this account, so the posts are fetched through the
// paid API and rendered with our own markup.

export interface XFeedMedia {
  /** 'photo' | 'video' | 'animated_gif'; videos carry their poster frame. */
  type: string
  url: string
  alt: string
}

export interface XFeedPost {
  id: string
  text: string
  /** ISO 8601 from the X API, or null if it was somehow absent. */
  createdAt: string | null
  permalink: string
  media: XFeedMedia[]
}

export interface XFeedAuthor {
  name: string
  username: string
  avatar: string
}

export interface XFeed {
  handle: string
  author: XFeedAuthor
  posts: XFeedPost[]
  updatedAt?: Timestamp
}

export type XMentionStatus = 'pending' | 'approved' | 'rejected'

/**
 * A post from someone else that mentions the club.
 *
 * Anyone on X can write one, so these are held in a queue and never appear on
 * the public site until an admin approves them. The document id is the X post
 * id, which makes the fetch job idempotent.
 */
export interface XMention {
  id: string
  text: string
  createdAt: string | null
  permalink: string
  author: XFeedAuthor
  media: XFeedMedia[]
  status: XMentionStatus
  fetchedAt?: Timestamp
  moderatedBy?: string
  moderatedAt?: Timestamp
}
