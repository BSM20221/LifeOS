# LifeOS v2

LifeOS v2 is a Firebase-backed personal task workspace with authentication, protected app pages, quick capture, user-specific Firestore task storage, project management, tags, saved task views, daily planning, and focus sessions.

## Stack

- Vite
- React
- TypeScript
- Firebase Auth
- Cloud Firestore
- Lucide React icons

## Required Firebase Environment

Copy `.env.example` to `.env` and fill in the Firebase web app values:

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

## Firestore Data Model

Tasks are stored under the signed-in user's document:

```text
users/{uid}/tasks/{taskId}
```

Projects are stored under the signed-in user's document:

```text
users/{uid}/projects/{projectId}
```

Saved filters are stored under the signed-in user's document:

```text
users/{uid}/filters/{filterId}
```

Daily plans are stored under the signed-in user's document by date:

```text
users/{uid}/dailyPlans/{YYYY-MM-DD}
```

Focus sessions are stored under the signed-in user's document:

```text
users/{uid}/focusSessions/{sessionId}
```

Each task stores:

```text
title, description, status, priority, dueDate, tags, estimatedMinutes,
energyLevel, createdAt, updatedAt, completedAt, notes, userId, projectId
```

Each project stores:

```text
id, userId, name, description, color, status, area, createdAt,
updatedAt, archivedAt, completedAt
```

Each saved filter stores:

```text
id, userId, name, description, query, color, createdAt, updatedAt
```

Each daily plan stores:

```text
id, userId, date, topTaskIds, deepWorkTaskId, timeBlocks,
reflection, createdAt, updatedAt
```

Each focus session stores:

```text
id, userId, taskId, projectId, dailyPlanDate, mode, plannedMinutes,
actualMinutes, status, startedAt, pausedAt, completedAt, cancelledAt,
notes, createdAt, updatedAt
```

Firestore rules in `firestore.rules` allow authenticated users to access only:

```text
users/{uid}
users/{uid}/tasks/{taskId}
users/{uid}/projects/{projectId}
users/{uid}/filters/{filterId}
users/{uid}/dailyPlans/{dateId}
users/{uid}/focusSessions/{sessionId}
users/{uid}/settings/main
```

## Run Locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Quick Capture

Quick capture is available from Dashboard and Inbox. It supports:

- `#tag` for tags
- `!low`, `!medium`, `!high`, `!urgent` for priority
- `+ProjectName` for exact project assignment

Example:

```text
Study modal verbs #german !high +German B2
```

## Tags And Saved Views

Tags are derived from existing tasks. They are normalized to lowercase, deduplicated, and available in task filters and the Saved Views page.

Saved Views use a simple structured query object with optional fields:

```text
searchText, status, priority, projectId, tag, dueDateGroup, energyLevel
```

Due date groups are:

```text
no-due-date, overdue, today, tomorrow, this-week, later
```

## Today Planning

The Today page stores one daily plan per user and date. It supports:

- Top 3 priority task selection
- One Deep Work task
- Time blocks with optional task assignment
- Daily reflection with energy and mood
- Today summary metrics for task count, overdue count, estimates, and completion

## Focus Timer

The Focus page supports Pomodoro, short break, long break, and custom timers. Sessions can be linked to tasks and projects, paused, resumed, cancelled, completed, and recovered after refresh from Firestore. Browser notifications are optional and requested only after clicking the notification button.
