# Cary Grove Junior Trojans (CGJT) Wrestling Website

Official site for the Cary Grove Junior Trojans Wrestling club. Built with **Quasar (Vue 3 + TypeScript)** frontend + **Firebase (Firestore + Auth)** for data and admin access.

## Stack & Architecture

- **Frontend**: Quasar v2 (Vue 3, Composition API with `<script setup lang="ts">`), TypeScript, Pinia, Quasar UI components
- **Backend/Data**: Firebase Firestore (real-time) + Firebase Authentication
- **Auth for Admins**: Email/password via Firebase. Write access controlled by `/admins` collection + security rules
- **No custom Express server** (kept extremely lightweight per requirements)
- **Mobile-first**: Responsive layouts, drawer navigation, touch-friendly forms

## Features (MVP)

**Public Site**
- Home with hero, upcoming events teaser, announcements teaser, and live X (Twitter) timeline embed
- About the team
- Schedule / Events (full list with filters)
- Announcements (chronological, real-time updates)
- Contact

**Admin (Protected)**
- Simple login at `/admin/login`
- Dashboard to Create / Edit / Delete Events and Announcements (real-time)
- Only users with a document in the `admins` Firestore collection can write

**Real-time**: Changes made by any admin instantly appear for all visitors (powered by Firestore `onSnapshot`).

---

## Quick Start (Detailed for Firebase Newcomers)

### 1. Clone / Copy the Boilerplate

```bash
# If you are copying this workspace
cp -r /home/proto/CGJT/* /path/to/your/cgjt-repo/
cd /path/to/your/cgjt-repo
```

### 2. Create the Quasar Frontend

```bash
# In the project root
npm create quasar@latest client

# When prompted (recommended choices):
# - Project name: cary-grove-junior-trojans (or leave default)
# - Package name: client
# - Project description: Cary Grove Junior Trojans Wrestling
# - Use TypeScript: Yes
# - Use ESLint + Prettier: Yes (recommended)
# - Install Vue Router, Pinia? The CLI will offer — choose yes for both if asked
# - Other features: leave mostly default (SPA, no SSR/PWA for launch)
```

After creation, your folder should look like:

```
CGJT/
├── client/                 # ← Quasar project lives here
├── firebase/               # firestore.rules (we provide)
├── README.md
└── .gitignore
```

### 3. Install Required Packages

```bash
cd client

npm install firebase pinia
# date-fns is optional but nice for dates (we use native + Quasar helpers to keep it light)
npm install -D @types/node
```

### 4. Create a New Firebase Project (Brand New)

1. Go to https://console.firebase.google.com/
2. Click **Add project**
3. Name it `cary-grove-junior-trojans` (or `cgjt-wrestling`)
4. Disable Google Analytics for now (you can add later)
5. Create project

**Enable Authentication**
- In left menu: **Build** → **Authentication** → **Get started**
- Sign-in method → **Email/Password** → Enable → Save

**Create Firestore Database**
- **Build** → **Firestore Database** → **Create database**
- Start in **production mode** (we will deploy better rules)
- Choose a region close to Illinois (us-central1 or us-east1 recommended)
- Create

**Get your Web App Config**
- Click the gear icon (⚙️) → **Project settings**
- Scroll to "Your apps" → Click the web icon (`</>`)
- Give it a nickname: `CGJT Web App`
- **Do NOT** check "Also set up Firebase Hosting" yet
- Copy the entire `firebaseConfig` object — you will need it in step 6

### 5. Add Environment Variables

In the `client/` folder, create a file named `.env` (never commit this):

```env
VITE_FIREBASE_API_KEY=your-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef123456
# Optional for future
# VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

Use the values from the config you copied in step 4.  
**Important**: All variables must be prefixed with `VITE_` to be exposed to the browser.

Copy `.env.example` (provided in this boilerplate) as a template.

### 6. Deploy Firestore Security Rules (Critical)

The rules in `firebase/firestore.rules` are the security layer that prevents random people from editing content.

```bash
# From the CGJT root (not inside client)
npm install -g firebase-tools
firebase login

firebase init

# Choose:
# - Firestore: yes (select existing project you just created)
# - Rules file: accept default (firestore.rules) or point it to the one in ./firebase/firestore.rules
# - Hosting: yes (we'll configure later)
# - Public directory: client/dist/spa
# - SPA rewrite: yes (single page app)

# Now deploy the rules
firebase deploy --only firestore:rules
```

You can also copy the contents of `firebase/firestore.rules` directly into the Firebase console (Firestore → Rules tab) for the first time.

### 7. Create Your First Admin User

1. Start the dev server:
   ```bash
   cd client
   quasar dev
   ```

2. Go to `http://localhost:9000/admin/login`

