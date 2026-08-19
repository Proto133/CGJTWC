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

export interface AdminDoc {
  email?: string
  name?: string
  addedAt?: Timestamp
}

// Written to /accessRequests/{uid} when someone signs up. Document ID is the
// Firebase Auth UID, so approving = copying that ID into /admins/{uid}.
export interface AccessRequest {
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
  notes?: string
  status: RegistrationStatus
  createdAt: Timestamp
}

export interface RegistrationFormPayload {
  wrestler: RegistrationWrestler
  guardian: RegistrationGuardian
  address: RegistrationAddress
  emergency: RegistrationEmergency
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
