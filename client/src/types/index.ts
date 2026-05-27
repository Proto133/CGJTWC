import { Timestamp } from 'firebase/firestore'

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

export type EventType = Event['type']
