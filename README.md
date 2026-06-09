# LifeOS v2

LifeOS v2 is a full-stack personal productivity app for planning tasks, managing projects, running focus sessions, tracking habits, reviewing the week, and backing up personal data. It is built as a Firebase-backed React application with protected user data, PWA install support, custom themes, reminders, reporting, and a professional task-app interface.

This project is designed as a portfolio-ready product build: not a static demo, but a working application with authentication, Firestore persistence, responsive UI, data export/import, and production deployment support.

## Live Demo

Add your deployed URL here after publishing:

```text
https://your-lifeos-demo-url.web.app
```

Recommended portfolio note: create a demo account or seed demo data before sharing publicly, so reviewers can see the app without needing your personal workspace.

## Product Highlights

- Secure Firebase Authentication with email/password login, email verification, and password reset.
- Protected application routes for signed-in users only.
- Firestore-backed task management with projects, tags, priorities, due dates, due times, reminders, and recurring task rules.
- Today planning dashboard with Top 3 priorities, Deep Work task, time blocks, quick capture, and daily reflection.
- Focus timer with Pomodoro sessions, focus history, optional browser notifications, and focus analytics.
- Habits with daily completion, weekly progress, streaks, archive/delete flows, and Weekly Review integration.
- Weekly Review workflow with reflection fields, project review, habit review, focus review, next-week planning, save status, and completion state.
- Insights and Reporting dashboard with charts, filters, recommendations, and demo analytics data.
- Saved Views for reusable task filters.
- Custom themes, dark mode, accent colors, and app icon personalization.
- Custom accessible modal dialogs instead of native browser alerts/confirms.
- PWA basics: manifest, install support, app icons, service worker shell caching, and offline fallback.
- Settings tools for JSON export, safe import, delete app data, and delete account flow.

## Tech Stack

- React 18
- TypeScript
- Vite
- Firebase Auth
- Cloud Firestore
- Firebase Hosting
- Recharts
- Lucide React
- CSS custom properties/design tokens

## Screenshots

Add screenshots before using this in your portfolio. Suggested images:

- Dashboard / command center
- Today planning page
- Add/Edit Task modal with repeat and reminders
- Focus timer
- Insights / Reporting dashboard
- Weekly Review
- Settings / Appearance
- Mobile navigation drawer

Suggested folder:

```text
public/portfolio/
```

Then embed them here:

```md
![LifeOS dashboard](public/portfolio/dashboard.png)
```

## Core Features

### Task Management

LifeOS supports full task CRUD with:

- Inbox, Today, Upcoming, completed, and archived states
- Project assignment
- Priority and energy labels
- Tags
- Due date and due time
- Estimated minutes
- Task emojis
- Notes
- Quick capture with `#tag`, `!priority`, and `+ProjectName`
- Recurring tasks with repeat frequency, selected weekdays, end date, and repeat count
- Task reminders stored with the task document

### Planning

The Today page turns a task list into a daily plan:

- Top 3 priorities
- Deep Work task
- Overdue and today task lists
- Time blocks
- Daily reflection
- Focus session shortcut
- Daily summary metrics

### Focus Sessions

The Focus page includes:

- Pomodoro, short break, long break, and custom modes
- Start, pause, resume, cancel, and complete controls
- Session notes
- Task/project linking
- Completed focus history
- Focus stats for Today and Insights

### Habits

The Habits page supports:

- Create/edit/archive/delete habits
- Mark done today
- Undo today completion
- Weekly completion
- Simple streaks
- Weekly Review integration

### Weekly Review

The Weekly Review page helps the user reflect and plan:

- Week selector
- Weekly snapshot metrics
- Completed tasks and focus summaries
- Habit review
- Project health review
- Daily reflection synthesis
- Reflection questions
- Next-week project and task priorities
- Draft/saved/completed state

### Insights And Reporting

Insights include:

- Task completion trends
- Focus minutes by day/project
- Project and area performance
- Priority and tag analysis
- Planned vs completed summaries
- Rule-based recommendations
- Development-only demo analytics data tools

### Settings And Product Readiness

Settings include:

- Appearance customization
- Dark/light/system theme
- Accent color presets and custom color
- App icon personalization
- Notification permission controls
- Install LifeOS guidance
- Data export/import
- Delete app data
- Delete account
- Privacy and Terms pages

## Architecture

