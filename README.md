# LifeOS v2

LifeOS is a Firebase-backed personal productivity workspace for tasks, projects, planning, focus sessions, habits, reminders, insights, and weekly review.

## Features

- Email/password Firebase Auth with protected app pages
- Firestore task CRUD with quick capture, tags, priority, due date/time, reminders, and recurring task rules
- Projects with progress, areas, status, emojis, and task assignment
- Saved Views with reusable task filters
- Today planning with Top 3 priorities, Deep Work, time blocks, and daily reflection
- Focus timer with Pomodoro sessions and focus analytics
- Habits with daily completion and weekly review integration
- Weekly Review with saved reflections and next-week planning
- Insights, reporting, daily quotes, and rule-based recommendations
- Custom accessible confirmation modals
- PWA basics: manifest, service worker, offline fallback, install guidance
- Settings export/import/delete tools for user-owned LifeOS data

## Tech Stack

- Vite
- React
- TypeScript
- Firebase Auth
- Cloud Firestore
- Firebase Hosting
- Recharts
- Lucide React icons

## Local Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Fill `.env` with your Firebase web app config:

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Do not commit `.env`. The repository keeps only `.env.example`.

## Build

```bash
npm run build
```

## Firebase Setup

Enable:

- Firebase Authentication: Email/password provider
- Cloud Firestore
- Firebase Hosting, if deploying

Deploy Firestore rules:

```bash
firebase deploy --only firestore:rules
```

Deploy the Vite app to Firebase Hosting:

```bash
npm run build
firebase deploy --only hosting
```

`firebase.json` is configured for:

- `dist` as the hosting public directory
- SPA rewrite to `/index.html`
- `sw.js` served with no-cache headers

## Firestore Data Model

All user data is scoped under:

```text
users/{uid}
```

Collections:

```text
users/{uid}/tasks/{taskId}
users/{uid}/projects/{projectId}
users/{uid}/filters/{filterId}
users/{uid}/dailyPlans/{YYYY-MM-DD}
users/{uid}/focusSessions/{sessionId}
users/{uid}/favoriteQuotes/{quoteId}
users/{uid}/habits/{habitId}
users/{uid}/habits/{habitId}/completions/{dateId}
users/{uid}/weeklyReviews/{weekId}
users/{uid}/settings/main
```

Recurring task fields and reminders are stored on task documents.

## Backup And Restore

Settings includes Data & Backup tools:

- Export downloads `lifeos-backup-YYYY-MM-DD.json`
- Import validates a LifeOS backup and merges it into the current signed-in user
- Import skips documents whose IDs already exist
- Delete app data removes current user LifeOS data but keeps the Auth account
- Delete account attempts to delete app data, then the Firebase Auth account

Backups do not include Firebase secrets or `.env` values.

## PWA Notes

LifeOS includes:

- `manifest.webmanifest`
- SVG app icons
- service worker shell caching
- offline fallback page

The current service worker does not implement full offline Firestore writes or conflict resolution. Saving changes requires a connection.

## Security Notes

`firestore.rules` denies public reads/writes and scopes all app data to `request.auth.uid == uid`.

Review rules before deploying changes. Firebase web config values are public identifiers, but `.env` should still stay out of Git.

## Known Limitations

- No AI features
- No calendar sync
- No team collaboration
- No payments
- No native mobile app
- No full offline create/edit/sync yet
- Browser notifications work while LifeOS is open; background reminders require a future PWA/service worker phase

## Roadmap

- Offline-safe write queue
- Calendar integration
- More advanced reporting
- Optional AI planning assistance
- Team/collaboration features
- Native mobile app exploration
