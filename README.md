# Mountain Hut

Mountain Hut is a web application for booking meals at a mountain hut. Visitors can check availability for a date, meal service, and party size. Hikers can reserve seats, add dietary requirements, receive booking confirmations by email, and manage their reservations. Hut staff can configure dining tables and meal slots, take bookings on behalf of hikers, and copy weekly schedules.

The project is developed as part of the Software Engineering II course at Politecnico di Torino (academic year 2026–2027).

## Table of contents

- [Technology stack](#technology-stack)
- [Architecture](#architecture)
- [Repository structure](#repository-structure)
- [Installation and startup](#installation-and-startup)
  - [Startup options](#startup-options)
    - [Option A: Docker](#option-a-docker)
      - [Docker Compose](#docker-compose)
      - [Docker Hub release deployment](#docker-hub-release-deployment)
    - [Option B: Local development](#option-b-local-development)
  - [First booking and demo accounts](#first-booking-and-demo-accounts)
- [Environment configuration](#environment-configuration)
- [Tests and code checks](#tests-and-code-checks)
- [Project specifications](#project-specifications)
- [Contributors](#contributors)
- [License](#license)

## Technology stack

- **Frontend:** React 19, Vite 8, React Router, Bootstrap 5, React Bootstrap, Bootstrap Icons.
- **Backend:** Node.js, Express 5, Passport with `passport-local`, `express-session`.
- **Database:** SQLite via `sqlite3`.
- **Email:** Resend for booking notifications and account access emails.
- **Tests and checks:** Vitest, Supertest, ESLint, and TypeScript for type checking JavaScript.
- **Deployment:** Docker and Docker Compose.

## Architecture

Mountain Hut follows a client–server architecture consisting of three main components:

- **Frontend (`client/`):** A React application built with Vite that provides the user interface for hikers and staff.
- **Backend (`server/`):** A Node.js application that uses Express to expose the REST API and handle authentication, reservations, and dining capacity.
- **Database (`server/mountain-hut-schema.sql`):** SQLite stores user accounts, reservations, meal slots, and table assignments.

## Repository structure

```text
mountain-hut/
├── client/                # React/Vite frontend
├── server/                # Express API, SQLite schema, services, and tests
├── retrospective/         # Team retrospective materials
├── .env.example           # Environment configuration template
├── Dockerfile             # Instructions for building the application image
├── docker-compose.yml     # App configuration and persistent SQLite volume
├── LICENSE
└── README.md
```

## Installation and startup

### Startup options

Choose [Docker](#option-a-docker) to run Mountain Hut in a container, or [local development](#option-b-local-development) to run the frontend and backend directly on your machine. Once the application is running, follow [First booking and demo accounts](#first-booking-and-demo-accounts) to configure availability and make your first booking.

#### Option A: Docker

With a local copy of the repository, follow [Docker Compose](#docker-compose). To run the published image without cloning the repository, follow [Docker Hub release deployment](#docker-hub-release-deployment).

##### Docker Compose

**Prerequisite:** Install Docker with Docker Compose and start Docker. Run the commands below from the repository root. To run the published image without cloning the repository, see [Docker Hub release deployment](#docker-hub-release-deployment).

1. **Prepare the `.env` file.**

   If you received a configured `.env` file, place it in the same directory as `docker-compose.yml` and continue to step 2.

   Otherwise, copy `.env.example` from the repository root to a new file named `.env`, then open `.env` in a text editor.

   **Windows PowerShell**

   ```powershell
   Copy-Item .env.example .env
   notepad .env
   ```

   **macOS, Linux, or Git Bash**

   ```bash
   cp .env.example .env
   ```

   Set `SESSION_SECRET` to a long, random value. To create the demo accounts, set `SEED_DEMO_ACCOUNTS=true`. To enable email delivery, configure `RESEND_API_KEY` and `EMAIL_FROM`. Keep `.env` private.

2. **Start the application.** Choose one option:
   - **Build from the local source** to run the version in your checkout:

     ```bash
     docker compose up --build -d
     ```

   - **Use the published Docker Hub image** to run the release:

     ```bash
     docker compose pull app
     docker compose up --no-build -d
     ```

3. **Open Mountain Hut** at <http://localhost:8080>. The container serves both the frontend and the API.

4. **Stop the application** when you are finished:

   ```bash
   docker compose down
   ```

   **Warning:** Run the following command only if you also want to permanently delete the SQLite database, including accounts, bookings, and schedules:

   ```bash
   docker compose down -v
   ```

##### Docker Hub release deployment

Use the [published Mountain Hut image](https://hub.docker.com/r/lorebosso/mountain-hut) to run the application without cloning the repository. The image includes the backend and the compiled frontend.

**Prerequisite:** Install and start Docker Desktop on Windows or macOS, or Docker Engine on Linux. To verify that Docker is running, open a terminal and run:

```bash
docker info
```

1. **Prepare the `.env` file.** If you received a deployment ZIP, extract the supplied `.env` file. Otherwise, download [`.env.example`](.env.example), save it as `.env`, and configure it as described in [Environment configuration](#environment-configuration). Keep this file private.

2. **Download the image.** Open PowerShell on Windows or a terminal on macOS/Linux in the folder containing `.env`, then run:

   ```bash
   docker pull lorebosso/mountain-hut:latest
   ```

   **First installation:** Continue to step 3.

   **Updating an existing installation:** Once the download succeeds, stop and remove the `mountain-hut` container created by this guide. The SQLite database stays in its named volume.

   ```bash
   docker stop mountain-hut
   docker rm mountain-hut
   ```

3. **Start Mountain Hut.** Run the following command from the same folder:

   ```bash
   docker run -d --name mountain-hut --env-file .env -e CLIENT_ORIGIN=http://localhost:8080 -p 8080:8080 -v mountain_hut_sqlite_data:/app/data lorebosso/mountain-hut:latest
   ```

   Docker loads the configuration from `.env` and creates the `mountain_hut_sqlite_data` volume on first use. When you update an existing installation, the new container reuses that volume with your saved bookings and schedules.

4. **Verify the deployment.** Open <http://localhost:8080/api/health> to check that the backend responds, then open <http://localhost:8080> to use the application. Follow [First booking and demo accounts](#first-booking-and-demo-accounts) to configure availability and make a reservation.

   If the application does not open, check the container status and startup logs:

   ```bash
   docker ps -a --filter name=mountain-hut
   docker logs mountain-hut
   ```

5. **Stop and restart the application.** To stop it, run:

   ```bash
   docker stop mountain-hut
   ```

   To start the same container again, run:

   ```bash
   docker start mountain-hut
   ```

6. **Optional cleanup.** Use this step only when you want to remove the installation and delete its saved data.

   Stop the container if it is running, then remove it:

   ```bash
   docker stop mountain-hut
   docker rm mountain-hut
   ```

   **Warning:** The following command permanently deletes the SQLite database, including accounts, bookings, and schedules:

   ```bash
   docker volume rm mountain_hut_sqlite_data
   ```

#### Option B: Local development

**Prerequisite:** Install Node.js 24 LTS and npm. Open two terminals at the repository root.

1. **Set up the backend in Terminal 1.**

   ```bash
   cd server
   npm ci
   ```

   To test email delivery locally, set `RESEND_API_KEY` and `EMAIL_FROM` in this terminal before starting the server. The backend's `npm run dev` command does not automatically load the `.env` file from the repository root. See [Environment configuration](#environment-configuration).

2. **Start the backend.**

   For normal development, run:

   ```bash
   npm run dev
   ```

   **Demo accounts:** If you want to create demo accounts in a new local database, use the command for your shell instead:
   - **macOS, Linux, or Git Bash**

     ```bash
     SEED_DEMO_ACCOUNTS=true npm run dev
     ```

   - **Windows PowerShell**

     ```powershell
     $env:SEED_DEMO_ACCOUNTS = "true"
     npm run dev
     ```

   The backend initializes SQLite on startup and listens at <http://localhost:3000> by default. Once created, the demo accounts remain in the local database and you can use `npm run dev` on subsequent runs.

3. **Start the frontend in Terminal 2.**

   From the repository root, run:

   ```bash
   cd client
   npm ci
   npm run dev
   ```

4. **Open Mountain Hut** at <http://localhost:5173>. Vite forwards `/api` requests to the backend at <http://localhost:3000>, as configured in `client/vite.config.js`. Keep both terminals running while using the application.

### First booking and demo accounts

When `SEED_DEMO_ACCOUNTS=true`, the backend creates any missing demo accounts. The steps below use the default credentials.

1. **Choose how to set up the booking schedule.**
   - **Use the demo data.** Set both `SEED_DEMO_ACCOUNTS=true` and `SEED_DEMO_DATA=true` before starting the application with a fresh database. Continue to step 2 and sign in as the demo hiker. On the day the data is created, **My bookings** shows 3 upcoming, 3 past, and 3 cancelled bookings. To try a new booking, search for **Dinner** seven days after that first startup: 6 guests can book across two tables. **Lunch** on the same date is fully booked. Restarting the application preserves your changes.

   - **Configure the schedule yourself.** Leave `SEED_DEMO_DATA=false`. On the home page, select **Sign in**, then **Are you an employee? Log in here**. Sign in with `employee@example.com` and password `EmployeeTest123!`. Open **Tables & Slots** and configure dining tables and meal slots for the date you want to book. Sign out when you are finished.

   Staff can also create a hiker account from **Staff Booking**. Select **New**, enter the hiker’s details, and select **Create account**. With email delivery configured, the hiker receives a temporary password and must change it at first sign-in.

2. **Choose how to test the booking as a hiker.**
   - **To try booking without receiving emails**, select **Sign in** and use `hiker@example.com` with password `HikerTest123!`.
   - **To receive booking emails**, use an email address whose inbox you can access. If staff created your account, select **Sign in** and enter the temporary password you received by email. Otherwise, select **Sign up** to create your own account.

3. **Make your first booking.** While signed in as a hiker, search for availability on the date you configured, select a meal slot, and confirm your reservation.

## Environment configuration

1. **Prepare the configuration.** If you received a configured `.env` file, use it as provided. Otherwise, copy [`.env.example`](.env.example) to `.env` and replace the placeholder values. Keep `.env` private. Never commit it or include it in a Docker image.

2. **Choose how to load the settings.**
   - **Docker Compose** reads `.env` from the directory containing `docker-compose.yml` by default. To use a file in another location, set `ENV_FILE` to its path.
   - **Docker Hub deployment** uses `docker run --env-file` to load the file. See [Docker Hub release deployment](#docker-hub-release-deployment) for the full command.
   - **Local development** with `npm run dev` does not automatically load `.env`. Set the variables in the terminal before starting the backend, or define them in your IDE’s run configuration.

3. **Configure sessions and demo data.** Set `SESSION_SECRET` to a long, random value. Choose the demo settings for your first startup:
   - `SEED_DEMO_ACCOUNTS=true` creates any missing demo accounts.
   - `SEED_DEMO_DATA=true` adds sample tables, meal slots, and bookings to an empty schedule. Enable both flags to try the prepared demo. Leave `SEED_DEMO_DATA=false` to configure the schedule yourself.

   See [First booking and demo accounts](#first-booking-and-demo-accounts) for the default credentials and booking examples.

4. **Enable email delivery.** Set `RESEND_API_KEY` to a valid Resend API key and `EMAIL_FROM` to a sender address authorized for that key. Mountain Hut uses email for booking confirmations, password resets, and first-login credentials for staff-created hiker accounts. A booking remains valid even if its confirmation email cannot be delivered.

## Tests and code checks

Run the following commands from the repository root. If you have not installed the dependencies yet, run `npm --prefix server ci` and `npm --prefix client ci` first.

**Backend**

```bash
npm --prefix server test
npm --prefix server run typecheck
```

To generate the backend test coverage report, run `npm --prefix server run test:coverage`. Unit and integration tests are in `server/tests/unit/` and `server/tests/integration/`.

**Frontend**

```bash
npm --prefix client run lint
npm --prefix client run typecheck
npm --prefix client run build
```

## Project specifications

[Official Mountain Hut project specifications](https://github.com/SE2-Polito/AY26-27-Mountain-Hut)

## Contributors

[![Mountain Hut contributors](https://contrib.rocks/image?repo=SE2-26-Team4/mountain-hut)](https://github.com/SE2-26-Team4/mountain-hut/graphs/contributors)

## License

GNU General Public License v3.0 (GPL-3.0). See [LICENSE](LICENSE).
