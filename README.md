# Nosh Dish Dashboard

A dish-management dashboard featuring local draft editing, backend validation, atomic optimistic concurrency control, and real-time live synchronization.

Built for the **Nosh Full Stack Take-Home Assignment**.

---

## Table of Contents
1. [Tech Stack](#tech-stack)
2. [Prerequisites](#prerequisites)
3. [Quick Start & Setup](#quick-start--setup)
4. [Environment Configuration](#environment-configuration)
5. [Architecture & Layering](#architecture--layering)
6. [API Reference & curl Examples](#api-reference--curl-examples)
7. [Verification & Acceptance Checks](#verification--acceptance-checks)
8. [Key Design Decision: Optimistic Concurrency Control](#key-design-decision-optimistic-concurrency-control)
9. [Bonus Feature: Live External Update Sync](#bonus-feature-live-external-update-sync)
10. [Automated Testing](#automated-testing)
11. [Known Limitations](#known-limitations)
12. [Approximate Time Spent & Disclosures](#approximate-time-spent--disclosures)

---

## Tech Stack

- **Backend**: Node.js (18+ / 24+), Express, SQLite via `better-sqlite3` (file-based persistent DB with WAL mode, real transactional SQL).
- **Frontend**: React 19 + Vite, Vanilla CSS (modular design tokens, accessible, zero UI frameworks), Fetch API.
- **Repository Structure**:
  ```text
  .
  ├── backend/
  │   ├── data/            # dishes.json seed file & persistent nosh.db (ignored in git)
  │   ├── scripts/         # seed.js, seedTest.js, concurrencyTest.js
  │   ├── src/
  │   │   ├── db/          # connection.js, dishRepository.js
  │   │   ├── services/    # dishService.js (validation & business logic)
  │   │   ├── controllers/ # dishController.js
  │   │   ├── routes/      # dishRoutes.js
  │   │   ├── middleware/  # errorHandler.js (central 400/404/409/500 handler)
  │   │   ├── app.js       # Express app configuration & CORS
  │   │   └── server.js    # HTTP server bootstrap & graceful shutdown
  │   ├── test/            # automated test suite (node:test + supertest)
  │   ├── .env.example
  │   └── package.json
  ├── frontend/
  │   ├── src/
  │   │   ├── components/  # DishGrid, DishCard, StatusBadge, ToggleSwitch, ErrorBanner
  │   │   ├── hooks/       # useDishDraft.js (draft, dirty state, save/discard/conflict)
  │   │   ├── services/    # api.js client
  │   │   ├── App.jsx      # Top-level view & background poll coordinator
  │   │   ├── index.css    # Clean, responsive CSS design system
  │   │   └── main.jsx
  │   ├── index.html
  │   ├── .env.example
  │   └── package.json
  ├── scripts/             # dev.js (lightweight process orchestrator), resetDb.js
  ├── .env.example         # Root environment example
  ├── .gitignore           # Ignores node_modules, *.db, *.db-wal, .env
  ├── package.json         # Root scripts (install:all, seed, dev, start, test)
  └── README.md
  ```

---

## Prerequisites

- **Node.js**: `18.0.0` or higher (tested on Node `v24.16.0`)
- **npm**: `9.0.0` or higher
- Operating System: macOS, Linux, or Windows (cross-platform path resolution and commands)

---

## Quick Start & Setup

### 1. Install all dependencies
Installs backend, frontend, and root dependencies with a single command:
```bash
npm run install:all
```

### 2. Seed the database
Loads `dishes.json` into the persistent SQLite database (`backend/data/nosh.db`):
```bash
npm run seed
```
*Note: Rerunning this command uses `INSERT OR IGNORE` keyed on `dishId` and will never duplicate records or overwrite saved edits.*

### 3. Start the application (Backend + Frontend)
```bash
npm run dev
```
- **Frontend Dashboard**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:3001/dishes](http://localhost:3001/dishes)
- **Health Check**: [http://localhost:3001/health](http://localhost:3001/health)

### 4. Other root commands
- `npm run seed:test`: Inserts a test dish with an invalid image URL for validation testing.
- `npm run seed:reset`: Clears dishes and reseeds original records at version 1.
- `npm test`: Runs the automated test suite (`node --test`).
- `npm run test:concurrency`: Runs the automated 10-client concurrency test.
- `npm start`: Runs the backend standalone server.

---

## Environment Configuration

Copy the example `.env` files if customization is needed:

### Root `.env` (or `.env.example`)
```env
PORT=3001
DB_PATH=./backend/data/nosh.db
CORS_ORIGIN=http://localhost:5173
VITE_API_BASE_URL=http://localhost:3001
```

### Backend `backend/.env.example`
```env
PORT=3001
DB_PATH=./data/nosh.db
CORS_ORIGIN=http://localhost:5173
```

### Frontend `frontend/.env.example`
```env
VITE_API_BASE_URL=http://localhost:3001
```

---

## Architecture & Layering

The backend follows a strict layered separation of responsibilities:
```text
HTTP Request
     │
     ▼
[routes/dishRoutes.js]        (URL routing & HTTP verb mapping)
     │
     ▼
[controllers/dishController.js] (Request parameter extraction & response formatting)
     │
     ▼
[services/dishService.js]       (Business validation: URL checks, trimmed names, error dispatch)
     │
     ▼
[db/dishRepository.js]         (Data access & SQL transactions: better-sqlite3)
     │
     ▼
[SQLite DB: nosh.db]           (Persistent table with WAL mode)
```

1. **Routes**: Pure mapping of `/dishes` and `/dishes/:dishId` to controller methods.
2. **Controllers**: Handle HTTP semantics, extract bodies/params, and pass errors to `next(err)`.
3. **Services**: Enforce domain validation rules:
   - Type verification (`dishName` string, `isPublished` boolean, `expectedVersion` integer >= 1).
   - Publishing rules: trimmed name must not be empty, stored `imageUrl` must parse as a valid `http:` or `https:` URL via the native `URL` constructor.
4. **Repository**: Executes SQL statements. The update query runs atomically inside a `better-sqlite3` transaction:
   ```sql
   UPDATE dishes
   SET dishName = ?, isPublished = ?, version = version + 1
   WHERE dishId = ? AND version = ?
   ```
   If `changes === 1`, returns the updated row with incremented version.
   If `changes === 0`, queries the row: if not found returns 404; if found returns 409 Conflict with `currentDish`.
5. **Central Error Handler**:
   - `400`: Invalid inputs or malformed JSON (`{ error: "Bad Request", message, details }`).
   - `404`: Non-existent dish (`{ error: "Not Found", message }`).
   - `409`: Stale version conflict (`{ error: "Conflict", message, currentDish }`).
   - `500`: Generic error response to client; detailed error logged on server.

---

## API Reference & curl Examples

### 1. GET /dishes
Returns all dishes with published status as boolean and version integer.

**Command:**
```bash
curl -X GET http://localhost:3001/dishes
```

**Response (200 OK):**
```json
[
  {
    "dishId": "1",
    "dishName": "Jeera Rice",
    "imageUrl": "https://nosh-assignment.s3.ap-south-1.amazonaws.com/jeera-rice.jpg",
    "isPublished": true,
    "version": 1
  },
  {
    "dishId": "2",
    "dishName": "Paneer Tikka",
    "imageUrl": "https://nosh-assignment.s3.ap-south-1.amazonaws.com/paneer-tikka.jpg",
    "isPublished": true,
    "version": 1
  }
]
```

---

### 2. PATCH /dishes/:dishId (Successful Update)
Saves trimmed name and explicit published status, incrementing version to `version + 1`.

**Command:**
```bash
curl -X PATCH http://localhost:3001/dishes/1 \
  -H "Content-Type: application/json" \
  -d '{"dishName": "  Royal Jeera Rice  ", "isPublished": true, "expectedVersion": 1}'
```

**Response (200 OK):**
```json
{
  "dishId": "1",
  "dishName": "Royal Jeera Rice",
  "imageUrl": "https://nosh-assignment.s3.ap-south-1.amazonaws.com/jeera-rice.jpg",
  "isPublished": true,
  "version": 2
}
```

---

### 3. PATCH /dishes/:dishId (400 Bad Request - Validation Error)
Triggered when input types are invalid, expectedVersion < 1, or publishing with an empty name or invalid image URL.

**Command (Attempting to publish with whitespace name):**
```bash
curl -X PATCH http://localhost:3001/dishes/1 \
  -H "Content-Type: application/json" \
  -d '{"dishName": "   ", "isPublished": true, "expectedVersion": 2}'
```

**Response (400 Bad Request):**
```json
{
  "error": "Bad Request",
  "message": "Validation failed for publishing dish",
  "details": [
    "dishName cannot be empty when dish is published"
  ]
}
```

**Command (Malformed JSON payload):**
```bash
curl -X PATCH http://localhost:3001/dishes/1 \
  -H "Content-Type: application/json" \
  -d '{"dishName": "broken'
```

**Response (400 Bad Request):**
```json
{
  "error": "Bad Request",
  "message": "Malformed JSON payload in request body"
}
```

---

### 4. PATCH /dishes/:dishId (404 Not Found)
Triggered when targeting an unknown dish identifier.

**Command:**
```bash
curl -X PATCH http://localhost:3001/dishes/unknown-999 \
  -H "Content-Type: application/json" \
  -d '{"dishName": "Ghost Dish", "isPublished": false, "expectedVersion": 1}'
```

**Response (404 Not Found):**
```json
{
  "error": "Not Found",
  "message": "Dish with ID \"unknown-999\" not found"
}
```

---

### 5. PATCH /dishes/:dishId (409 Conflict)
Triggered when `expectedVersion` does not match the stored version (optimistic concurrency conflict).

**Command (Sending stale version 1 when dish is at version 2):**
```bash
curl -X PATCH http://localhost:3001/dishes/1 \
  -H "Content-Type: application/json" \
  -d '{"dishName": "Stale Attempt", "isPublished": true, "expectedVersion": 1}'
```

**Response (409 Conflict):**
```json
{
  "error": "Conflict",
  "message": "Conflict: Dish has been modified by another update",
  "currentDish": {
    "dishId": "1",
    "dishName": "Royal Jeera Rice",
    "imageUrl": "https://nosh-assignment.s3.ap-south-1.amazonaws.com/jeera-rice.jpg",
    "isPublished": true,
    "version": 2
  }
}
```

---

## Verification & Acceptance Checks

The application satisfies all 7 required acceptance checks. Reviewers can execute the exact steps below:

### Check 1: Seed twice, no duplicates, no overwritten edits
- **Step 1**: Run the seed script:
  ```bash
  npm run seed
  ```
  *Output: `Seeding complete: 5 inserted, 0 skipped.` (or 0 inserted, 5 skipped if already seeded).*
- **Step 2**: Edit a dish via the UI or curl (e.g. rename dish 1 to "Persisted Rice" at version 2).
- **Step 3**: Rerun the seed script:
  ```bash
  npm run seed
  ```
  *Output: `Seeding complete: 0 inserted, 5 skipped.`*
- **Verification**: Query `GET http://localhost:3001/dishes/1`. Notice that the dish name is still "Persisted Rice" and the version remains 2. No duplicates and no overwrites occurred.

---

### Check 2: Edit without saving shows no DB change; Discard resets
- **Step 1**: In the dashboard, locate any dish card (e.g., "Paneer Tikka").
- **Step 2**: Type "Paneer Tikka Spicy" in the name input or toggle the publish switch.
- **Observation**:
  - The card displays an **"Unsaved changes"** badge.
  - The card border highlights with an accent glow.
  - **Save** and **Discard** buttons appear.
- **Step 3**: Verify database state:
  ```bash
  curl http://localhost:3001/dishes/2
  ```
  Notice the database still has the original name ("Paneer Tikka"). No network call was made.
- **Step 4**: Click the **Discard** button on the card.
- **Observation**: The input resets to "Paneer Tikka", the "Unsaved changes" badge disappears, and the Save/Discard buttons disappear.

---

### Check 3: Save persists across refresh and backend restart
- **Step 1**: In the dashboard, edit dish 1 to "Smoked Jeera Rice" and click **Save**.
- **Observation**: The card displays a saving spinner, saves, updates the version badge from `v1` to `v2`, and clears the dirty indicator.
- **Step 2**: Refresh the browser page (`F5`).
- **Observation**: The card renders "Smoked Jeera Rice" with `v2`.
- **Step 3**: In the terminal, stop the backend process (`Ctrl+C`) and restart it (`npm run dev` or `npm start`). Refresh the browser.
- **Observation**: Data remains intact. Persistent SQLite stored the row in `backend/data/nosh.db`.

---

### Check 4: Publish with empty name rejected & publish with invalid image URL rejected
- **Test 4A (Empty name rejection)**:
  1. In the dashboard on any card, clear the name input and ensure published toggle is ON.
  2. Click **Save**.
  3. **Observation**: Card displays an inline error:
     `Validation Error: dishName cannot be empty when dish is published`. The draft remains in the input for correction.
  4. Via curl:
     ```bash
     curl -i -X PATCH http://localhost:3001/dishes/1 \
       -H "Content-Type: application/json" \
       -d '{"dishName": "   ", "isPublished": true, "expectedVersion": 2}'
     ```
     Returns `HTTP 400 Bad Request`.

- **Test 4B (Invalid image URL rejection)**:
  1. Insert a test dish with an invalid image URL by running:
     ```bash
     npm run seed:test
     ```
     *(This inserts dish `test-bad-url` with `imageUrl: "invalid-image-protocol://broken/image.jpg"` and `isPublished: false`).*
  2. In the dashboard, locate the card "Dish With Malformed Image URL".
  3. Notice the broken-image fallback placeholder rendered smoothly.
  4. Toggle the switch to **Published** and click **Save**.
  5. **Observation**: Card displays an inline error:
     `imageUrl must be a valid HTTP or HTTPS URL to publish`.
  6. Via curl:
     ```bash
     curl -i -X PATCH http://localhost:3001/dishes/test-bad-url \
       -H "Content-Type: application/json" \
       -d '{"dishName": "Test Name", "isPublished": true, "expectedVersion": 1}'
     ```
     Returns `HTTP 400 Bad Request`.

---

### Check 5: Two-tab conflict test (A saves, B gets 409, B's draft preserved)
- **Step 1**: Open [http://localhost:5173](http://localhost:5173) in **Tab A** and **Tab B**.
- **Step 2**: On dish 4 ("Chicken Biryani" at `v1`), edit the name in Tab A to "Dum Biryani".
- **Step 3**: On the same dish in Tab B, edit the name to "Hyderabadi Biryani".
- **Step 4**: In **Tab A**, click **Save**. Tab A succeeds and updates to `v2`.
- **Step 5**: In **Tab B**, click **Save**.
- **Observation in Tab B**:
  - The request returns `HTTP 409 Conflict`.
  - Tab B's draft ("Hyderabadi Biryani") is **fully preserved** in the input field!
  - A prominent conflict banner appears:
    `"Another update changed this dish (now v2). Reload to get the latest, which will discard your draft."`
  - A button **"Reload latest (discards my draft)"** is offered.
  - Clicking "Reload latest" updates the card to "Dum Biryani" (`v2`) and clears the draft.
  - The system never silently overwrites or auto-retries.

---

### Check 6: Failed-save test (stop backend, draft stays editable, retry works)
- **Step 1**: In the dashboard, edit dish 5 ("Alfredo Pasta") to "Creamy Alfredo Pasta".
- **Step 2**: Stop the backend process in your terminal (`Ctrl+C`).
- **Step 3**: Click **Save** in the dashboard.
- **Observation**:
  - The save fails due to network unreachability.
  - The card displays an inline error: `Network connection failed: Server unreachable`.
  - The user's draft ("Creamy Alfredo Pasta") remains **intact and editable**.
- **Step 4**: Restart the backend (`npm run dev` or `npm start`).
- **Step 5**: Click **Save** again.
- **Observation**: The request succeeds, saves "Creamy Alfredo Pasta", advances the version, and clears error states.

---

### Check 7: Concurrency test (parallel PATCH requests with same expectedVersion)
Run the automated concurrency verification script:
```bash
npm run test:concurrency
```
*You can also pass a specific dishId: `npm run test:concurrency 1`.*

**What it does:**
1. Fetches the current dish version (e.g. `version: 1`).
2. Fires **10 parallel PATCH requests** simultaneously with the exact same `expectedVersion: 1`.
3. Verifies that **exactly 1 request** succeeds with `200 OK`, and the remaining **9 requests** receive `409 Conflict`.
4. Verifies the database final version is incremented exactly once (`version: 2`).

**Execution output:**
```text
========================================
Running Concurrency Test on dishId: 1
Target: http://localhost:3001/dishes/1
Firing 10 parallel PATCH requests with the SAME expectedVersion...
========================================

[Initial State] Dish name: "Jeera Rice", Version: 1

[Results Summary]
  - 200 OK (Success):   1 (Expected: 1)
  - 409 Conflict:       9 (Expected: 9)
  - Other status:       0 (Expected: 0)
[Final State] Version in DB: 2 (Expected: 2)
[Winning Dish Name]: "Concurrent Update #1"

✅ CONCURRENCY TEST PASSED! Optimistic locking successfully prevented race conditions.
```

---

## Key Design Decision: Optimistic Concurrency Control

### Why Optimistic Locking?
In multi-user collaborative dashboards, two common concurrency control strategies exist:
1. **Pessimistic Locking**: Locking a row or resource exclusively when a user opens an edit form.
2. **Optimistic Locking**: Allowing users to edit concurrently and validating that the resource was not modified before committing the write.

### Trade-off Evaluation:
- **Pessimistic Locking Drawbacks**:
  - Requires maintaining server-side lock state (e.g., in Redis or DB tables).
  - Vulnerable to abandoned locks if a user closes the tab, loses network, or walks away from their laptop.
  - High friction for read-heavy dashboards.
- **Optimistic Locking Advantages**:
  - **Stateless & Scalable**: No lock leases, timeouts, or socket state to maintain.
  - **Atomic SQL Guarantees**: A single SQL query `UPDATE dishes SET ... version = version + 1 WHERE dishId = ? AND version = ?` leverages SQLite's ACID guarantees. SQLite's write transaction locks the row during the execution of that single statement, ensuring race conditions are impossible under high concurrency.
  - **Superior User Experience**: Drafts are preserved on conflict, giving the user explicit control to review the newer version before deciding to discard or re-apply changes.

---

## Bonus Feature: Live External Update Sync

The dashboard implements automated live external synchronization as specified in Section 4 of the requirements:
1. **Polling Frequency**: GET `/dishes` is polled every **5 seconds** in the background.
2. **Page Visibility Management**:
   - Uses `document.addEventListener('visibilitychange', ...)`
   - When the user switches tabs or minimizes the window (`document.visibilityState === 'hidden'`), polling is paused and the header indicator displays `"Sync paused"`.
   - When the tab becomes visible again, polling triggers immediately and resumes the 5-second interval timer.
3. **Timer Cleanup**: `clearInterval` and event listener removal are strictly executed in the `useEffect` cleanup return to prevent memory leaks on unmount.
4. **Temporary Disconnection Handling**:
   - If a background poll fails (e.g. intermittent network fluctuation), the dashboard displays a non-intrusive `"Reconnecting..."` pulsing indicator.
   - The user's screen is not disrupted with full-page errors; polling gracefully retries on the next tick.
5. **Non-destructive Merging**:
   - If an external update modifies a dish while a user has **no unsaved edits** on that card, the card automatically reflects the latest server values.
   - If the user has an **active draft** (dirty card), the draft is **never touched or overwritten in the background**.
   - Instead, the card displays an alert: `"External Update Available: Another update saved this dish as v{n} on the server"` with a `"Reload latest (discards my draft)"` button.

---

## Automated Testing

The backend includes an automated test suite covering all critical paths:
- HTTP 200 GET all dishes (boolean types, integer versions)
- HTTP 400 validation: non-string names, non-boolean published flags, expectedVersion < 1, empty published name, invalid published image URL, and malformed JSON
- HTTP 404 for non-existent dish IDs
- Atomic updates: trimmed names, version increments, DB persistence
- HTTP 409 conflict detection with `currentDish` payload
- High concurrency: 10 parallel conflicting requests yielding exactly 1 success and 9 conflicts

Run the automated tests:
```bash
npm test
```

---

## Known Limitations

- **Single Process SQLite**: SQLite is embedded and file-based. While WAL mode enables concurrent readers and atomic writes, horizontal multi-server scaling across multiple machines would require a client-server database (e.g., PostgreSQL).
- **In-Memory Image Validation**: Image URL validation uses the WHATWG `URL` constructor to verify structure and HTTP/HTTPS protocol. Network reachability checks (e.g. HEAD requests) are intentionally omitted per the project specification.
- **Polling vs WebSockets**: Polling every 5 seconds was selected to meet the exact bonus specification without external broker dependencies. For applications with tens of thousands of simultaneous users, WebSockets or Server-Sent Events (SSE) would reduce HTTP request overhead.

---

## Approximate Time Spent & Disclosures

- **Approximate Time Spent**: ~3.5 hours (Planning, Backend architecture, Validation, Optimistic locking, React hooks & components, Design system, Bonus polling, Concurrency tests, Documentation).
- **AI & Tools Disclosure**: Developed using the Antigravity assistant for architecture ideation, boilerplate setup, and test verification. All code was reviewed, validated, and tested end-to-end against the assignment requirements.
