# Docker Deployment Guide

This guide explains how to download and run the published Mountain Hut Docker image on Windows, macOS, or Linux.

The Docker image contains the application code and frontend build. It does not contain the secrets or the SQLite database.

## Prerequisites

Install Docker Desktop for Windows or macOS, or Docker Engine with Docker Compose on Linux, then start Docker.

Verify Docker:

```powershell
docker --version
docker compose version
```

## 1. Download the image

Open a terminal (PowerShell on Windows, Terminal on macOS/Linux) and download the image:

```powershell
docker pull lorebosso/mountain-hut:latest
```


## 2. Place the secrets file

Save the secrets file received for the deployment (`mountain-hut.env`).

On Windows, for example:

```text
C:\Users\<Windows-user>\Desktop\mountain-hut.env
```


On macOS/Linux, for example:

```text
/Users/<mac-user>/Desktop/mountain-hut.env
```

or:

```text
/home/<linux-user>/mountain-hut.env
```

If the file is saved elsewhere, use its full absolute path in the `docker run` command.

If you do not have the file yet, create `mountain-hut.env` with the following content:

```env
SESSION_SECRET=change-me-to-a-long-random-secret
SEED_DEMO_ACCOUNTS=true
TEST_HIKER_EMAIL=hiker@example.com
TEST_HIKER_PASSWORD=HikerTest123!
RESEND_API_KEY=re_your_resend_api_key
EMAIL_FROM=Mountain Hut <onboarding@resend.dev>
```

## 3. Create a persistent database volume

The following command creates a Docker volume for the SQLite database. The database is not included in the image:

```powershell
docker volume create mountain_hut_sqlite_data
```

Creating the volume is safe if it already exists.

## 4. Remove an existing container

Remove any container previously named `mountain-hut`:

```powershell
docker rm -f mountain-hut
```

This command is optional. It removes only the container, not the database volume.

## 5. Run the image

### Windows PowerShell

Run the following command from any PowerShell directory:

```powershell
docker run --name mountain-hut `
  --env-file "$env:USERPROFILE\Desktop\mountain-hut.env" `
  -e NODE_ENV=production `
  -e PORT=8080 `
  -e DB_PATH=/app/data/mountain-hut.sqlite `
  -p 8080:8080 `
  -v mountain_hut_sqlite_data:/app/data `
  lorebosso/mountain-hut:latest
```

### macOS/Linux terminal

Run the following command, replacing `/absolute/path/to/mountain-hut.env` with the secrets-file location:

```bash
docker run --name mountain-hut \
  --env-file /absolute/path/to/mountain-hut.env \
  -e NODE_ENV=production \
  -e PORT=8080 \
  -e DB_PATH=/app/data/mountain-hut.sqlite \
  -p 8080:8080 \
  -v mountain_hut_sqlite_data:/app/data \
  lorebosso/mountain-hut:latest
```

The application will keep running in that terminal. Open:

```text
http://localhost:8080
```

To stop it, press `Ctrl+C`.

To run it in the background, add `-d` after `docker run`:

```powershell
docker run -d --name mountain-hut `
  --env-file "$env:USERPROFILE\Desktop\mountain-hut.env" `
  -e NODE_ENV=production `
  -e PORT=8080 `
  -e DB_PATH=/app/data/mountain-hut.sqlite `
  -p 8080:8080 `
  -v mountain_hut_sqlite_data:/app/data `
  lorebosso/mountain-hut:latest
```

For macOS/Linux:

```bash
docker run -d --name mountain-hut \
  --env-file /absolute/path/to/mountain-hut.env \
  -e NODE_ENV=production \
  -e PORT=8080 \
  -e DB_PATH=/app/data/mountain-hut.sqlite \
  -p 8080:8080 \
  -v mountain_hut_sqlite_data:/app/data \
  lorebosso/mountain-hut:latest
```

Check the container status:

```powershell
docker ps
```

Check the application health endpoint:

```powershell
curl.exe http://localhost:8080/api/health
```

On macOS/Linux:

```bash
curl http://localhost:8080/api/health
```

View container logs:

```powershell
docker logs mountain-hut
```

## 6. Demo login credentials and first startup

With `SEED_DEMO_ACCOUNTS=true`, the demo database is initialized with these accounts:

| Role | Email | Password | Sign-in |
| --- | --- | --- | --- |
| Hiker | `hiker@example.com` | `HikerTest123!` | Home page, select **Sign in** |
| Employee | `employee@example.com` | `EmployeeTest123!` | Home page, select **Sign in**, then select **Are you an employee? Log in here** |

The initial database has no dining tables or meal slots configured.

On the first startup, sign in first as the employee account and configure the dining tables and meal-slot schedule in the staff capacity interface. Then sign out and use the hiker account to verify availability and create a booking.

If a hiker is used before the employee configures capacity, availability will be zero. This does not indicate an application failure; the staff must configure capacity first.

## 7. Start and stop the background container

Stop the container:

```powershell
docker stop mountain-hut
```

Start it again:

```powershell
docker start mountain-hut
```

Remove the container without deleting the database:

```powershell
docker rm -f mountain-hut
```

Delete the database volume only when the saved database must be removed:

```powershell
docker volume rm mountain_hut_sqlite_data
```

## 8. Updating the image

Download the latest published version and recreate the container:

```powershell
docker pull lorebosso/mountain-hut:latest
docker rm -f mountain-hut
docker run -d --name mountain-hut `
  --env-file "$env:USERPROFILE\Desktop\mountain-hut.env" `
  -e NODE_ENV=production `
  -e PORT=8080 `
  -e DB_PATH=/app/data/mountain-hut.sqlite `
  -p 8080:8080 `
  -v mountain_hut_sqlite_data:/app/data `
  lorebosso/mountain-hut:latest
```

On macOS/Linux, use the same commands with a backslash-continued `docker run` command and the absolute path to the secrets file.
