# Online Survey Builder

Create surveys, collect responses, and analyse results. React frontend, Express
API, SQL Server (via the `mssql` driver), JWT auth, Recharts dashboards.

---

## Stack

| Layer     | Choice |
| --------- | ------ |
| Frontend  | React 19, Vite, React Router 7, Recharts, plain CSS (light/dark) |
| Backend   | Node.js 20+, Express 5, Zod validation, Helmet, rate limiting |
| Database  | SQL Server (Local, Express, or Azure SQL) through `mssql` |
| Auth      | JWT bearer tokens + bcrypt password hashing |
| Exports   | CSV (hand-rolled), Excel (ExcelJS), PDF (PDFKit) |

---

## Prerequisites

- Node.js 20 or newer
- A reachable SQL Server instance and a database the login can write to

## Setup

```bash
# 1. install dependencies
npm run install:all

# 2. configure the server
copy server\.env.example server\.env      # Windows
cp server/.env.example server/.env        # macOS / Linux

# 3. create the tables (safe to re-run)
npm run migrate

# 4. optional: create the bootstrap admin from SEED_* values
npm run seed
```

Run the two dev servers in separate terminals:

```bash
npm run dev:server    # http://localhost:4000
npm run dev:client    # http://localhost:5173
```

Open <http://localhost:5173>. Vite proxies `/api` to Express, so no CORS
configuration is needed in development.

## Environment variables (`server/.env`)

| Variable                      | Purpose |
| ----------------------------- | ------- |
| `SQLSERVER_CONNECTION_STRING` | ADO.NET-style SQL Server connection string |
| `JWT_SECRET`                  | Token signing secret — use a long random value in production |
| `JWT_EXPIRES_IN`              | Token lifetime, e.g. `7d` |
| `PORT`                        | API port (default `4000`) |
| `CLIENT_ORIGIN`               | Comma-separated CORS origins for production |
| `SEED_ADMIN_*`                | Bootstrap admin created by `npm run seed` |

Connection string examples:

```
Server=localhost,1433;Database=SurveyBuilder;User Id=sa;Password=xxx;Encrypt=false;TrustServerCertificate=true
Server=tcp:myserver.database.windows.net,1433;Initial Catalog=SurveyBuilder;User Id=xxx;Password=xxx;Encrypt=true;TrustServerCertificate=true
```

---

## Project structure

```
.
├── client/
│   ├── src/
│   │   ├── components/     NavBar, shared UI primitives
│   │   ├── pages/          Login, Register, Dashboard, SurveyList,
│   │   │                   CreateSurvey, SurveyBuilder, SurveyResults,
│   │   │                   Respond, Profile
│   │   ├── charts/         Recharts wrappers (trend, breakdown, rating, donut)
│   │   ├── services/       api.js (fetch client), constants.js
│   │   ├── context/        AuthContext, ThemeContext
│   │   └── styles/         main.css (light + dark themes, responsive)
│   └── index.html
├── server/
│   ├── routes/             auth, survey, question, response, analytics, public
│   ├── controllers/        request handlers + Zod schemas
│   ├── models/             SQL data access (user, survey, question, response)
│   ├── services/           analytics, export, submission validation
│   ├── middleware/         auth (JWT), validate (Zod), error
│   ├── db/                 pool, env parsing, schema.sql, migrate.js
│   ├── scripts/seed.js
│   └── server.js
└── README.md
```

---

## Data model

| Table      | Purpose |
| ---------- | ------- |
| `Users`    | Accounts, bcrypt hash, `user`/`admin` role |
| `Surveys`  | Title, description, category, status, share token, expiry, response policy |
| `Questions`| Type, text, required flag, options (JSON), settings (JSON), position |
| `Responses`| One row per submission, linked to a survey, optional respondent |
| `Answers`  | One row per answered question, typed into text / number / JSON columns |

Three design points worth knowing:

**Answers are stored typed.** `ValueText`, `ValueNumber` and `ValueJson` are
separate columns so SQL can `AVG()` ratings and `GROUP BY` choices directly
rather than parsing JSON in Node. Checkbox answers (arrays) go to `ValueJson`.

**Duplicate submissions are blocked by the database.** Two filtered unique
indexes — `(SurveyId, RespondentId)` and `(SurveyId, GuestKey)` — guarantee one
submission per person and per device. The guest key is a SHA-256 hash of the
survey id, client IP and user agent, so it stores no personal data. Violations
surface as HTTP 409.

**Published surveys are read-only.** Question mutations are rejected with 400
while a survey is live, which keeps collected data consistent with its questions.
Close the survey to edit it.

---

## Features

**Authentication** — register, log in, update profile, change password, log
out. JWT bearer tokens, bcrypt hashing, rate-limited sign-in.

**Surveys** — title, description, category, expiry date, draft / live / closed
status, duplication, and search with filters on title, category, status and
creation date, sortable and paginated.

**Question types** — short text, long text, multiple choice, checkboxes,
dropdown, rating (configurable scale), yes/no. Options and per-type settings are
stored as JSON.

**Sharing** — every survey gets a random 32-character share token. The owner can
copy the link, share via WhatsApp or email, and rotate the token to revoke the
old link.

