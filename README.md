# LifeOS v2

LifeOS v2 Phase 1 is a Firebase-backed personal task workspace with authentication, protected app pages, quick capture, and user-specific Firestore task storage.

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

Each task stores:

```text
title, description, status, priority, dueDate, tags, estimatedMinutes,
energyLevel, createdAt, updatedAt, completedAt, notes, userId
```

Firestore rules in `firestore.rules` allow authenticated users to access only:

```text
users/{uid}
users/{uid}/tasks/{taskId}
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

Example:

```text
Draft weekly review #work !high
```