```text
src/
  components/          Reusable UI and feature components
  components/settings/ Settings cards and account/data tools
  pages/               Public legal pages
  utils/               Backup/import and supporting utilities
  App.tsx              Protected app shell, routing, and orchestration
  dataHooks.ts         Firestore subscription hooks and document mapping
  types.ts             Shared TypeScript models
  styles.css           Global design system and app styles
```

The app uses hash-based navigation so Firebase Hosting can serve it as a single-page application with a rewrite to `index.html`.

## Firestore Data Model

All application data is scoped to the signed-in user:

```text
users/{uid}
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

Recurring task fields and reminders are stored on task documents for simpler task editing and backup/import.

## Security

Firestore rules are designed so authenticated users can read and write only their own data under `users/{uid}`.

Important security decisions:

- No public reads.
- No public writes.
- Firestore access is scoped by `request.auth.uid == uid`.
- `.env` is ignored by Git.
- Firebase web config values are loaded from Vite environment variables.
- Export/import only works for the current signed-in user.

Review `firestore.rules` before production deployment.

## Local Setup

Install dependencies:

```bash
npm install
```

Create your local environment file:

```bash
cp .env.example .env
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

Run the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Firebase Setup

In Firebase Console:

1. Create a Firebase project.
2. Add a Web App.
3. Enable Authentication.
4. Enable Email/Password sign-in.
5. Configure authorized domains for local and deployed URLs.
6. Enable Cloud Firestore.
7. Deploy Firestore rules.
8. Enable Firebase Hosting.

Deploy Firestore rules:

```bash
firebase deploy --only firestore:rules
```

Deploy the app:

```bash
npm run build
firebase deploy --only hosting
```

## PWA Notes

LifeOS includes:

- Web app manifest
- App icons
- Install support
- Service worker shell caching
- Offline fallback page

Current limitation: LifeOS does not implement full offline Firestore write sync. If the user is offline, saving changes still requires a connection.

## Backup And Restore

Settings includes Data & Backup tools:

- Export downloads a JSON backup named `lifeos-backup-YYYY-MM-DD.json`.
- Import validates a LifeOS backup and merges it into the current user account.
- Existing document IDs are skipped to avoid silently overwriting data.
- Delete app data removes current user app data.
- Delete account requires confirmation and attempts to remove app data plus the Firebase Auth account.

Backups do not include `.env`, Firebase secrets, or other users' data.

## Portfolio Talking Points

Use these points when describing the project:

- Built a production-style React/Firebase productivity app from scratch.
- Designed secure user-scoped Firestore data access.
- Implemented real authentication, email verification, reset password, and protected routes.
- Built a multi-feature task system with recurring tasks, reminders, planning, and focus tracking.
- Added export/import and destructive data tools with custom confirmation modals.
- Created a responsive design system with dark mode and theme personalization.
- Improved product readiness with PWA support, Firebase Hosting setup, Privacy/Terms pages, and deployment documentation.

## Known Limitations

- No AI features.
- No calendar sync.
- No team collaboration.
- No payments.
- No native mobile app.
- No full offline create/edit/sync.
- Browser notifications work while LifeOS is open; full background reminders require a future PWA/service worker phase.
- Installed PWA icons may be cached by browsers and may require reinstalling to refresh.

## Suggested Next Steps

### Before Adding To Portfolio

1. Deploy the latest build to Firebase Hosting.
2. Create a demo account with realistic sample data.
3. Add screenshots to the README or portfolio page.
4. Test signup, email verification, password reset, login, logout, and protected routes.
5. Test mobile navigation at 360px and 768px.
6. Test dark mode and theme customization.
7. Export and import a backup once.
8. Confirm Firestore rules are deployed.
9. Confirm `.env` is not committed.

### Portfolio Presentation

1. Add a short project summary to your portfolio homepage.
2. Include the live demo link.
3. Include a GitHub link if the repository can be public.
4. Add 4-6 screenshots or a short screen recording.
5. Explain the problem, your solution, tech stack, and key engineering decisions.
6. Mention that the app is Firebase-backed and stores data per authenticated user.

### Future Product Improvements

1. Route-level code splitting for large Insights/Reporting bundles.
2. More focused mobile task-list interactions.
3. Offline-safe write queue.
4. Calendar integration.
5. More advanced recurring task review tools.
6. Optional AI planning assistant.
7. Native mobile exploration.

## Build Verification

Last verified commands:

```bash
npm run build
npm list firebase
```

Expected result:

- TypeScript build passes.
- Vite production build completes.
- Firebase is installed.

