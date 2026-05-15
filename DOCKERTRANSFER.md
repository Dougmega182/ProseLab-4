Here is the complete, high-detail `README.md` file. It combines your Synology DSM setup with the Windows 11 Docker Desktop workflow, including the proxy, security, and image sources we discussed.

---

# Company Web App Hosting & Deployment Guide

**Target Environments:** Synology DSM (NAS) & Windows 11 (Docker Desktop)

**Stack:** Node.js, React, Python, PostgreSQL

---

## 1. Required Docker Images (Docker Hub)

Pull these official images to ensure stability and security:

* **Database:** `postgres:latest`
* **Node Backend:** `node:18-slim` (or `alpine` for a smaller footprint)
* **Python Backend:** `python:3.11-slim`
* **Proxy/Frontend:** `nginx:stable-alpine`
* **Log Monitoring:** `amir20/dozzle:latest` (To view container logs in a browser)

---

## 2. Windows 11: Local Development Setup

On Windows, we use **Docker Compose**. It’s much faster than clicking through a GUI for multiple apps.

### Prerequisites

1. **Install Docker Desktop:** Ensure "Use the WSL 2 based engine" is checked in Settings.
2. **Install Tailscale:** For secure remote access without port forwarding.

### The `docker-compose.yml` File

Create a folder for your project and save this as `docker-compose.yml`:

```yaml
version: '3.8'
services:
  # Database
  db:
    image: postgres:latest
    container_name: company_db
    restart: always
    environment:
      POSTGRES_PASSWORD: your_strong_password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  # Node.js API
  node-app:
    build: ./node-backend
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgres://postgres:your_strong_password@db:5432/mydb
    depends_on:
      - db

  # Python Service
  python-app:
    build: ./python-service
    ports:
      - "8000:8000"
    depends_on:
      - db

  # Nginx Reverse Proxy & React Frontend
  proxy:
    image: nginx:stable-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./react-build:/usr/share/nginx/html:ro

volumes:
  postgres_data:

```

### To Spin Up:

1. Open PowerShell in that folder.
2. Run: `docker compose up -d`

---

## 3. Proxy Server & SSL (Windows & NAS)

### The Proxy Logic

To allow workers to access apps via `app1.local` instead of `localhost:3000`:

* **On Windows:** Use the Nginx service defined above. You must edit your `C:\Windows\System32\drivers\etc\hosts` file to point `app1.local` to `127.0.0.1`.
* **On Synology:** Go to **Control Panel > Login Portal > Advanced > Reverse Proxy**.
* **Source:** HTTPS | `app1.yourdomain.com` | 443
* **Destination:** HTTP | `localhost` | 3000 (Node) or 8000 (Python)



### SSL (Security Padlock)

* **Synology:** Use the built-in **Let's Encrypt** (Security > Certificate). It’s automated and free.
* **Windows (Local):** Use **mkcert**.
1. Install mkcert via Chocolatey/Scoop.
2. Run `mkcert -install`.
3. Run `mkcert app1.local` to generate `.pem` files.
4. Link these files in your `nginx.conf`.



---

## 4. Synology DSM 7.2+ Graphical Steps

1. **Container Manager:** Open **Registry**, download `postgres`, `node`, `python`.
2. **Database:** Create container -> Map port `5432` -> Set `POSTGRES_PASSWORD` in Environment.
3. **Project (Web Apps):**
* Use the **Project** tab to upload your `docker-compose.yml` directly.
* Alternatively, use **Web Station** -> **Web Service** -> **Create** -> **Containerized Web Service**.


4. **Persistent Storage:** Always map `/var/lib/postgresql/data` to a physical folder in `/docker/db_data` so you don't lose data on restart.

---

## 5. Sharing with Employees (Tailscale)

Do not open ports 80/443 on your home or office router.

1. Install **Tailscale** on the Synology (Package Center) or your Windows PC.
2. Have employees install Tailscale on their devices and invite them to your "Tailnet."
3. They can now access the apps using your machine's **Tailscale IP** or **MagicDNS** name (e.g., `http://nas-name/app1`) from anywhere in the world as if they were in the office.

---

## 6. Maintenance & Backups

* **Logging:** Run the `dozzle` container on port `8080`. You can see all app errors in one web view.
* **Backups:** On Synology, use **Hyper Backup** to back up the `/docker` folder nightly. On Windows, set a Task Scheduler script to run:
`docker exec company_db pg_dumpall -U postgres > backup.sql`

---

**Safe travels! This file is ready to be saved as `README.md` and dropped into your project root.**

To migrate your data from a local installation of PostgreSQL to your new Docker-based setup, the most reliable method is to perform a **Dump and Restore**. This essentially exports your entire database into a single script file and then runs that script inside your new container.

Since you'll be doing this once you've stopped driving, here is the breakdown for both Windows and Synology.

---

## 1. Export (Dump) your Local Data

First, you need to get the data out of your current "localhost" environment. Open your terminal (PowerShell or Command Prompt) and run:

```bash
pg_dump -U your_local_username -d your_db_name > migration_data.sql

```

* **`your_local_username`**: Your current PC's database username (usually `postgres`).
* **`your_db_name`**: The specific database you want to move.
* **`migration_data.sql`**: This is the file that will be created.

---

## 2. Prepare the Container

Before importing, ensure your Docker container is running and that you have created the target database name inside it (if it doesn't exist yet).

* **On Windows:** Ensure your `docker-compose up -d` has finished.
* **On Synology:** Ensure the container status is "Running."

---

## 3. Import (Restore) into Docker

This is where you move the file into the "isolated" world of Docker.

### For Windows 11 (Docker Desktop)

Run this command from the folder where you saved `migration_data.sql`:

```bash
docker exec -i company_db psql -U postgres -d your_db_name < migration_data.sql

```

> **What this does:** It tells Docker to take the content of your `.sql` file and "pipe" it directly into the PostgreSQL engine running inside the container named `company_db`.

### For Synology DSM

1. **Upload the file:** Move `migration_data.sql` into your `/docker/postgres_data` folder using **File Station**.
2. **Run the command:**
* Open **Container Manager**.
* Click on your Postgres container and select **Details**.
* Go to the **Terminal** tab and click **Create** (this opens a bash/sh session).
* Type the following:
```bash
psql -U postgres -d your_db_name < /var/lib/postgresql/data/migration_data.sql

```





---

## Important Migration Checklist

* **Versions:** Ideally, your local Postgres version should match the Docker version (e.g., both 15 or both 16). If Docker is newer, it usually works fine; if Docker is older, you might hit errors.
* **Clean Slate:** If you are importing into a database that already has tables, it might cause "already exists" errors. It’s usually best to import into a fresh, empty database.
* **Connection Strings:** Once migrated, remember to update your Node and Python apps to point to the **Docker container name** (if using Compose) or the **NAS IP** instead of `localhost`.

Since you mentioned you'll be doing this later, do you have multiple databases to move, or just one main one for all the apps?

```

```