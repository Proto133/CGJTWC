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
