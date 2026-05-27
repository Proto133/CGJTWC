# Quasar Project Setup Instructions

This folder (`client/`) must be created using the official Quasar CLI.

## Exact Commands

```bash
# From the CGJT root directory
npm create quasar@latest client

# Recommended answers during the wizard:
# - What would you like to build?  →  App with Quasar CLI
# - Project name / folder             →  client  (already created)
# - Package name                      →  (accept default)
# - Project description               →  Cary Grove Junior Trojans Wrestling website
# - Use TypeScript?                   →  Yes
# - Use ESLint?                       →  Yes
# - Use Prettier?                     →  Yes
# - Install Vue Router?               →  Yes
# - Use Pinia?                        →  Yes   (we use it heavily)
# - Other options                     →  Leave defaults (SPA, no SSR/PWA for v1)
```

After the CLI finishes, **overwrite or merge** the following files/folders with the ones provided in this boilerplate:

- `quasar.config.ts`
- `src/css/app.scss`
- `src/boot/pinia.ts`
- `src/firebase/`
- `src/stores/`
- `src/types/`
- `src/router/`
- `src/layouts/`
- `src/pages/`
- `src/components/`
- `.env.example` → copy to `.env` and fill values

Then run:

```bash
cd client
npm install firebase pinia
quasar dev
```

You're done.
