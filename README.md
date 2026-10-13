# Workout Tracker

A modern, local-first full-stack web application designed for personal fitness tracking, workout routine planning, live set logging, body weight monitoring, measurable goals, and performance analytics.

Runs completely on your local Windows PC with 100% data ownership and privacy. No external cloud databases, third-party tracking, or paid subscriptions required.

---

## Key Features

1. **Dashboard**
   - Featured today's workout derived from your weekly schedule.
   - One-click CTA to start or resume active sessions.
   - Real-time weekly workout frequency counter and set completion statistics.
   - Active goals with live progress bars.
   - Latest body weight and 30-day trend.
   - Recent personal records (PRs) and past 14-day training activity bar chart.

2. **Active Workout (High-Speed Session Logging)**
   - Start from a routine template or initiate an ad-hoc session.
   - Atomic database snapshots of target reps, duration, and load (isolated from future template changes).
   - Instant set result saving with feedback badges.
   - Dynamic tracking type inputs (repetitions and external load for reps-based exercises; seconds and load for duration-based exercises).
   - Support for total load vs. per-hand load.
   - Mark completed, skip sets, add extra sets on the fly, or add new exercises mid-workout.
   - Browser refresh resilience (active workout session resumes immediately).
   - Lightweight built-in rest timer with audio chime (Web Audio API) and quick preset intervals.

3. **Workout Plans & Weekly Schedule**
   - Reusable routine templates (e.g., Push/Pull/Legs, Upper/Lower).
   - Interactive exercise builder with set targets, repetition ranges (min/max), hold durations, and rest times.
   - Weekly schedule planner assigning routines to days of the week (Sunday through Saturday).
   - Configurable weekly workout frequency target (1–7 sessions per week).

4. **Exercise Library**
   - Pre-seeded with standard bodyweight and weighted movements.
   - Categorize by muscle group (Chest, Back, Legs, Shoulders, Arms, Core, Cardio).
   - Configure tracking type (`reps` or `duration`), load mode (`none`, `optional`, `required`), and load basis (`total`, `per_hand`).
   - Archive/unarchive support.
   - Historical dependency protection (exercises with logged history cannot be accidentally deleted; archiving is enforced).

5. **Workout History**
   - Chronological session timeline with duration, status badges, and completed sets count.
   - Date range, status, and exercise filters.
   - Detailed set-by-set breakdown comparing planned targets against actual performance.
   - Session notes editing and test record deletion.

6. **Body Weight Tracking**
   - Fast weigh-in logger (kg, date/time, notes).
   - Rolling 7-day average calculation (smooths daily water retention fluctuations once $\ge 3$ entries are recorded within the 7-day window).
   - Net change from first weigh-in and 30-day change.
   - Interactive Recharts visualization with daily weights and rolling average line.

7. **Measurable Goals**
   - Supports 5 goal types:
     - Maximum Repetitions for an exercise
     - Maximum Hold Duration for an exercise
     - Maximum External Load for an exercise
     - Target Body Weight (handles both weight loss and weight gain directions accurately)
     - Weekly Workout Frequency
   - Dynamic real-time calculation directly from underlying completed session and weight records (zero manually drifted numbers).

8. **Progress & Analytics**
   - Filters for 7 Days, 30 Days, 90 Days, and All Time.
   - KPI metrics: total workouts, completed sets, elapsed training time, and average workout duration.
   - Weekly consistency bar chart (completed sessions vs. weekly target).
   - Training volume trend chart (completed sets vs. planned sets).
   - Exercise performance progression tool (inspect strength/duration improvements over time for any movement).

9. **Backups, Export, and Single-Owner Security**
   - First-run owner account initialization with bcrypt password hashing.
   - Session cookies (`httpOnly`, `sameSite: lax`) protecting private endpoints.
   - Atomic database backups using SQLite `VACUUM INTO`.
   - Versioned JSON export and validated import/restore with automated safety snapshots.
   - Database health verification via SQLite `PRAGMA integrity_check`.

---

## Technology Stack

- **Frontend**: React 18, TypeScript (strict), Vite, React Router 6, Tailwind CSS, Recharts, Lucide Icons.
- **Backend**: Node.js 24, Express, TypeScript, Zod, bcryptjs, cookie-parser, express-rate-limit.
- **Database**: Native SQLite (`node:sqlite`) with versioned migrations, foreign keys enabled, WAL mode, and transactional integrity.
- **Testing**: Vitest, Supertest, React Testing Library, jsdom.

---

## Project Structure

