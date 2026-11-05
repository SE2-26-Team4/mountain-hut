# Mountain Hut

Mountain Hut is a web application developed by **Team 4** for the **Software Engineering II** course at **Politecnico di Torino** (academic year 2026–2027). Hikers can check meal-service availability and reserve seats; hut staff can configure dining tables, meal slots, and seating capacity.

## Technology stack

- **Frontend:** React 19, Vite 8, React Router, Bootstrap, React Bootstrap, Bootstrap Icons.
- **Backend:** Node.js 24 LTS, Express 5, Passport local authentication, `express-session`.
- **Database:** SQLite (`sqlite3`).
- **Email:** Resend (optional booking confirmation delivery).
- **Tests and checks:** Vitest, Supertest, ESLint, TypeScript type checking of JavaScript.
- **Deployment:** Docker and Docker Compose.

## Repository structure

```text
mountain-hut/
├── client/                # React/Vite frontend
├── server/                # Express API, database, services, and tests
├── retrospective/         # Team retrospective materials
├── Dockerfile             # Production image
├── docker-compose.yml     # Application and persistent SQLite volume
├── LICENSE
└── README.md
```

## Installation and startup

### Option A: Docker

**Prerequisite:** Docker with Docker Compose. From the repository root:

```bash
docker compose up --build
```

Open **http://localhost:8080**. The container serves both the frontend and the API. Docker Compose enables demo accounts by default.

To stop the container without deleting saved bookings:

```bash
docker compose down
```

The database is stored in the named volume `mountain_hut_sqlite_data`. **Warning:** `docker compose down -v` removes this volume and deletes its data.

The default Compose session secret and demo credentials are intended for development only. Set a secure `SESSION_SECRET` and disable `SEED_DEMO_ACCOUNTS` for non-demo deployments.

### Option B: Local development

**Prerequisite:** Node.js 24 LTS and npm. Open two terminals at the repository root.

**Terminal 1 — backend:**

```bash
cd server
npm ci
npm run dev
```

The backend listens at **http://localhost:3000** by default. It initializes SQLite on startup. Demo accounts are **not** created automatically in local development unless `SEED_DEMO_ACCOUNTS=true` is set before starting the backend.

To enable demo accounts, use one of these commands **instead of** the `npm run dev` command above:

```bash
# macOS / Linux / Git Bash (from server/)
SEED_DEMO_ACCOUNTS=true npm run dev
```

To test booking confirmation emails, copy `.env.example` to `.env`, replace
`RESEND_API_KEY` with a Resend API key, then run the same command. The example
uses Resend's test sender: keep `onboarding@resend.dev` as `EMAIL_FROM` and use
the dedicated email-test hiker account configured by
`EMAIL_TEST_HIKER_EMAIL` and `EMAIL_TEST_HIKER_PASSWORD`. The example uses
`delivered@resend.dev` and `EmailTest123!`; log in with those credentials before
creating a booking. The regular demo account remains
`hiker@example.com` with password `HikerTest123!`.
The `.env` file is local-only and must never be committed. Without these
variables, bookings still work but confirmation email delivery is skipped and
the confirmation popup reports the delivery failure.

Once the container is running, open the application in your browser at:

**http://localhost:8080**
```powershell
# Windows PowerShell (from server/)
$env:SEED_DEMO_ACCOUNTS = "true"; npm run dev
```

**Terminal 2 — frontend:**

```bash
cd client
npm ci
npm run dev
```

Open **http://localhost:5173**. The Vite development server proxies `/api` to **http://localhost:3000**, as configured in `client/vite.config.js`. The backend must also be running for login, availability, and booking.

### Demo accounts

When `SEED_DEMO_ACCOUNTS=true`, the backend creates missing demo accounts:

| Role | Email | Password | Sign-in |
| --- | --- | --- | --- |
| Hiker | `hiker@example.com` | `HikerTest123!` | Home page → Sign in |
| Employee | `employee@example.com` | `EmployeeTest123!` | `/staff/login` |

These credentials can be overridden using `TEST_HIKER_EMAIL`, `TEST_HIKER_PASSWORD`, `TEST_EMPLOYEE_EMAIL`, and `TEST_EMPLOYEE_PASSWORD`. Registration is not provided. The database initially has no dining tables or meal slots; staff must configure them before bookings can be made.

