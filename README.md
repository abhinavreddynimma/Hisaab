# Hisaab

A freelancer payroll management app for tracking income, clients, invoices, work days, and tax obligations. Built with Next.js, SQLite, and Drizzle ORM.

## Features

- **Dashboard** — Overview of earnings, invoices, leave balance, and financial projections
- **Client Management** — Create and manage client profiles with projects and daily rates
- **Calendar** — Track working days, leaves, holidays, half-days, and extra working days
- **Invoices** — Generate invoices with line items, tax calculations (CGST/SGST/IGST), and PDF export
- **Payments** — Record payment receipts with EUR-to-INR exchange rates and bank/platform charges
- **Tax Tracking** — Track quarterly advance tax payments by financial year
- **Settings** — Configure invoice numbering, tax rates, leave policies, and user profile

## Screenshots

### Dashboard
![Dashboard](docs/screenshots/dashboard.png)

### Calendar
![Calendar](docs/screenshots/calendar.png)

### Invoices
![Invoices](docs/screenshots/invoices.png)

### Invoice Detail
![Invoice Detail](docs/screenshots/invoice-detail.png)

### Client Management
![Clients](docs/screenshots/clients.png)

### Tax Tracking
![Tax](docs/screenshots/tax.png)

### Settings
![Settings](docs/screenshots/settings.png)

## Tech Stack

- **Framework:** Next.js 16 (App Router, Server Actions, Turbopack)
- **Language:** TypeScript
- **Database:** SQLite with Drizzle ORM
- **UI:** Tailwind CSS, Shadcn/ui, Radix UI
- **Charts:** Recharts

## Prerequisites

- Node.js 18+
- npm

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Initialize the database**

   ```bash
   npm run db:push
   ```

   This creates the SQLite database at `data/payroll.db`.

3. **Start the dev server**

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000/hisaab](http://localhost:3000/hisaab)

## Production Build

```bash
npm run build
npm start
```

## Self-Hosting with Docker

Host Hisaab on your home server (tested on Beelink Mini S13) so it runs 24/7 and is accessible to your accountant, CA, or anyone on your network.

### Prerequisites

- [Docker](https://docs.docker.com/engine/install/) and [Docker Compose](https://docs.docker.com/compose/install/) installed on your server
- Git (to clone the repo)

### Quick Start

```bash
# Clone the repo
git clone https://github.com/your-username/hisaab.git
cd hisaab

# Build and start (runs in background, restarts automatically)
docker compose up -d --build
```

Hisaab is now running at **http://your-server-ip:3000**

### Configuration

Create a `.env` file to customize settings (all optional):

```env
# Port to expose on the host (default: 3000)
PORT=3000

# Where to store database and attachments on the host (default: ./data)
DATA_LOCATION=./data
```

### Commands Reference

```bash
# Start the app (build + run in background)
docker compose up -d --build

# View logs
docker compose logs -f

# Stop the app
docker compose down

# Restart the app
docker compose restart

# Rebuild after pulling new changes
git pull
docker compose up -d --build

# Check health status
docker inspect --format='{{.State.Health.Status}}' hisaab

# Back up your data (database + attachments)
cp -r ./data ./data-backup-$(date +%Y%m%d)
```

### Data & Backups

All your data lives in one directory (`./data` by default):
- `payroll.db` — SQLite database (clients, invoices, settings, etc.)
- `attachments/` — uploaded invoice attachments

To back up, just copy this directory. To migrate to a new server, copy `./data` to the new machine and run `docker compose up -d --build`.

### Accessing from Other Devices

Once running, Hisaab is accessible to anyone on your local network at `http://<server-ip>:3000`.

To share with people outside your network (your CA, accountant, etc.), you have a few options:

1. **Tailscale / ZeroTier** (recommended) — Create a private network. Install the client on your server and their devices. No port forwarding needed, fully encrypted.
2. **Cloudflare Tunnel** — Expose your server to the internet securely without opening ports. Free tier available.
3. **Reverse proxy + port forwarding** — Use Nginx or Caddy as a reverse proxy with a domain name and Let's Encrypt SSL. Forward port 443 on your router to the server.

### Updating

```bash
cd hisaab
git pull
docker compose up -d --build
```

The database schema auto-migrates on startup, so updates are safe.