```
Workout Tracker/
├── client/                     # Frontend SPA (React + Vite + Tailwind)
│   ├── src/
│   │   ├── __tests__/          # Frontend component tests
│   │   ├── components/         # Reusable UI (Navbar, Sidebar, Modal, RestTimer, StatCard, etc.)
│   │   ├── context/            # AuthContext, ThemeContext
│   │   ├── lib/                # API client with credentials support
│   │   ├── pages/              # Dashboard, ActiveWorkout, Exercises, Plans, History, Weight, Goals, Analytics, Settings
│   │   ├── App.tsx             # Application router & auth guard
│   │   └── main.tsx            # React root entry
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── server/                     # Backend API & Database (Express + TypeScript)
│   ├── src/
│   │   ├── __tests__/          # Domain and Supertest API integration tests
│   │   ├── db/                 # Database connection, WAL mode, versioned migrations
│   │   ├── middleware/         # Auth guard, rate limiter, centralized error handler
│   │   ├── routes/             # REST endpoints (/api/auth, /api/sessions, /api/exercises, etc.)
│   │   ├── services/           # Core domain logic, queries, and analytics calculations
│   │   ├── app.ts              # Express setup & static asset serving
│   │   └── index.ts            # Server entrypoint
│   ├── package.json
│   └── tsconfig.json
├── shared/                     # Shared types and Zod validation schemas
│   └── src/
│       ├── types.ts            # TypeScript interfaces
│       ├── schemas.ts          # Zod validation schemas
│       └── index.ts
├── data/                       # Local database file and backups (ignored by git)
│   ├── workout_tracker.db      # SQLite database file
│   └── backups/                # SQLite snapshots and backups
├── package.json                # Root package with monorepo orchestration scripts
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js (v20 or v24 recommended)
- npm (v10+ recommended)
- A modern web browser

### 1. Install Dependencies

From the project root:

```powershell
npm install
```

This installs all dependencies across both the `client` and `server` workspaces.

---

### 2. Running in Development Mode

Run the backend and frontend concurrently:

```powershell
npm run dev
```

- Backend API starts on: `http://127.0.0.1:3000`
- Frontend Vite dev server starts on: `http://localhost:5173`
- Vite automatically proxies `/api` requests to Express on port 3000.

You can also run them individually:
- Backend only: `npm run dev:server`
- Frontend only: `npm run dev:client`

---

### 3. Running in Production Mode (Single Local Port)

Build the frontend static assets and server bundle:

```powershell
npm run build
```

Then start the production server:

```powershell
npm run start
```

Express will serve both the REST API and the built React application from:

👉 **`http://127.0.0.1:3000`**

---

### 4. Running the Automated Test Suite

To run both backend domain/API tests and frontend component tests:

```powershell
npm test
```

To run individual test suites:
- Backend tests only: `npm run test:server`
- Frontend tests only: `npm run test:client`

---

## First-Run Owner Setup

1. Open the application in your browser (`http://127.0.0.1:3000` or `http://localhost:5173`).
2. On first launch, the app automatically detects that no owner account exists and displays the **First-Run Setup** screen.
3. Choose your username (e.g. `ayman`) and a password (minimum 6 characters).
4. Click **Complete First-Run Setup**.
5. Your password is encrypted with bcrypt, an authenticated session is created, and you are directed straight to your personalized dashboard!

---

## Enabling Trusted Local-Network Access (LAN)

To access Workout Tracker from your mobile phone or tablet on the same Wi-Fi network:

### Step 1: Bind Server to All Interfaces
Create or edit a `.env` file in the project root:

```env
HOST=0.0.0.0
PORT=3000
```

### Step 2: Allow Through Windows Firewall
1. Open **Windows Defender Firewall with Advanced Security** (or run `wf.msc`).
2. Add an **Inbound Rule** for **Port 3000** (TCP) for **Private Networks**.

### Step 3: Find Your PC's Local IP Address
In PowerShell, run:

```powershell
ipconfig
```

Locate your IPv4 Address under your active Wi-Fi or Ethernet adapter (e.g. `192.168.1.50`).

### Step 4: Access From Your Phone or Tablet
On your mobile device connected to the same Wi-Fi network, navigate to:

```
http://192.168.1.50:3000
```

Sign in with your owner credentials. All workouts, weights, and goals remain synced on your PC.

---

## Database Location and Backups

- **Database File**: `data/workout_tracker.db`
  Foreign keys and Write-Ahead Logging (WAL) are enabled for maximum durability.
- **Backup Directory**: `data/backups/`
- **Manual Backups**: Navigate to **Settings & Backup** inside the app:
  - **Create SQLite Backup**: Uses SQLite's transactional `VACUUM INTO` command to generate a consistent timestamped copy (`backup_YYYY-MM-DD...db`).
  - **Export JSON**: Downloads your entire dataset in clean JSON format.
  - **Restore From JSON**: Imports a backup file inside an atomic transaction, automatically taking a safety snapshot before applying.
  - **Verify SQLite Integrity**: Executes `PRAGMA integrity_check` directly on the database engine.
