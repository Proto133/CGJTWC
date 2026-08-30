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

### 7c. Preview Deploy on GitHub Pages (temporary)

A GitHub Actions workflow at `.github/workflows/deploy-pages.yml` builds the app
and publishes it to GitHub Pages on every push to `main`. This is a temporary
preview host for showing work in progress; the intended long-term target is
Firebase Hosting or Vercel.

**One-time setup**

1. Repository **Settings → Pages → Build and deployment → Source: GitHub Actions**.
   If Pages is set to "Deploy from a branch" it serves the repo root, which is
   why it renders the README instead of the site.
2. Repository **Settings → Secrets and variables → Actions**, add the six values
   from `client/.env`:
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
   `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`,
   `VITE_FIREBASE_APP_ID`.
   These are client-side identifiers that ship in any browser bundle, so they are
   not sensitive — but `client/.env` is gitignored, so the build cannot see them
   otherwise.
3. Firebase Console → **Authentication → Settings → Authorized domains**, add
   `proto133.github.io`. Without it, admin sign-in on the Pages site fails with
   `auth/unauthorized-domain`. Public pages work regardless.

The site is then served at `https://proto133.github.io/CGJTWC/`.

**How the subpath is handled**

Pages serves from `/CGJTWC/` rather than the domain root, which breaks two things
by default. Both are handled without hardcoding anything:

- Asset paths. The workflow sets `PAGES_BASE=/CGJTWC/`, which feeds
  `build.publicPath` in `quasar.config.ts`. Local builds and any root-served host
  are unaffected because the variable defaults to `/`. Public files referenced
  from components go through `assetUrl()` in `client/src/utils/assets.ts`, which
  prefixes `import.meta.env.BASE_URL`.
- Deep links. Pages has no SPA rewrite, so `/CGJTWC/staff` would 404 on refresh.
  The workflow copies `index.html` to `404.html`, which Pages serves for unknown
  paths, letting the router take over while keeping clean URLs.

**Note:** publishing makes the public registration form reachable by anyone with
the URL, writing into the live Firestore project. The rules make that collection
write-only for the public, but real submissions will land in the admin inbox.

**Moving to Vercel or Firebase Hosting later:** nothing in the source assumes the
subpath. Build without `PAGES_BASE` and deploy `client/dist/spa`, with an SPA
rewrite to `index.html`.

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

The Home page shows the club's latest X posts. They are fetched server-side and
cached in Firestore, then rendered with our own markup.

### Why it works this way

The obvious approach — X's embedded timeline widget — does not work for this
account. X's syndication endpoint answers `HTTP 200` with `"entries": []` for
`@CaryTrojansWC`, while returning a full timeline for large accounts fetched
seconds earlier from the same IP. Single-post embeds *do* work, which is why
the curated "featured posts" path still exists as a fallback.

So the primary path uses the paid X API instead. That has to run server-side: a
bearer token in the browser bundle is readable by anyone, and a leaked token
spends real credits. There is no backend (Cloud Functions would need the Blaze
plan), so a scheduled GitHub Action fills that role. It is free on a public
repository.

```
                          /-> social/xFeed  -> site (immediately)
GitHub Action -> X API --<
  (every 6h)              \-> xMentions     -> admin approval -> site
```

The site subscribes to Firestore, so a successful run appears without a
redeploy.

### Cost

Reading your own account's posts is an "owned read" at **$0.001 per post**. X
deduplicates charges for the same post within a UTC day, so four runs a day cost
little more than one. Expect single-digit dollars per *year* at club posting
volume. Set a spending limit in the X Developer Console anyway.

Note the free tier was removed in February 2026 and the old $200/month Basic
tier is closed — pay-per-use with prepaid credits is the only self-serve option.

### One-time setup

1. **Get a bearer token.** <https://console.x.com> → create a Project, then an
   App inside it → copy the OAuth 2.0 **Bearer Token**. Read-only app-only auth
   is all this needs. Load credits and set a spending limit while you are there.
2. **Create a Firebase service account key.** Firebase Console → Project
   Settings → Service Accounts → **Generate new private key**. This downloads a
   JSON file. It grants full admin access and bypasses all security rules, so
   never commit it — `.gitignore` blocks the usual filenames as a backstop.
3. **Add two repository secrets** under Settings → Secrets and variables →
   Actions → Secrets:
   - `X_BEARER_TOKEN` — the token from step 1
   - `FIREBASE_SERVICE_ACCOUNT` — the *entire contents* of the JSON file