## Main features

- **Hiker:** Sign in, check availability for a date and meal service, and create a booking with automatic table allocation.
- **Staff:** Sign in separately, create and edit dining tables and meal slots, and assign tables to meal slots.
- **Bookings:** SQLite persistence, availability and allocation rules, booking retrieval and cancellation API endpoints.
- **Confirmation email:** A confirmation message is prepared and sent after a booking is successfully persisted. If delivery fails, the saved booking remains valid and the API still returns success.
- **Work in progress:** The *My bookings* page and *Menu* page are placeholders; some booking-list features are available through the API rather than a completed page.

### API overview

The backend API base URL is **http://localhost:3000/api** in local development and **http://localhost:8080/api** through Docker.

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | Public | Health check |
| POST | `/api/sessions` | Public | Hiker sign-in |
| POST | `/api/staff/sessions` | Public | Staff sign-in |
| GET | `/api/sessions/current` | Authenticated | Current session |
| DELETE | `/api/sessions/current` | Authenticated | Sign out |
| GET | `/api/meal-slots` | Public | Active meal slots |
| GET | `/api/bookings/availability` | Public | Seat availability by date and slot |
| POST | `/api/bookings` | Hiker | Create a reservation |
| GET | `/api/bookings` | Hiker | List own reservations |
| DELETE | `/api/bookings/:id` | Booking owner | Cancel a reservation |
| GET | `/api/capacity` | Staff | Tables and meal-slot configuration |
| POST / PUT | `/api/capacity/...` | Staff | Manage tables, meal slots, and assignments |

Browser requests use a session cookie; authenticated API calls must include credentials.

## Environment configuration

Set backend environment variables **before** starting the server. The backend does not load `.env` files automatically. `server/.env.example` documents the email variables; it is not an active configuration file.

| Variable | Meaning |
| --- | --- |
| `PORT` | Backend port; defaults to `3000` (Docker uses `8080`) |
| `DB_PATH` | SQLite database file path |
| `SESSION_SECRET` | Session signing secret; required in production |
| `SEED_DEMO_ACCOUNTS` | Set to `true` to create demo accounts |
| `CLIENT_ORIGIN` | CORS frontend origin; defaults to `http://localhost:5173` |
| `COOKIE_SECURE` | Set to `true` when cookies should be sent only over HTTPS |
| `RESEND_API_KEY` | Resend API key for confirmation emails |
| `EMAIL_FROM` | Email sender using a domain verified in Resend |

To send real booking confirmation emails, configure both `RESEND_API_KEY` and `EMAIL_FROM` with valid values. **Never commit API keys or production secrets.** The supplied `docker-compose.yml` does not forward these email settings by default; explicitly add them to a local Compose configuration if needed. Without email configuration, a successfully persisted booking is still retained even though delivery fails.

## Tests and code checks

Run these commands from the **repository root** after installing dependencies with `npm --prefix server ci` and `npm --prefix client ci` (or from the respective package directory without `--prefix`):

```bash
# Backend
npm --prefix server test
npm --prefix server test -- booking-confirmation.test.js
npm --prefix server run test:watch
npm --prefix server run test:coverage
npm --prefix server run typecheck

# Frontend
npm --prefix client run lint
npm --prefix client run typecheck
npm --prefix client run build
npm --prefix client run preview
```

Backend unit and integration tests are in `server/tests/unit/` and `server/tests/integration/`. Supertest exercises the Express app without starting an HTTP server. Tests use a separate SQLite test database and mock the email service so no real Resend requests are made. There is no frontend `npm test` script in the current `client/package.json`.

**Windows note:** `server/tests/integration/database-schema-file.test.js` creates a symbolic link. On some Windows systems it can fail with `EPERM` unless Developer Mode or suitable permissions are enabled; this is an OS permission issue, not a booking test failure.

## Project specifications

[Official Mountain Hut project specifications](https://github.com/SE2-Polito/AY26-27-Mountain-Hut)

## Contributors

Team 4 — [GitHub contributors](https://github.com/SE2-26-Team4/mountain-hut/graphs/contributors)

## License

GNU General Public License v3.0 (GPL-3.0). See [LICENSE](LICENSE).
