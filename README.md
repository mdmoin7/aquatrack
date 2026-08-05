# AquaTrack

Enterprise Water Consumption & Billing Management System for apartment communities.

## Quick Start (Demo Mode)

```bash
npm install
npm run dev
```

Open http://localhost:5173 — no Firebase required. Use **Sign in as Admin** on the login page. The app loads **July 2026 real consumption data** (66 flats) automatically; select that month in the picker to view readings.

## Firebase Production Setup

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a project and enable **Authentication** → **Email/Password** and **Google**
3. For Google sign-in: add your app's domain to **Authorized domains** (localhost is included by default)
4. Create a **Firestore Database** (production mode)
4. Register a Web app and copy config values

### 2. Configure Environment

```bash
cp .env.example .env
```

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_SOCIETY_ID=default
VITE_SUPERADMIN_EMAILS=your-email@example.com
```

### 3. Deploy Security Rules

Install Firebase CLI and deploy rules:

```bash
npm install -g firebase-tools
firebase login
firebase use your-project-id
firebase deploy --only firestore:rules
```

Rules are in `firestore.rules` — they enforce:
- **Admins** — full read/write on society data
- **Residents** — read own flat readings & alerts only
- **Society isolation** — users can only access their `societyId`

### 4. Create First Admin User

**Option A — Google sign-in (recommended)**

1. Set `VITE_SUPERADMIN_EMAILS` in `.env` to your Google account email
2. Sign in with **Continue with Google** on the login page
3. Your superadmin profile is created automatically
4. Click **Load July 2026 Data** on the dashboard

**Option B — Register in app**

1. Ensure `.env` has your Firebase config (copy from `.env.example`)
2. Open the app → **Create one** on the login page
3. Complete **profile setup** at `/setup-profile`
4. Click **Load July 2026 Data** on the dashboard

**Option C — Firebase Console**

1. Firebase Console → Authentication → Add user (email + password)
2. Sign in to AquaTrack
3. Complete profile setup when prompted

Deploy updated security rules before first use:

```bash
firebase deploy --only firestore:rules
```

### 5. Add Resident Users

1. Create the account in Firebase Console → Authentication, or have them **register** at `/register`
2. As admin, go to **Users** in the sidebar
3. Click **Add User Profile**, paste their Firebase UID, set role to `resident`, and assign a flat

## Firestore Data Model

```
users/{uid}                          → User profile (role, societyId, flatId)
societies/{societyId}/
  ├── flats/{flatId}
  ├── readings/{readingId}
  ├── billingConfigs/{month}
  ├── alerts/{alertId}
  ├── tankerDeliveries/{deliveryId}
  └── tankerVendors/{vendorId}
```

## Local Emulators (Optional)

```bash
# .env
VITE_USE_FIREBASE_EMULATOR=true

firebase emulators:start
```

Emulator ports: Auth `9099`, Firestore `8080`, UI `4000`

## Architecture

| Layer | Demo Mode | Cloud Mode |
|-------|-----------|------------|
| Auth | Session-based demo roles | Firebase Auth + Firestore profiles |
| Data | localStorage | Firestore (persistent offline cache) |
| Billing | Same engine | Same engine |

All services use `dataStore` which automatically routes to the correct backend.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `firebase deploy --only firestore:rules` | Deploy security rules |