3. Create an account using **Email/Password** (the same one you want as admin).

   > Note: At this point writes will fail — this is expected.

4. Go to Firebase Console → **Authentication** → **Users**
   - Find the user you just created
   - Copy the **User UID** (long string like `aBcD123...`)

5. Go to **Firestore Database** → **Start collection**
   - Collection ID: `admins`
   - Document ID: paste the **UID** you copied
   - Add any fields you want (optional: `email`, `name`, `addedAt`)
   - Save

6. Refresh the site. You should now be able to create Events and Announcements.

**Security Rules Explanation**:
- Anyone (even logged out) can read `events` and `announcements`
- Only users whose UID exists as a document in `/admins/{uid}` can create/update/delete

### 8. (Optional but Recommended) Set Up Firebase Hosting

```bash
# From project root
firebase init hosting

# Public directory: client/dist/spa
# SPA: yes
# GitHub deploys: no (for now)

# Build + deploy
cd client
quasar build
firebase deploy
```

Your site will be live at `https://your-project.web.app`

---

## X (Twitter) Feed Setup

The Home page includes an official X embedded timeline.

1. Find the real club handle (e.g. `@CGJTWrestling`)
2. Open `client/src/components/XTimeline.vue`
3. Change the `href` and text from the placeholder to the real account
4. (Optional) Adjust `data-tweet-limit`

The embed is mobile-friendly and updates automatically.

---

## Project Structure (After Setup)

```
CGJT/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── EventCard.vue
│   │   │   ├── AnnouncementCard.vue
│   │   │   ├── XTimeline.vue
│   │   │   └── admin/
│   │   ├── layouts/
│   │   │   ├── MainLayout.vue
│   │   │   └── AdminLayout.vue
│   │   ├── pages/
│   │   │   ├── IndexPage.vue          # Home
│   │   │   ├── AboutPage.vue
│   │   │   ├── EventsPage.vue
│   │   │   ├── AnnouncementsPage.vue
│   │   │   ├── ContactPage.vue
│   │   │   └── admin/
│   │   │       ├── LoginPage.vue
│   │   │       └── DashboardPage.vue
│   │   ├── router/
│   │   ├── stores/
│   │   │   ├── auth.ts
│   │   │   ├── events.ts
│   │   │   └── announcements.ts
│   │   ├── firebase/
│   │   │   └── index.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── css/
│   │   │   └── app.scss               # Navy/white theme overrides
│   │   └── App.vue
│   ├── quasar.config.ts               # Brand colors + title here
│   └── .env.example
├── firebase/
│   └── firestore.rules
├── README.md
└── .gitignore
```

---

## Development Commands

```bash
cd client
quasar dev          # http://localhost:9000
quasar build        # production build → dist/spa
quasar test         # (later)
```

---

## Data Models (Firestore)

**events** collection
```ts
{
  id: string (auto)
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
```

**announcements** collection
```ts
{
  id: string
  title: string
  body: string
  pinned: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

**admins** collection (for access control)
```ts
// Document ID = Firebase Auth UID
{
  email?: string
  name?: string
  addedAt: Timestamp
}
```

---

## Customization Points

- **Colors**: `client/quasar.config.ts` → `brand` section
- **X Handle**: `client/src/components/XTimeline.vue`
- **Site name / tagline**: Multiple places (quasar.config + pages) — search for "Cary Grove Junior Trojans"
- **Contact info**: `ContactPage.vue` + footer in MainLayout
- **Sample data**: Use the admin UI after first admin is set up

---

## Mobile-First Notes

Quasar's layout system (QHeader, QDrawer, QPageContainer) is mobile-first by default.
- Navigation collapses to a left drawer on small screens
- All forms use full-width stacked inputs on mobile
- X timeline widget gracefully scales
- Test with Chrome DevTools device toolbar

---

## Next Steps / Future Ideas

- Add results / past matches to events
- Photo gallery (Firebase Storage + admin upload)
- Email notifications on new announcements (Firebase Functions + SendGrid)
- Parent registration form
- Wrestler roster management (editable by admins)
- ICS calendar export for events

---

## Troubleshooting

**"Missing or insufficient permissions" on create**  
→ You have not created the matching document in the `admins` collection yet. See step 7.

**Firebase config not loading**  
→ Make sure variables start with `VITE_` and you restarted `quasar dev` after editing `.env`.

**X timeline not showing**  
→ The account must be public. Also check browser console for widget script errors.

**Real-time not updating**  
→ Check that `onSnapshot` listeners are active (they are in the Pinia stores).

---

**Questions?** Start development and open issues in your repo. This boilerplate is intentionally simple and well-commented so you (and future volunteer admins) can extend it easily.

Go Trojans! 💪
