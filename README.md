# Mountain Hut

Web application for managing table reservations at a mountain hut. Hikers check the availability of a meal service and book a table; hut staff (employees and wardens) configure meal services, dining tables and seating capacity.

Mountain Hut is developed by **Team 4** for the **Software Engineering II** course at **Politecnico di Torino** (academic year 2026–2027). The official requirements are available in the [project specifications](https://github.com/SE2-Polito/AY26-27-Mountain-Hut).

> **Project status:** end of Sprint 1. This README describes the features available on the `main` branch.

## Table of contents

- [1. Technologies and requirements](#1-technologies-and-requirements)
- [2. Installation and startup](#2-installation-and-startup)
  - [2.1 Local development](#21-local-development)
  - [2.2 Docker](#22-docker)
- [3. Features](#3-features)
- [4. Usage](#4-usage)
- [5. Booking and capacity rules](#5-booking-and-capacity-rules)
  - [5.1 Booking and table allocation](#51-booking-and-table-allocation)
  - [5.2 Capacity configuration](#52-capacity-configuration)
- [6. Server-side](#6-server-side)
  - [6.1 API](#61-api)
  - [6.2 Database tables](#62-database-tables)
  - [6.3 Configuration](#63-configuration)
  - [6.4 Main files](#64-main-files)
- [7. Client-side](#7-client-side)
  - [7.1 Routes](#71-routes)
  - [7.2 React components](#72-react-components)
  - [7.3 Hooks, context and API](#73-hooks-context-and-api)
- [8. Tests and checks](#8-tests-and-checks)
- [9. Contributors](#9-contributors)
- [10. License](#10-license)

## 1. Technologies and requirements

| Component | Technologies |
| --- | --- |
| Frontend | React 19, Vite, React Router, Bootstrap, React Bootstrap, Bootstrap Icons |
| Backend | Node.js 24.x, npm, Express 5, Passport (local strategy), express-session |
| Database | SQLite through sqlite3 |
| Email | Resend |
| Checks | Vitest, Supertest, ESLint, TypeScript (type checking of JSDoc-annotated JavaScript) |
| Deployment | Docker, Docker Compose |

```bash
node --version
npm --version
```

Docker and Docker Compose are required only to run the application in a container (section [2.2](#22-docker)).

## 2. Installation and startup

### 2.1 Local development

1. **Clone the repository and install the dependencies:**

   ```bash
   git clone https://github.com/SE2-26-Team4/mountain-hut.git
   cd mountain-hut
   npm --prefix server ci
   npm --prefix client ci
   ```

   `npm ci` creates the `node_modules` folders by installing the dependency versions specified in the `package-lock.json` files.

2. **Start the backend in a terminal from the project root, enabling the demo accounts:**

   Bash (Linux, macOS, Git Bash):

   ```bash
   SEED_DEMO_ACCOUNTS=true npm --prefix server run dev
   ```

   PowerShell:

   ```powershell
   $env:SEED_DEMO_ACCOUNTS = "true"; npm --prefix server run dev
   ```

   The backend runs at `http://localhost:3000`. On the first start it creates the database `server/mountain-hut.sqlite`. `SEED_DEMO_ACCOUNTS=true` creates the demo accounts listed in section [4](#4-usage) if they do not exist; without it, no account is created. To start the backend without automatic restarts, use `npm --prefix server start`.

3. **Start the frontend in a second terminal from the project root:**

   ```bash
   npm --prefix client run dev
   ```

   The frontend is available at `http://localhost:5173`. Vite forwards requests under `/api` to the backend at `http://localhost:3000`.

> **Note:** the database starts without meal services and dining tables. Before a hiker can book, a staff member must configure them (see section [4](#4-usage)).

### 2.2 Docker

From the project root:

```bash
docker compose up --build
```

The application is available at `http://localhost:8080`. A single container builds the frontend and serves it through the backend (`NODE_ENV=production`). Demo accounts are enabled by default.

```bash
docker compose down     # Stops and removes the container, keeping the database
docker compose down -v  # Also removes the volume and permanently deletes the stored data
```

The SQLite database is stored in the named volume `mountain_hut_sqlite_data`, mounted on `/app/data`, so its data is preserved when the container is removed or recreated. Docker Compose reads `SESSION_SECRET` and `SEED_DEMO_ACCOUNTS` from the shell or from a `.env` file in the project root.

## 3. Features

Features completed in Sprint 1:

| Story | Area | Feature | Description |
| --- | --- | --- | --- |
| — | Authentication | Hiker sign-in | Sign-in dialog opened from the home page, reserved for hiker accounts |
| — | Authentication | Staff sign-in | Separate page at `/staff/login`, reserved for employees and wardens |
| — | Authentication | Session | Cookie session lasting 8 hours, restored on page reload; sign-out from the profile menu |
| — | Authentication | Role separation | Hikers cannot access the staff area; signed-in staff are redirected to the staff area |
| MH-02 | Staff | Dining tables | Creation and editing of tables with name, number of seats and active status |
| MH-02 | Staff | Meal services | Creation and editing of time slots with name, start time, end time and active status |
| MH-02 | Staff | Slot capacity | Assignment of tables to a time slot, with the total seat capacity of the assigned active tables |
| MH-04 | Visitor | Check availability | Free seats per table and in total for a date and meal service, available without signing in |
| MH-01 | Hiker | Book a table | Booking for a date, meal service and party size, with automatic seat allocation and confirmation |
| MH-03 | Hiker | Confirmation email | Email content (reference, date, meal service, party size and table allocation) and sending service through Resend |
| — | Hiker | Booking list and cancellation | Available through the API (`GET /api/bookings`, `DELETE /api/bookings/:id`); the *My bookings* page is not available yet |
| — | Persistence | Database | Storage of accounts, meal services, tables, assignments and bookings in SQLite |

## 4. Usage

The demo accounts below are created when `SEED_DEMO_ACCOUNTS=true` (default with Docker). Registration is not available. Passwords are stored as salted scrypt hashes.

| Role | Email | Password | Sign-in |
| --- | --- | --- | --- |
| Hiker | `hiker@example.com` | `HikerTest123!` | Home page -> **Sign in** |
| Employee | `employee@example.com` | `EmployeeTest123!` | `/staff/login` |

Emails and passwords can be changed with the variables in section [6.3](#63-configuration).

**Staff**

1. Open `/staff/login` and sign in with the employee account.
2. In **Tables**, press **Add table** and enter the name, the number of seats and the active status.
3. In **Time slots**, press **Add time slot** and enter the name, start time, end time and active status.
4. Press **Assign tables** on a time slot, select its tables and save. The dialog shows the total capacity of the selection.
5. Use the edit actions to change tables and time slots, then press **Log out** to end the session.

**Hiker**

1. Open `/` and select **Date**, **Meal service** and **Guests** (from 1 to 12).
2. Press **Check availability**. The page shows the free seats of each table and the total.
3. If you are not signed in, press **Sign in to continue** and sign in with the hiker account. The selection is kept.
4. Press **Confirm reservation**. The confirmation shows the reservation number, date, meal service, time and guests.

## 5. Booking and capacity rules

### 5.1 Booking and table allocation

A booking is accepted only if all the following conditions are met:

1. The date is valid (`YYYY-MM-DD`) and is today or a future day, in the `Europe/Rome` time zone.
2. The meal service exists and is active.
3. The meal service starts at least two hours after the booking request (`Europe/Rome` time).
4. The party size is a positive integer.
5. The hiker does not already have a confirmed booking for the same date and meal service.
6. The active tables assigned to the meal service have enough free seats.

Seats are allocated according to the following rules:

- **Single table:** if one table can seat the whole party, the table with the fewest sufficient free seats is chosen; ties are resolved with the lowest table ID.
- **Multiple tables:** otherwise, the party is split across the tables with the most free seats, in descending order, until all guests are seated.
- **Table sharing:** different parties can share the same table as long as it has free seats.
- **Free seats:** seats of a table assigned to the meal service minus the seats reserved by confirmed bookings for the same date and meal service. Cancelled bookings and inactive tables do not count.
- **Transactions:** the availability check, the booking and its allocations are saved in the same `BEGIN IMMEDIATE` transaction. Transactions are queued on a single connection, so simultaneous requests cannot overbook a table.
- **Availability:** `GET /api/bookings/availability` is informative only and does not reserve seats.
- **Cancellation:** sets the booking status to `cancelled`, freeing its seats. Only the hiker who made the booking can cancel it.

### 5.2 Capacity configuration

Staff configuration follows these rules:

- **Names:** meal services and dining tables must have a non-empty name, unique without regard to letter case.
- **Times:** start and end times use the `HH:mm` format; the end time must be later than the start time.
- **Seats:** the number of seats of a table must be a positive integer.
- **Active status:** optional on creation (default: active), required on update. Inactive meal services are hidden from hikers; inactive tables provide no bookable seats.
- **Table assignment:** replaces all the tables of a meal service. Table IDs must be distinct positive integers; an empty list removes all assignments. Unknown table IDs are rejected and returned in `missingTableIds`.
- **Total capacity:** sum of the seats of the active tables assigned to the meal service.

## 6. Server-side

### 6.1 API

Base URL: `http://localhost:3000/api` (Docker: `http://localhost:8080/api`).

| Method | Path | Access | Main response |
| --- | --- | --- | --- |
| GET | `/api/health` | Public | `200`, `{"status":"OK","timestamp":"..."}` |
| POST | `/api/sessions` | Public, hiker accounts | `201`, authenticated user |
| POST | `/api/staff/sessions` | Public, employee and warden accounts | `201`, authenticated user |
| GET | `/api/sessions/current` | Authenticated | `200`, current user; `401` without a session |
| DELETE | `/api/sessions/current` | Session, if present | `204`, logout |
| GET | `/api/meal-slots` | Public | `200`, active meal services |
| GET | `/api/bookings/availability?bookingDate=YYYY-MM-DD&slotId=:slotId` | Public | `200`, free seats per table and in total |
| GET | `/api/bookings` | Hiker | `200`, bookings of the signed-in hiker |
| POST | `/api/bookings` | Hiker | `201`, created booking with table allocations |
| DELETE | `/api/bookings/:id` | Hiker who made the booking | `200`, cancelled booking |
| GET | `/api/capacity` | Staff | `200`, all meal services and dining tables, including inactive ones |
| GET | `/api/capacity/meal-slots/:slotId` | Staff | `200`, capacity of a meal service |
| POST | `/api/capacity/meal-slots` | Staff | `201`, created meal service |
| PUT | `/api/capacity/meal-slots/:slotId` | Staff | `200`, updated meal service |
| PUT | `/api/capacity/meal-slots/:slotId/tables` | Staff | `200`, capacity after the assignment |
| POST | `/api/capacity/dining-tables` | Staff | `201`, created dining table |
| PUT | `/api/capacity/dining-tables/:tableId` | Staff | `200`, updated dining table |

"Staff" means a signed-in employee or warden. Authentication uses the session cookie `mountain-hut.sid`, so requests from the browser must include credentials.

**Errors:** use the format `{"error":{"code":"CODE","message":"message"}}`:

- `400`: invalid input (`INVALID_CREDENTIALS`, `INVALID_BOOKING`, `INVALID_PARTY_SIZE`, `INVALID_INPUT`).
- `401`: incorrect credentials (`INVALID_CREDENTIALS`) or missing session (`UNAUTHENTICATED`).
- `403`: wrong sign-in area (`WRONG_LOGIN_AREA`) or role not allowed (`FORBIDDEN`).
- `404`: nonexistent resource (`SLOT_NOT_FOUND`, `MEAL_SLOT_NOT_FOUND`, `BOOKING_NOT_FOUND`, `NOT_FOUND`).
- `409`: inactive meal service (`SLOT_INACTIVE`), not enough seats (`NO_AVAILABILITY`), booking already present (`DUPLICATE_BOOKING`), less than two hours before the meal service (`BOOKING_TOO_LATE`), name already used (`DUPLICATE_NAME`).
- `503`: database temporarily busy (`DATABASE_BUSY`).
- `500`: server error (`INTERNAL_SERVER_ERROR`).

**Request and response examples:**

| Endpoint | Request body | Successful response body |
| --- | --- | --- |
| `POST /api/sessions` | `{"email":"hiker@example.com","password":"HikerTest123!"}` | `{"user":{"id":2,"full_name":"Test Hiker","email":"hiker@example.com","role":"hiker"}}` |
| `GET /api/meal-slots` | None | `{"mealSlots":[{"id":1,"name":"Dinner","startTime":"19:00","endTime":"21:00","isActive":true}]}` |
| `GET /api/bookings/availability?bookingDate=2026-11-20&slotId=1` | None | `{"availability":{"bookingDate":"2026-11-20","slotId":1,"slotName":"Dinner","startTime":"19:00","endTime":"21:00","tables":[{"id":1,"name":"T1","seatCount":4,"isActive":true,"reservedSeats":2,"availableSeats":2}],"totalAvailableSeats":2}}` |
| `POST /api/bookings` | `{"bookingDate":"2026-11-20","slotId":1,"partySize":2}` | `{"booking":{"id":1,"hikerId":2,"bookingDate":"2026-11-20","slotId":1,"partySize":2,"status":"confirmed","allocations":[{"tableId":1,"seatsReserved":2}]}}` |
| `DELETE /api/bookings/1` | None | `{"booking":{...,"status":"cancelled"}}` |
| `POST /api/capacity/meal-slots` | `{"name":"Dinner","startTime":"19:00","endTime":"21:00"}` | `{"mealSlot":{"id":1,"name":"Dinner","startTime":"19:00","endTime":"21:00","isActive":true}}` |
| `POST /api/capacity/dining-tables` | `{"name":"T1","seatCount":4}` | `{"diningTable":{"id":1,"name":"T1","seatCount":4,"isActive":true}}` |
| `PUT /api/capacity/meal-slots/1/tables` | `{"tableIds":[1]}` | `{"capacity":{"slotId":1,"slotName":"Dinner","tables":[{"id":1,"name":"T1","seatCount":4,"isActive":true}],"totalSeatCapacity":4}}` |

### 6.2 Database tables

| Table | Fields | Description |
| --- | --- | --- |
| `users` | `id`, `full_name`, `email`, `password_hash`, `role`, `created_at` | Accounts with role `hiker`, `employee` or `warden`; email unique without regard to letter case |
| `meal_slots` | `id`, `name`, `start_time`, `end_time`, `is_active` | Meal services and their times |
| `dining_tables` | `id`, `name`, `seat_count`, `is_active` | Dining tables and their seats |
| `slot_tables` | `slot_id`, `table_id` | Tables assigned to each meal service |
| `bookings` | `id`, `hiker_id`, `booking_date`, `slot_id`, `party_size`, `status`, `created_at` | Bookings with status `confirmed` or `cancelled` |
| `booking_table_allocations` | `booking_id`, `table_id`, `seats_reserved` | Seats reserved by each booking on each table |

The database is managed according to the following rules:

- **Initialization:** at startup, if none of the tables exists, the backend creates the schema from `server/mountain-hut-schema.sql`. If only some tables exist, startup stops with an error. Existing data is preserved.
- **Initial data:** only the demo accounts, when `SEED_DEMO_ACCOUNTS=true`. Meal services and tables are created by staff.
- **Integrity:** foreign keys are enabled; `CHECK` constraints validate roles, statuses, positive seat counts and party sizes.
- **Timestamps:** `created_at` is stored in UTC, ISO 8601 format. Booking dates use `YYYY-MM-DD` and meal times use `HH:mm`.

### 6.3 Configuration

| Backend variable | Default value | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Backend port (`8080` in Docker) |
| `DB_PATH` | `server/mountain-hut.sqlite` | Database path. If `NODE_ENV=test` and `DB_PATH` is not set, `server/mountain-hut-test.sqlite` is used |
| `NODE_ENV` | Not set by startup scripts | `production` serves the built frontend from `client/dist` and requires `SESSION_SECRET`; set to `test` by Vitest |
| `SESSION_SECRET` | `mountain-hut-local-development-secret` | Secret used to sign the session cookie. Required in production |
| `COOKIE_SECURE` | `false` | `true` sends the session cookie only over HTTPS |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Frontend origin allowed by CORS with credentials |
| `SEED_DEMO_ACCOUNTS` | Not set | `true` creates the missing demo accounts at startup |
| `TEST_HIKER_EMAIL`, `TEST_HIKER_PASSWORD` | `hiker@example.com`, `HikerTest123!` | Demo hiker credentials |
| `TEST_EMPLOYEE_EMAIL`, `TEST_EMPLOYEE_PASSWORD` | `employee@example.com`, `EmployeeTest123!` | Demo employee credentials |
| `RESEND_API_KEY` | Not set | Resend API key for booking confirmation emails |
| `EMAIL_FROM` | Not set | Sender of confirmation emails, for example `Mountain Hut <bookings@your-verified-domain.com>`. The domain must be verified in Resend |

| Frontend variable | Default value | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `/api` | Base URL of the backend API used by the client |

Communication between frontend and backend and configuration variables are managed as follows:

- **Frontend–backend communication:** in development, the client calls `/api` and the Vite proxy forwards requests to `http://localhost:3000`. In production, the backend serves the frontend and the API from the same origin.
- **Variables:** the backend reads variables from the environment and does not load `.env` files automatically. Set them in the terminal before startup. `server/.env.example` lists the email variables.
- **Addresses:** if the backend port changes, update the proxy in `client/vite.config.js`. If the frontend origin changes, set `CLIENT_ORIGIN`.

### 6.4 Main files

| File | Responsibility |
| --- | --- |
| `server/index.js` | Backend startup: database initialization, demo accounts and HTTP server |
| `server/app.js` | Express app: CORS, sessions, Passport, routes and static frontend in production |
| `server/db.js` | SQLite connection, query helpers, transaction queue and schema initialization |
| `server/mountain-hut-schema.sql` | Tables, indexes and constraints |
| `server/config/passport.js` | Local strategy with email and password, session serialization |
| `server/middleware/require-auth.js` | Access restricted to authenticated users |
| `server/middleware/require-role.js` | Access restricted by role (`requireRole`, `requireStaff`) |
| `server/routes/auth-routes.js` | Hiker and staff sign-in, current session and sign-out |
| `server/routes/booking-routes.js` | Availability, creation, list and cancellation of bookings |
| `server/routes/capacity-routes.js` | Meal services, dining tables and table assignments |
| `server/dao/auth-dao.js` | Reading accounts by email and ID |
| `server/dao/booking-dao.js` | Booking persistence and transactional table allocation |
| `server/dao/capacity-dao.js` | Persistence of meal services, tables and assignments |
| `server/services/booking-service.js` | Booking validation and availability calculation |
| `server/services/capacity-validation.js` | Validation of capacity configuration input |
| `server/services/password.js` | Password hashing and verification with scrypt |
| `server/services/booking-confirmation-content.js` | Subject, text and HTML of the booking confirmation email |
| `server/services/booking-confirmation-service.js` | Sending of the confirmation email through Resend |
| `server/init/init-accounts.js` | Creation of missing demo accounts |
| `server/models/models.js` | JSDoc definitions of the DTOs exchanged through the API |

## 7. Client-side

### 7.1 Routes

| Route | Page | Description | Access |
| --- | --- | --- | --- |
| `/` | `HomePage` | Availability check, booking form and hiker sign-in dialog | Public; booking requires a hiker account |
| `/menu` | `MenuPage` | Meal times and menus (placeholder) | Public |
| `/staff/login` | `StaffLoginPage` | Staff sign-in form | Public; signed-in staff are redirected to `/staff/capacity` |
| `/staff/capacity` | `StaffCapacityPage` | Configuration of tables, time slots and assignments | Staff; others are redirected to `/staff/login` or `/` |
| `/my-bookings` | `MyBookingsPage` | Hiker bookings (placeholder) | Hiker; visitors who are not signed in are redirected to `/` |
| Other paths | — | *Page not found* with a link to the home page | — |

Signed-in staff who open a route outside the staff area see `StaffAccessNotice` instead of the page.

### 7.2 React components

| Area | Component | Description |
| --- | --- | --- |
| `pages` | `HomePage` | Hero section, booking form and sign-in dialog |
| `pages` | `MenuPage` | Placeholder for meal times and menus |
| `pages` | `StaffLoginPage` | Staff sign-in |
| `pages` | `StaffCapacityPage` | Layout and dialogs of the staff area |
| `pages` | `MyBookingsPage` | Placeholder for the hiker bookings |
| `components/layout` | `SiteHeader` | Navigation bar with sign-in button or profile menu |
| `components/layout` | `SiteFooter` | Page footer |
| `components/common` | `ProfileMenu` | Profile menu shared by hikers and staff, with links and sign-out |
| `components/common` | `AutoDismissAlert` | Alert that closes automatically |
| `components/common` | `MountainLogo` | Application logo |
| `components/auth` | `LoginForm` | Sign-in form for the hiker or staff area |
| `components/auth` | `LoginModal` | Dialog containing the hiker sign-in form |
| `components/auth` | `StaffAccessNotice` | Notice shown to staff outside the staff area |
| `components/booking` | `BookingForm` | Booking flow and confirmation dialog |
| `components/booking` | `BookingSearch` | Date, meal service and guests selection |
| `components/booking` | `BookingAvailability` | Free seats and booking confirmation button |
| `components/booking` | `MyBookingsList`, `BookingCard` | List and card of hiker bookings (not yet used by a page) |
| `components/capacity` | `StaffSidebar`, `StaffHeader` | Staff area navigation and header |
| `components/capacity` | `StaffDateSelector` | Reference date selector |
| `components/capacity` | `StaffTablesPanel` | List of dining tables with add and edit actions |
| `components/capacity` | `StaffTimeSlotsPanel` | List of time slots with assigned tables and total seats |
| `components/capacity` | `CapacityFormModal` | Create and edit dialog for tables and time slots |
| `components/capacity` | `AssignTablesModal` | Table assignment dialog with total capacity |

### 7.3 Hooks, context and API

| Area | File | Responsibility |
| --- | --- | --- |
| `hooks` | `useAuthLogic.js` | Sign-in, session restoration, sign-out and feedback messages |
| `hooks` | `useBookingLogic.js` | Meal services, availability check and booking creation |
| `hooks` | `useStaffCapacity.js` | Loading and saving tables, time slots and assignments |
| `hooks` | `useMyBookings.js` | Loading the hiker bookings |
| `contexts` | `auth-context.js` | Authentication context and `useAuth` hook |
| `contexts` | `AuthContext.jsx` | `AuthProvider` sharing the authentication state |
| `API` | `session-api.js` | Session requests |
| `API` | `booking-api.js` | Meal service, availability and booking requests |
| `API` | `capacity-api.js` | Capacity configuration requests |
| `API` | `my-bookings-api.js` | Hiker bookings request |
| `models` | `models.js` | JSDoc definitions of the DTOs shared with the server |
| `utils` | `formatCount.js` | Count formatting with singular or plural noun |

**Organization:** components handle the interface, hooks handle state and interactions, and API modules handle HTTP requests with the session cookie. `AuthProvider` wraps the whole application, so every page shares the same session. Global CSS variables are defined in `client/src/index.css`.

## 8. Tests and checks

| Check | Command |
| --- | --- |
| All backend tests | `npm --prefix server test` |
| Unit tests | `npm --prefix server test -- tests/unit` |
| Integration tests | `npm --prefix server test -- tests/integration` |
| Single test file | `npm --prefix server test -- tests/integration/booking-api.test.js` |
| Watch mode | `npm --prefix server run test:watch` |
| Coverage | `npm --prefix server run test:coverage` |
| Backend type check | `npm --prefix server run typecheck` |
| Frontend lint | `npm --prefix client run lint` |
| Frontend type check | `npm --prefix client run typecheck` |
| Frontend build | `npm --prefix client run build` |

Automated tests verify backend behavior with the following organization:

- **Organization:** unit tests in `server/tests/unit` and integration tests in `server/tests/integration`. The command `npm --prefix server test` runs all tests.
- **Database:** tests use a separate database, `server/tests/mh-test.sqlite`, deleted before and after the run. Test files run one at a time because they share it.
- **Execution:** starting the backend is not required; Supertest uses the Express app directly. Resend is mocked, so no email is sent.
- **Coverage:** authentication and roles, booking rules and table allocation, availability, capacity configuration, confirmation email, database schema and production frontend serving. The coverage report is generated in `server/coverage`.

## 9. Contributors

Mountain Hut is developed by **Team 4** for the Software Engineering II course at Politecnico di Torino.

<a href="https://github.com/SE2-26-Team4/mountain-hut/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=SE2-26-Team4/mountain-hut" alt="Mountain Hut contributors" />
</a>

## 10. License

Mountain Hut is licensed under the GNU General Public License version 3.0 (GPL-3.0).

We chose the GNU GPL-3.0 License because it allows anyone to use, modify, and distribute Mountain Hut, including for commercial purposes, while requiring distributed derivative works to remain under the same license and their corresponding source code to be made available to recipients.

We believe this copyleft approach encourages collaboration and transparency by ensuring that improvements to distributed versions of the software remain accessible to the community.

See the [LICENSE](LICENSE) file for the full license text.
