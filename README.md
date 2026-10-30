# My Academy

Multi-tenant gymnastics academy app. Staff run students, batches, attendance, fees, and skill or fitness assessments. Parents follow one child. An owner account manages academies.

This repository is a portfolio project. It is not a hosted product. Demo data uses `example.com` addresses only.

## What you can walk through

- **Owner** — academies, sports categories, skills, users, and center reports
- **Admin** — locations, programs, courses, students, attendance, invoices, events, and assessments
- **Manager** — the same day-to-day screens for one academy
- **Coach** — assigned students, attendance, and assessments
- **Parent** — attendance, skill and fitness progress, workouts, and feedback

Sign-in uses NextAuth. Middleware sends each role to its home page. Almost every business record is stored with a `tenantId`.

Shared page chrome lives in `features/` (student, attendance, and fee lists, plus the assessment form pages). Role routes under `app/admin`, `app/manager`, and `app/coach` stay thin.

## Stack

Next.js 15 (App Router), React 19, Tailwind CSS 4, Prisma, MySQL, NextAuth, React Query, and Zod.

## Run it locally

1. Use Node.js 20 or newer.
2. Copy the env template and fill in your own database. Do not commit `.env`.

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

3. Install dependencies and generate the Prisma client.

```bash
npm install
npx prisma generate
```

4. Create the MySQL database named in `DATABASE_URL`, then push the schema and seed fictional users.

```bash
npx prisma db push
npx prisma db seed
```

The checked-in SQL migrations are older than `prisma/schema.prisma`. Use `db push` for a fresh database.

5. Start the app.

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Demo logins

Created by the seed. Change them before any shared environment.

| Email | Password | Role |
| --- | --- | --- |
| demo@example.com | demo123 | owner |
| owner@example.com | 12345 | owner |

The sign-in form is prefilled with the first account.

## Optional comment drafts

On a skill assessment, **Draft comment** writes a note from the ratings already on the form. Nothing is saved until the coach edits it and submits the assessment.

Set `OPENAI_API_KEY` in `.env` to call an OpenAI-compatible chat model (`OPENAI_MODEL`, default `gpt-4o-mini`). With no key, the same button uses a built-in draft from those ratings.

Admins and managers also see an **At-risk students** list on the enrollment dashboard. It ranks active students in the current academy by missed attendance, overdue invoices, and low skill scores. It does not email anyone.

## Tests

```bash
npm test
npm run test:e2e
```

## Project map

- `app/admin`, `app/manager`, `app/coach`, `app/parent`, `app/owner` — role screens
- `app/api` — route handlers
- `features/` — shared list and assessment pages
- `lib/ai` — comment drafts and the at-risk ranking
- `prisma/schema.prisma` — MySQL models
- `config/menu.config.tsx` — role menus
