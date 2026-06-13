# Auth Demo (Registration, Login, Roles, Email Verification)

[![CI Smoke Tests](https://github.com/<owner>/<repo>/actions/workflows/smoke-tests.yml/badge.svg)](https://github.com/<owner>/<repo>/actions/workflows/smoke-tests.yml)

Quick local demo using Node.js + Express. Features:
- Registration with role selection (Customer, Owner, Admin)
- Password hashing with bcryptjs
- Email verification (nodemailer ethereal preview)
- JWT-based login and role-based protected endpoint

Run locally:

```powershell
cd "c:\Users\MUSKAN COMPUTERS\Desktop\Project"
npm install
npm start
```

Open `http://localhost:3000/register.html` to create an account. After registering, you'll receive a preview link to open the verification email (ethereal) — click it or open the verification link. Then log in at `/login.html`.

React client (development):

1. Open a separate terminal and run the client dev server:

```powershell
cd "c:\Users\MUSKAN COMPUTERS\Desktop\Project\client"
npm install
npm run dev
```

2. The Vite dev server will host the React SPA (default port 5173). The SPA proxies requests to the backend when you run both servers locally.

## Migration & Current Status

- Runtime storage: migrated from JSON files to MySQL (accessed via `knex`).
- Firebase: removed — no `firebase-admin` usage remains.
- JSON files: archived to the `archive/` folder; originals removed from project root.

## Quickstart (MySQL)

Prerequisites:

- Node.js (v18+ recommended; project was tested on Node 24)
- MySQL server

Environment (.env) - create a `.env` in the project root with these values:

```
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=abc123
DB_NAME=heavy_machine
JWT_SECRET=your_jwt_secret
PORT=3000
```

Install and run:

```powershell
npm install
npm run migrate
# (optional) import archived JSON into MySQL if you need to re-run imports
npm run import:users
npm run import:machines
npm run import:bookings
npm run import:contacts
npm start
```

Files and utilities:

- Server entry: [server.js](server.js)
- DB config / migrations: [knexfile.js](knexfile.js) and `migrations/`
- Import scripts: [scripts/migrate-users-to-mysql.js](scripts/migrate-users-to-mysql.js), [scripts/migrate-machines-to-mysql.js](scripts/migrate-machines-to-mysql.js), [scripts/migrate-bookings-to-mysql.js](scripts/migrate-bookings-to-mysql.js), [scripts/migrate-contacts-to-mysql.js](scripts/migrate-contacts-to-mysql.js)
- Archived JSON: [archive/users.json](archive/users.json), [archive/machines.json](archive/machines.json), [archive/bookings.json](archive/bookings.json), [archive/contacts.json](archive/contacts.json)

Notes:

- The frontend (React in `client/` and static pages in `public/`) uses API endpoints (`/api/*`) — there should be no direct file-based `.json` reads in runtime code.
- I removed the unused `mysql` npm package in favor of `mysql2` and ran `npm audit fix --no-force`.
- I added `.env` to `.gitignore` and committed the migration and cleanup changes.

Next recommended tasks:

- Add automated integration tests for register/login/list/create booking.
- Add DB backup and seed scripts and document a restore process.
- Review `package.json` for any remaining dev-only packages to move to `devDependencies`.

If you'd like, I can (A) update migration scripts to point at `archive/*.json` explicitly, (B) add a minimal seed file and backup script, or (C) create integration tests — tell me which to do next.