**Response collection** — a public endpoint renders the form, validates required
questions on both client and server, rejects options that are not on the
question, and blocks duplicates. Surveys can be set to allow anonymous
responses and/or multiple submissions, and stop accepting responses after an
expiry date.

**Analytics** — total responses, completion rate (answered question slots over
possible slots), average rating, 30-day response trend, per-question breakdowns,
and recent submissions. All aggregation happens in SQL.

**Exports** — CSV (one row per response, formula-injection safe), Excel
(responses plus a per-question summary sheet, frozen header, autofilter) and PDF
(chart-free summary with bar indicators, then each response).

**Interface** — dark mode, responsive down to phone width, keyboard-friendly
form controls, ARIA labels on inputs and modals.

---

## API reference

### Auth

| Method | Path                  | Auth | Description |
| ------ | --------------------- | ---- | ----------- |
| POST   | `/api/auth/register`  | –    | Create an account |
| POST   | `/api/auth/login`     | –    | Sign in, returns `{ token, user }` |
| GET    | `/api/auth/me`        | ✔    | Current user |
| PUT    | `/api/auth/profile`   | ✔    | Update name / email |
| PUT    | `/api/auth/password`  | ✔    | Change password |
| POST   | `/api/auth/logout`    | ✔    | Client-side token clear |

### Surveys

| Method | Path                             | Auth | Description |
| ------ | -------------------------------- | ---- | ----------- |
| GET    | `/api/surveys`                   | ✔    | List with search, filters, sort, pagination |
| POST   | `/api/surveys`                   | ✔    | Create |
| GET    | `/api/surveys/overview`          | ✔    | Cross-survey dashboard stats |
| GET    | `/api/surveys/categories`        | ✔    | Distinct categories in use |
| GET    | `/api/surveys/:id`               | ✔    | Survey plus questions |
| PATCH  | `/api/surveys/:id`               | ✔    | Update metadata |
| DELETE | `/api/surveys/:id`               | ✔    | Delete and cascade |
| POST   | `/api/surveys/:id/duplicate`     | ✔    | Copy survey and questions |
| POST   | `/api/surveys/:id/status/:status`| ✔    | `published`, `closed`, `reopen` |
| POST   | `/api/surveys/:id/share-token`   | ✔    | Rotate share link |

### Questions — `/api/surveys/:surveyId/questions`

| Method | Path      | Description |
| ------ | --------- | ----------- |
| GET    | `/`       | List ordered |
| POST   | `/`       | Create |
| PATCH  | `/:questionId` | Update |
| DELETE | `/:questionId` | Delete and resequence |
| PUT    | `/reorder`| Persist new order via `questionIds` |

### Responses, analytics, export

| Method | Path                                    | Description |
| ------ | --------------------------------------- | ----------- |
| GET    | `/api/surveys/:id/responses`            | Paginated submissions |
| GET    | `/api/surveys/:id/responses/:responseId`| One submission with answers |
| DELETE | `/api/surveys/:id/responses/:responseId`| Delete a submission |
| GET    | `/api/surveys/:id/analytics`            | Full analytics payload |
| GET    | `/api/surveys/:id/export?format=csv\|excel\|pdf` | Download responses |

### Public (no auth)

| Method | Path                                       | Description |
| ------ | ------------------------------------------ | ----------- |
| GET    | `/api/public/surveys/:token`               | Survey definition for the form |
| POST   | `/api/public/surveys/:token/responses`     | Submit answers |

Errors are JSON: `{ "error": "message", "fieldErrors": { "field": "reason" } }`.

---

## How a survey flows

```
Register → create survey (draft)
        → add questions
        → publish  (blocked if it has no questions)
        → share the link
        → respondents submit (one per person/device unless allowed)
        → responses and answers stored
        → dashboard charts + CSV/Excel/PDF export
```

---

## Deployment

**API (Render, Railway, Fly.io)**

Build: `npm --prefix server install`
Start: `npm --prefix server start`

Set `SQLSERVER_CONNECTION_STRING`, `JWT_SECRET` and `CLIENT_ORIGIN` (your
frontend domain). Use Azure SQL in production and keep
`TrustServerCertificate=true` if you use a self-signed cert.

**Client (Vercel)**

Build: `npm --prefix client run build`
Output directory: `client/dist`

Set `VITE_API_URL` to the deployed API origin. `vercel.json` needs a rewrite so
client-side routes like `/s/:token` fall through to `index.html`:

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

The public link stored in the database is the frontend URL plus the share
token, so the frontend must be reachable at the domain people share.

---

## Scripts

| Command | Description |
| ------- | ----------- |
| `npm run install:all` | Install both workspaces |
| `npm run migrate`     | Apply `server/db/schema.sql` |
| `npm run seed`        | Create the bootstrap admin |
| `npm run dev:server`  | Express with file watching |
| `npm run dev:client`  | Vite dev server |
| `npm run lint`        | ESLint for both workspaces |
| `npm run build`       | Production client build |

---

## Possible next steps

Conditional questions (show a follow-up based on a prior answer), QR-code
sharing, scheduled sends with reminders, image and file-upload question types,
WebSocket live response counts, PWA installability, survey templates, and
integration tests over the API layer.