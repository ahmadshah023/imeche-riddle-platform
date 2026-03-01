## IMechE Riddle Run – Competition Platform

This is a production-ready, gamified riddle competition platform built on Next.js (App Router) with Firebase Auth + Firestore, Tailwind, and Framer Motion.

### Tech Stack

- **Frontend**: Next.js (App Router), React, Tailwind, Framer Motion, Lucide Icons  
- **Backend**: Firebase Auth + Firestore (client SDK, real-time via `onSnapshot`)  
- **Auth**: Email/password + Google OAuth, with **admin emails hardcoded** in `AuthProvider`  
- **Core Collections**: `users`, `competitions`, `competitionTeams`, `competitionMemberships`, `teamProgress`, `competitionLogs`, `notifications`, `queries`

### Features

- **Authentication & Roles**
  - Email/password auth plus Google sign-in
  - Admin role determined by a hardcoded list of emails in `src/components/AuthProvider.tsx`
  - Admins land on `/admin`, players on `/dashboard`

- **Competition Flow**
  - `/dashboard` lists all **active competitions** (from `competitions`)
  - Users join a competition by entering its **competition password**
  - Membership is stored in `competitionMemberships/{competitionId}_{userId}`

- **Teams & Real-Time Game Board**
  - Within `/competition/[competitionId]`:
    - Players see all teams (`competitionTeams`) as collectible-style cards
    - Teams are password-protected; creator becomes **captain**
    - Joining/leaving teams updates `competitionTeams.members` in **real time**
  - Each team gets a **randomized riddle order** (per-team `riddleOrder` in `teamProgress`)
  - Center panel (via `TeamDashboard`) shows:
    - Current riddle + part, with fuzzy answer checking
    - Shared team progress (parts and riddles) updated live for all members
    - Team-wide wrong-answer penalty:
      - 3 wrong answers in a row → 3-minute lock with countdown
  - Side panel shows captain and live-updating member list

- **Competition Timing**
  - `competitions` docs hold: `status` (`waiting|running|paused|ended`), `startTime`, `durationMinutes`, `extraMinutesTotal`
  - Clients compute a **real-time countdown** based on these fields
  - When `status` is not `running`, answer submission is disabled

- **Standings & Logs**
  - `teamProgress` and `competitionLogs` power:
    - **Admin standings tab**: team-only rankings for a selected competition,
      ordered by:
      1. Highest riddle index
      2. Highest part index
      3. Earliest `lastUpdatedAt` (tie-breaker)
    - **Admin logs tab**: entries like  
      `Team Falcon completed Riddle #210 – Part 2 at 14:32:11`
  - Team dashboard shows **“Your rank: X / N”** in real time using the same scoring logic.

- **Queries & Notifications**
  - Players can send queries from the team dashboard; stored in `queries`
  - Admin can reply from `/admin`:
    - Reply sets query `status = "answered"`
    - Creates a notification targeted to that team (`visibleTo: ["team:{teamId}"]`)
  - Admin broadcasts are **competition-scoped**:
    - Sent to `notifications` with `competitionId` and `visibleTo: ["all"]`
  - `NotificationsPanel`:
    - On competition screen, shows only notifications for the **current competition**
    - Filters by `visibleTo` = `"all"` / `team:{teamId}` / `user:{uid}`

### Firebase Setup

1. **Create a Firebase project** and enable:
   - Firebase Auth: Email/Password + Google provider
   - Firestore Database (in production mode; adjust rules appropriately)

2. **Create a `.env.local` file** in the `webapp` folder with:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

3. **Collections used in Firestore (high level)**
   - `users` – user profile, role, optional default team linkage
   - `competitions` – competition config: password, status, duration, timer fields
   - `competitionTeams` – teams **per competition** with members and captain
   - `competitionMemberships` – mapping of `{competitionId, userId, teamId}`
   - `teamProgress` – per-team riddle progression, randomized riddle order, penalties
   - `competitionLogs` – immutable riddle completion events for tie-breaking
   - `notifications` – competition-scoped broadcast and team/user-specific messages
   - `queries` – player questions and admin responses

> Note: Firestore security rules should restrict write access to admin-only operations (broadcasts, replies, competition status changes, logs) based on the authenticated user’s email.

### Local Development

From the `webapp` directory:

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

### Deployment (Vercel)

- Push the `webapp` folder to GitHub (or similar).
- Create a new project on Vercel, pointing to this repository.
- Set the Firebase env vars in Vercel’s **Project Settings → Environment Variables**.
- Build command: `npm run build`  
- Output directory: `.next`

### Admin Configuration

- Update the `ADMIN_EMAILS` constant in `src/components/AuthProvider.tsx` to add more admin emails.
- Any authenticated account whose email is in this list will be redirected to `/admin` after login.

### Assets & Sound Effects

- The code expects sound files like `/sounds/success.mp3` and `/sounds/notify.mp3`.  
- Add your own short sound effects under `public/sounds/` with those names for answer success, level unlock, and notification feedback.

### Suggested Firestore Rules (simplified)

These are **starting-point rules**, not production-perfect, but they respect:
- Only authenticated users can read/write game data
- Only admins (by email) can perform sensitive writes

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() {
      return request.auth != null;
    }

    function isAdmin() {
      return isSignedIn() &&
        request.auth.token.email in [
          "ahamdshah023@gmail.com"
          // add more admin emails here
        ];
    }

    // Users can see and update their own profile
    match /users/{userId} {
      allow read: if isSignedIn();
      allow write: if isSignedIn() && request.auth.uid == userId;
    }

    // Competitions: readable by all signed-in users, writable only by admins
    match /competitions/{compId} {
      allow read: if isSignedIn();
      allow write: if isAdmin();
    }

    // Teams and memberships: readable by signed-in users, writes restricted to participants/admins
    match /competitionTeams/{teamId} {
      allow read: if isSignedIn();
      allow write: if isSignedIn();
    }

    match /competitionMemberships/{membershipId} {
      allow read, write: if isSignedIn();
    }

    // Progress, logs, notifications, queries
    match /teamProgress/{docId} {
      allow read: if isSignedIn();
      allow write: if isSignedIn();
    }

    match /competitionLogs/{logId} {
      allow read: if isSignedIn();
      allow write: if isAdmin();
    }

    match /notifications/{notifId} {
      allow read: if isSignedIn();
      allow write: if isAdmin();
    }

    match /queries/{queryId} {
      allow read: if isAdmin();
      allow write: if isSignedIn();
    }
  }
}
```

You can tighten these rules further by:
- Checking that players only write `teamProgress` for their own team/competition
- Validating `competitionMemberships` against `competitionTeams`
