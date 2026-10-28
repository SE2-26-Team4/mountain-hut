# Mountain Hut

Mountain Hut is a web application developed as part of the **Software Engineering II** course at **Politecnico di Torino** (academic year 2026–2027).

The project aims to support the activities of a mountain hut, helping visitors interact with hut services and supporting staff in managing reservations, availability, and day-to-day operations.

> **Project status:** Initial setup. This README documents the current repository structure and the planned deployment approach. Features and full application startup instructions will be updated as implementation progresses.

## Table of Contents

- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Repository Structure](#repository-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Running with Docker](#running-with-docker)
  - [Local Frontend Development](#local-frontend-development)
- [Project Specifications](#project-specifications)
- [Contributors](#contributors)
- [License](#license)

## Technology Stack

The project uses the following technologies and tools:

| Area | Technology | Version | Purpose |
| --- | --- | --- | --- |
| Frontend | React | ^19.3.1 | Web user interface |
| Frontend build and development | Vite | ^8.3.5 | Development server and production build |
| Backend | Node.js and Express | Node.js 24 LTS, Express TBD | HTTP API and server-side application (planned) |
| Database | SQLite | TBD | Application data storage (planned) |
| Containerization | Docker and Docker Compose | — | Application packaging and container orchestration |
| Version control | Git and GitHub | — | Source code management and collaboration |

## Architecture

Mountain Hut follows a client–server architecture consisting of three main components:

- **Frontend (`client/`):** a React application built with Vite, responsible for the user interface.
- **Backend (`server/`):** a Node.js/Express application intended to handle HTTP requests, implement business logic, and expose REST API endpoints.
- **Database:** SQLite, intended to provide persistent storage for application data.

> **Note:** The architecture described above reflects the intended application structure. Some components are still under development.

## Repository Structure

```text
mountain-hut/
├── client/               # React frontend and Vite configuration
├── server/               # Node.js/Express backend
├── retrospective/        # Project retrospective materials
├── Dockerfile             # Multi-stage Docker image build
├── docker-compose.yml     # Container configuration and persistent volume
├── .dockerignore          # Files excluded from Docker build context
├── .gitignore             # Files excluded from Git tracking
├── LICENSE                # GNU GPL-3.0 license
└── README.md              # Project documentation
```

> **Note:** The repository structure will evolve as development progresses.

## Getting Started

### Prerequisites

To run Mountain Hut using Docker, the following tools are required:

- [Docker](https://www.docker.com/)
- Docker Compose (included with modern Docker installations)

For local development outside Docker, a compatible version of Node.js and npm is also required.

### Running with Docker

The project includes a Dockerfile and a Docker Compose configuration intended to build and run the application.

From the repository root, execute:

```bash
docker compose up --build
```

Once the container is running, open the application in your browser at:

**http://localhost:8080**

To stop the application and remove its container:

```bash
docker compose down
```

The SQLite database is intended to be stored in a persistent Docker volume, so its data is preserved when the application container is removed or recreated.

> **Important:** Running `docker compose down -v` also removes the named volume and may permanently delete the stored database data.

> **Note:** The complete Docker startup procedure will be verified once the backend implementation is available.

### Local Frontend Development

To run the React frontend locally, execute the following commands from the repository root:

```bash
cd client
npm install
npm run dev
```

The development server is available by default at:

**http://localhost:5173**

API requests under `/api` are forwarded to the backend at `http://localhost:8080`, which must be running for those requests to succeed.

Additional frontend commands:

```bash
npm run build    # Build the frontend for production
npm run lint     # Run ESLint
npm run preview  # Preview the production build
```

## Project Specifications

The official project specifications and requirements are available in the course repository:

[Mountain Hut — Project Specifications](https://github.com/SE2-Polito/AY26-27-Mountain-Hut)

> **Note:** Supported features and implementation details will be documented as development progresses.

## Contributors

Mountain Hut is developed by **Team 4** for the Software Engineering II course at Politecnico di Torino.

<a href="https://github.com/SE2-26-Team4/mountain-hut/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=SE2-26-Team4/mountain-hut" alt="Mountain Hut contributors" />
</a>

## License

Mountain Hut is licensed under the GNU General Public License version 3.0 (GPL-3.0).

We chose the GNU GPL-3.0 License because it allows anyone to use, modify, and distribute Mountain Hut, including for commercial purposes, while requiring distributed derivative works to remain under the same license and their corresponding source code to be made available to recipients.

We believe this copyleft approach encourages collaboration and transparency by ensuring that improvements to distributed versions of the software remain accessible to the community.

See the [LICENSE](LICENSE) file for the full license text.
