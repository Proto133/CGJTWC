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
