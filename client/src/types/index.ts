import type { Timestamp } from 'firebase/firestore'

export interface Event {
  id: string
  title: string
  date: Timestamp
  time?: string
  location: string
  type: 'practice' | 'dual' | 'tournament' | 'other'
  opponent?: string
  description?: string
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
  time?: string
  location: string
  type: EventType
  opponent?: string
  description?: string
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
  wrestler: RegistrationWrestler
  guardian: RegistrationGuardian
  address: RegistrationAddress
  emergency: RegistrationEmergency
  payment: RegistrationPayment
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
  wrestler: RegistrationWrestler
  guardian: RegistrationGuardian
  address: RegistrationAddress
  emergency: RegistrationEmergency
  payment: RegistrationPaymentInput
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