4. **Run it once.** Actions tab → "Refresh X feed" → Run workflow.
5. **Pin the user id.** The first run prints the numeric id for the handle.
   Add it as a repository *variable* named `X_USER_ID`. Resolving a handle is a
   $0.010 user read; pinning the id skips that on every future run.

Optional repository variables: `X_HANDLE` (defaults to `CaryTrojansWC`),
`X_MAX_POSTS` (defaults to 6, minimum 5), `X_MAX_MENTIONS` (defaults to 10) and
`X_FETCH_MENTIONS` (set to `false` to stop fetching mentions entirely).

### Fallback order

The component tries each in turn:

1. **API posts** from `social/xFeed` — rendered natively. When these exist the
   page loads no third-party script at all. The component waits for the
   Firestore listener's first response before deciding, because at mount the
   feed is always empty and deciding then would request the widget script every
   time.
2. **Featured posts** — post URLs set in Admin → Settings → Social accounts,
   embedded with X's `createTweet`. Useful before the job first runs, or to pin
   something specific.
3. **Profile timeline widget** — kept for completeness; currently returns empty
   for this account.
4. **A plain link** to the profile.

Because `mergeSection` treats an empty array as "not set", clearing the featured
list in the dashboard falls back to the defaults in `organization.ts` rather
than showing none. Edit that file to remove the seeded post.

### Mentions are moderated

Anyone on X can mention the club, so mentions are treated as untrusted content
on a site used by families. They are fetched into `xMentions` with
`status: 'pending'` and **nothing appears publicly until an admin approves it**
in Admin → Mentions.

The quarantine is enforced by security rules, not just by the UI:

- Public reads are granted only when `status == 'approved'`. An unfiltered list
  query is rejected outright, so pending and rejected mentions cannot be read by
  anyone but an admin.
- Nobody in a browser can *create* a mention. The only writer is the Admin SDK
  in the scheduled job, which bypasses rules.
- Admins can change the status and nothing else. The text, author, media and
  permalink are pinned to what X returned, so approved content cannot be swapped
  for something else afterwards.
- The job only ever creates documents it has not seen before, so a re-run never
  resets a decision you already made back to pending.

Rejecting keeps a record; deleting removes it, and it returns as pending if X
still serves it on a later fetch.

### Things that are not possible

- **Mention embeds.** X retired search and mention *embeds*, which is why these
  go through the API rather than a widget.
- **Live updates.** The embedded-timeline widget dropped live updates in 2022,
  and the scheduled job runs every six hours. Use the manual "Run workflow"
  button to refresh immediately after posting.

> Seeing `429` responses from `syndication.twitter.com` in the console is an
> X-side per-IP rate limit on the *widget*, not a bug in this app. Repeated
> testing from one address triggers it and it affects the browser too. The API
> path does not go through that host.

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
  // Wall-clock 'HH:MM', 24-hour, e.g. '16:15'. NOT a UTC instant and not
  // offset-bearing: the season crosses the November DST change, so anything
  // carrying an offset would move a 4:15 PM practice by an hour mid-season.
  startTime?: string
  endTime?: string
  // Explicitly all day, which is distinct from no time recorded at all.
  // Neither field set means nobody filled it in, and nothing is displayed.
  allDay?: boolean
  time?: string        // DEPRECATED free-text time, read as a display fallback
  location: string
  type: 'practice' | 'dual' | 'tournament' | 'other'
  group?: string       // squad: 'TBI', 'NS', or 'ALL' for both; blank = none
  opponent?: string
  description?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}
```
Times and squads are parsed and formatted in one place each
(`client/src/utils/eventTimes.ts`, `client/src/utils/eventGroups.ts`) rather than
being reimplemented per component. An ambiguous imported time such as `4:15`
with no AM/PM is rejected as a row error rather than guessed at.

Events are sorted client-side by date and then start time. Firestore's
`orderBy('date')` gives no tie-break, and with two squads practising twice a
week most days hold more than one event.

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
- Wrestler roster management (editable by admins)
- Printable season schedule (compact table via `@media print`, respecting the
  active schedule filters)
- ICS calendar feed. A downloadable `.ics` needs no new infrastructure; an
  auto-updating *subscription* needs a static `schedule.ics` generated by a
  scheduled Action, following the same pattern as the X feed job, because
  Hosting is static and Cloud Functions would require Blaze. Note that calendar
  clients refresh external feeds on their own schedule, often many hours, so a
  feed is not a notification channel.

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
