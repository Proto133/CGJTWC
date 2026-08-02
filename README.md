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
├── firebase.json           # points at firebase/firestore.rules
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

# firebase.json in this repo already points at ./firebase/firestore.rules,
# so you can deploy directly — no `firebase init` needed for rules.
firebase deploy --only firestore:rules
```

You should see `rules file ./firebase/firestore.rules compiled successfully`. If the CLI
cannot find the file, check the `firestore.rules` path in `firebase.json`.

You can also copy the contents of `firebase/firestore.rules` directly into the Firebase console (Firestore → Rules tab) for the first time.

> **Do not skip this step.** A brand-new Firestore database starts in test mode,
> which lets *anyone* on the internet read and write every collection — including
> the contact details in `admins` and `accessRequests`. Nothing in the app is
> actually protected until these rules are deployed.

To confirm the rules are live, open the **Rules** tab in the console and check that
the published version ends with the catch-all `allow read, write: if false;` block.

### 7. Create Your First Admin User (Bootstrap)

The very first admin has to be created by hand, because there is no existing admin
around to approve anyone yet. Do this in the Firebase Console:

1. Go to **Authentication** → **Users** → **Add user**
   - Enter the email and a password you want to use
   - Save, then copy the **User UID** (long string like `aBcD123...`)

   > If the Users tab is missing, Authentication was never initialized — click
   > **Get started**, then enable **Email/Password** under Sign-in method.

2. Go to **Firestore Database** → **Start collection**
   - Collection ID: `admins`
   - Document ID: paste the **UID** you copied
   - Fields are optional and purely informational (e.g. `firstName`, `lastName`,
     `email`, `phone`) — the app only checks that the document *exists*
   - Save

3. Start the dev server and sign in:
   ```bash
   cd client
   quasar dev
   ```
   Go to `http://localhost:9000/admin/login` and log in with those credentials.
   You should now be able to create Events and Announcements.

### 7b. Approving Additional Admins (Self-Serve Signup)

After the first admin exists, other volunteers can request access from the site
instead of you creating their accounts manually.

**What they do:**
1. Go to `/admin/login` and click **Request admin access**
2. Fill in first name, last name, email, optional phone, and a password
3. On submit the app creates their Firebase Auth account, files a request, and
   signs them straight back out with a "waiting for approval" message

**What you do:**
1. Open **Firestore Database** → `accessRequests`
2. Each document holds their name, email and phone — and **the document ID is
   their Auth UID**
3. To approve: copy that document ID and create a document with the *same ID*
   in the `admins` collection
4. To reject: delete the request document (and optionally delete the user under
   **Authentication → Users**)
5. Optionally delete the request doc after approving — it is only an inbox

The requester can sign in normally as soon as the `admins` document exists; no
redeploy or restart is needed.

**Security Rules Explanation**:
- Anyone (even logged out) can read `events` and `announcements`
- Only users whose UID exists as a document in `/admins/{uid}` can create/update/delete
- `admins` documents are readable only by the matching signed-in user
- `accessRequests` can only be *created* by a signed-in user for their own UID,
  with a fixed set of fields, length limits, a server-generated `createdAt`, and
  an email that must match their authenticated account. Only admins can read,
  edit, or delete them, so the collection cannot be used to harvest contact
  details or as free storage
- Creating an access request grants **no** privileges by itself
- Everything else is denied by a catch-all rule

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
2. Open `client/src/pages/IndexPage.vue` and update the `handle` prop on the
   `<XTimeline />` tag (the `limit` prop controls how many posts show)
3. The default handle lives in `client/src/components/XTimeline.vue` if you
   prefer to change it in one place

The embed is mobile-friendly and updates automatically.

> X aggressively rate-limits its timeline widget. Seeing `429` responses for
> `platform.twitter.com` in the console — especially from `localhost` or for a
> placeholder/private account — is an X-side limit, not a bug in this app.

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
// Existence of the document is what grants access; fields are informational only
{
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
}
```

**accessRequests** collection (pending admin approvals)
```ts
// Document ID = Firebase Auth UID of the requester
// Approve by copying this document ID into the `admins` collection
{
  firstName: string
  lastName: string
  email: string        // must match the requester's authenticated email
  phone?: string
  createdAt: Timestamp // server-generated
}
```

---

## Customization Points

- **Colors**: `client/quasar.config.ts` → `brand` section
- **X Handle**: `handle` prop in `client/src/pages/IndexPage.vue` (default lives in `client/src/components/XTimeline.vue`)
- **Admin approvals**: `accessRequests` → `admins` in Firestore (see step 7b)
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

**Anyone can read or write the database**  
→ The security rules were never deployed and Firestore is still in test mode. Run
`firebase deploy --only firestore:rules` from the project root. See step 6.

**A volunteer signed up but still can't get in**  
→ Signing up only files a request. Approve them by copying their document ID from
`accessRequests` into the `admins` collection. See step 7b.

**"Request submitted" never appears / request fails to save**  
→ The rules for `accessRequests` were not deployed, or the submitted email does not
match the authenticated account. Redeploy the rules and try again.

**Firebase config not loading**  
→ Make sure variables start with `VITE_` and you restarted `quasar dev` after editing `.env`.

**Wrong project in the Firebase Console**  
→ The console URL contains an account index (`/u/0/`). If you see "no project or you
lack permissions", you are signed into the wrong Google account — switch accounts or
try `/u/1/`. Also confirm you are in the project matching `VITE_FIREBASE_PROJECT_ID`
in `client/.env`.

**X timeline not showing**  
→ The account must be public. Also check browser console for widget script errors;
repeated `429` responses mean X is rate-limiting the widget.

**Real-time not updating**  
→ Check that `onSnapshot` listeners are active (they are in the Pinia stores).

---

**Questions?** Start development and open issues in your repo. This boilerplate is intentionally simple and well-commented so you (and future volunteer admins) can extend it easily.

Go Trojans! 💪
