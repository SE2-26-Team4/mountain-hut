# Mountain Hut

Mountain Hut is a web application developed by **Team 4** for the **Software Engineering II** course at **Politecnico di Torino** (academic year 2026–2027). Hikers can check meal-service availability, make and manage reservations, and communicate dietary requirements. Hut staff can manage dining capacity, create bookings on behalf of hikers, and duplicate weekly schedules. This README describes the **end-of-Sprint-2** project scope (MH-04 through MH-09).

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

The default Compose session secret and demo credentials are intended for development only. Set a secure `SESSION_SECRET` and disable `SEED_DEMO_ACCOUNTS` for non-demo deployments. For initial-password and booking emails, configure Resend as described below.

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

**Windows PowerShell (from `server/`):**

```powershell
$env:SEED_DEMO_ACCOUNTS = "true"; npm run dev
```

For local email testing, set `RESEND_API_KEY` and `EMAIL_FROM` in the server process environment before running the backend; merely placing them in a `.env` file does **not** load them into the local Node.js process automatically. The Compose setup is described in [Environment configuration](#environment-configuration).

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

These credentials can be overridden using `TEST_HIKER_EMAIL`, `TEST_HIKER_PASSWORD`, `TEST_EMPLOYEE_EMAIL`, and `TEST_EMPLOYEE_PASSWORD`. Public self-registration is not provided; **staff can register new hiker accounts** as part of staff booking. The database initially has no dining tables or meal slots; staff must configure them before bookings can be made.

## Main features — Sprint 2

Sprint 2 covers user stories **MH-04 to MH-09**. This section summarizes the completed Sprint 2 deliverables, including end-of-sprint fixes and verification.

### Hiker experience

- **Public availability search (MH-04):** Visitors can choose a date and meal slot and inspect available seats without signing in. Authentication is required when completing a booking.
- **Dietary requirements and allergy flags (MH-05):** Bookings can include separate dietary-requirement descriptions and allergy indicators for guests, subject to the number of people in the party.
- **Edit existing booking (MH-06):** Hikers can open a prefilled edit form in **My bookings** and update the date, meal slot, party size, dietary requirements, and special requests. Edits are subject to available capacity and the **48-hour deadline before the original meal starts**. Valid changes update the existing booking and its displayed details.
- **Cancel existing booking (MH-08):** Hikers can cancel their own reservations through a confirmation dialog. Cancellation releases reserved capacity and updates **My bookings**.

### Staff experience

- **Staff booking (MH-07):** Authorized staff can search for an existing hiker, register a new hiker, or create a temporary hiker and then enter a booking on their behalf. The workflow checks meal-slot availability, table capacity, and whether a meal service has already started.
- **New hiker first login (MH-07):** A staff-created full hiker account receives a randomly generated initial password by email when delivery is configured. The hiker must change that password at first login before accessing protected hiker features. **Temporary hikers cannot sign in**.
- **Dining capacity management:** Authorized staff can manage dining tables, meal slots, and table assignments. New schedule setup can reuse a previously saved time-slot/table configuration.
- **Weekly schedule duplication (MH-09):** Authorized staff can select source and destination weeks in the **Copy Week** interface. The API copies meal slots and their times, statuses, and table assignments while assigning new slot IDs. Copying replaces the destination week's schedule; confirmed bookings and other scheduling constraints can prevent the operation. The original source schedule is preserved.

### Booking and email behavior

- Reservations and schedule configuration persist in **SQLite**. Table allocation and capacity restrictions are enforced by the backend, not just the browser.
- Booking creation and updates attempt to send confirmation emails. A successfully stored reservation remains valid even if email delivery fails; the user interface reports that the email was not sent.
- Initial passwords for newly registered hikers are emailed when the email provider is configured. Without successful delivery, a newly created account may not have a usable credential available to the hiker; verify email configuration before testing this flow end to end.

**Outside the Sprint 2 scope:** The public **Menu** page currently shows a “Coming soon” message. Some separate staff slot-editing controls may depend on later user stories (for example, MH-19); do not treat the weekly copy operation as a substitute for those controls.

### API overview

The backend API base URL is **http://localhost:3000/api** in local development and **http://localhost:8080/api** through Docker. Paths in the table include the `/api` prefix.

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | Public | Health check |
| POST | `/api/sessions` | Public | Hiker sign-in |
| POST | `/api/staff/sessions` | Public | Staff sign-in |
| GET | `/api/sessions/current` | Authenticated | Current session |
| PUT | `/api/sessions/current/password` | Authenticated | Change password, including first-login password change |
| DELETE | `/api/sessions/current` | Authenticated | Sign out |
| GET | `/api/meal-slots` | Public | Active meal slots |
| GET | `/api/bookings/availability` | Public | Seat availability by date and slot |
| POST | `/api/bookings` | Authenticated hiker | Create a reservation |
| GET | `/api/bookings` | Authenticated hiker | List own reservations |
| PUT | `/api/bookings/:id` | Booking owner | Edit an existing reservation |
| DELETE | `/api/bookings/:id` | Booking owner | Cancel a reservation |
| GET | `/api/staff/hikers` | Staff | Search for hikers |
| POST | `/api/staff/hikers` | Staff | Register a new or temporary hiker |
| POST | `/api/staff/bookings` | Staff | Create a booking on behalf of a hiker |
| GET | `/api/capacity` | Staff | Read table and meal-slot configuration |
| POST | `/api/capacity/meal-slots/copy-week` | Staff | Duplicate a weekly schedule |
| POST / PUT / GET | `/api/capacity/...` | Staff, except documented public endpoints | Manage dining tables, meal slots, and assignments |

Browser requests use a session cookie; authenticated API calls must include credentials.

## Environment configuration

The **backend does not automatically load `.env` files** when started directly with Node.js. Set the environment variables in the shell or process environment for local development. For **Docker Compose**, create a repository-root `.env` from the supplied root `.env.example`; Compose reads this file for variable substitution. Never commit real secrets.

| Variable | Meaning |
| --- | --- |
| `PORT` | Backend port; defaults to `3000` (Docker uses `8080`) |
| `DB_PATH` | SQLite database file path |
| `SESSION_SECRET` | Session signing secret; use a secure value outside local demos |
| `SEED_DEMO_ACCOUNTS` | Set to `true` to create demo accounts |
| `TEST_HIKER_EMAIL`, `TEST_HIKER_PASSWORD` | Override demo hiker credentials |
| `TEST_EMPLOYEE_EMAIL`, `TEST_EMPLOYEE_PASSWORD` | Override demo employee credentials |
| `EMAIL_TEST_HIKER_EMAIL`, `EMAIL_TEST_HIKER_PASSWORD` | Optional email-test account credentials |
| `CLIENT_ORIGIN` | Frontend origin for CORS and account links; defaults to `http://localhost:5173` locally and `http://localhost:8080` in Compose |
| `COOKIE_SECURE` | Set to `true` when cookies must be sent only over HTTPS |
| `RESEND_API_KEY` | API key used to deliver initial-password and booking-confirmation emails |
| `EMAIL_FROM` | Sender address accepted by Resend |

**Email with Docker Compose:** `docker-compose.yml` forwards `RESEND_API_KEY` from the environment/root `.env` and currently sets `EMAIL_FROM` to `Mountain Hut <mountain-hut@azeca.it>` inside the container. A valid API key and permission to send from that address/domain are required for delivery. Changing `EMAIL_FROM` only in the root `.env` will **not** override the hard-coded Compose value; use an appropriate local Compose override if a different verified sender is required.

**Email with local Node.js:** Set both `RESEND_API_KEY` and `EMAIL_FROM` in the backend process environment. Email delivery is optional for booking persistence but is important for staff-created hiker first-login credentials. Do not publish credentials, API keys, or email-provider secrets.

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

## Sprint 2 verification and code quality

Sprint 2 included manual end-to-end checks for public availability, allergy information, booking edits and cancellations, staff bookings, and weekly schedule duplication. The final code reviews, cleanup, bug-fix activities, and regression checks covered frontend, backend, and automated-test code across MH-04–MH-09.

Run the available automated checks in [Tests and code checks](#tests-and-code-checks) after integration. **Coverage results should be read from the actual `test:coverage` output**; a Sprint coverage target is not itself proof of a measured percentage. In particular, the Windows symlink-permission issue described above can prevent an otherwise healthy test run from reporting full success.

## Project specifications

[Official Mountain Hut project specifications](https://github.com/SE2-Polito/AY26-27-Mountain-Hut)

## Contributors

Team 4 — [GitHub contributors](https://github.com/SE2-26-Team4/mountain-hut/graphs/contributors)

## License

GNU General Public License v3.0 (GPL-3.0). See [LICENSE](LICENSE).
