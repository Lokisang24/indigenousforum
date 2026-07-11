# Indigenous Forums — Registration Platform

A web application for online membership registration, admin review/approval,
and automatic generation of a formal registration certificate (PDF), matching
the sample certificate provided.

## Stack

- **Frontend:** React (via Next.js pages)
- **Backend:** Node.js Serverless API Routes (Next.js `pages/api`)
- **Database:** PostgreSQL (via Prisma ORM) — works with Supabase, Neon, Vercel Postgres, or any managed Postgres
- **Hosting:** Vercel
- **Document generation:** `pdf-lib` (generates the certificate PDF server-side)
- **Email:** Nodemailer over SMTP (works with SendGrid, Mailgun, Gmail app passwords, Resend SMTP, etc.)

## How it works

1. An applicant fills in the public registration form (`/`) with their name,
   surname, date of birth, clan, address, gender, email, and optional photo.
2. On submit, the app:
   - Generates a random **ID No** (e.g. `RC 942183`)
   - Generates a unique **15-character hex verification code (OTP)**
   - Saves the application to Postgres with status `PENDING`
   - Emails the admin a new-application notification
   - Emails the applicant an acknowledgement
3. An administrator logs in at `/admin/login` and reviews pending applications
   on `/admin/dashboard`.
4. When an admin **approves** an application, the app assigns the next
   sequential, unique certificate number (`LS/ZA 2006241`, `LS/ZA 2006242`, ...)
   — this counter only increments on approval, exactly as requested.
5. The admin can then download the generated certificate PDF for the
   applicant, and the applicant is emailed that their application was
   approved.
6. Rejected applications are marked `REJECTED` and the applicant is notified.

## Project structure

```
indigenous-forums/
├── prisma/
│   └── schema.prisma          # Database schema (Application, Admin, CertificateCounter)
├── lib/
│   ├── db.js                  # Prisma client
│   ├── auth.js                # JWT + password hashing + cookie helpers
│   ├── mailer.js               # Email notifications (nodemailer)
│   ├── idGenerator.js         # ID No / OTP / certificate number generation
│   └── pdfGenerator.js        # Certificate PDF layout (pdf-lib)
├── pages/
│   ├── index.js               # Public registration form
│   ├── admin/
│   │   ├── login.js
│   │   └── dashboard.js       # Pending/Approved/Rejected tabs, approve/reject actions
│   └── api/
│       ├── register.js        # POST — public registration submission
│       └── admin/
│           ├── login.js
│           ├── logout.js
│           └── applications/
│               ├── index.js       # GET — list applications
│               └── [id].js        # GET / PATCH — view, approve, reject
│               └── [id]/certificate.js  # GET — download certificate PDF
├── scripts/
│   └── createAdmin.js         # CLI to create the first admin account
├── styles/globals.css
├── middleware.js              # Redirects unauthenticated visitors away from the dashboard
├── .env.example
└── package.json
```

## Local setup

### 1. Prerequisites
- Node.js 18+
- A PostgreSQL database (a free one from [Supabase](https://supabase.com) or
  [Neon](https://neon.tech) works well)

### 2. Install dependencies
```bash
cd indigenous-forums
npm install
```

### 3. Configure environment variables
```bash
cp .env.example .env
```
Fill in:
- `DATABASE_URL` — your Postgres connection string
- `JWT_SECRET` — any long random string (`openssl rand -hex 32`)
- `SMTP_*` and `ADMIN_NOTIFICATION_EMAIL` — for email notifications (optional
  for local testing; if left unset, the app logs emails to the console
  instead of sending them, so you can still develop without SMTP configured)

### 4. Create the database tables
```bash
npm run db:push
```

### 5. Create your first admin account
```bash
npm run seed:admin -- "Your Name" "you@example.com" "a-strong-password"
```

### 6. Run the app
```bash
npm run dev
```
- Public registration form: http://localhost:3000
- Admin login: http://localhost:3000/admin/login

## Deploying to Vercel

1. Push this folder to a new GitHub repository.
2. Import the repository into [Vercel](https://vercel.com/new).
3. Add the same environment variables from `.env.example` in the Vercel
   project's **Settings → Environment Variables**.
4. Vercel will run `npm install` (which runs `prisma generate` via
   `postinstall`) and `npm run build` automatically.
5. After the first deploy, run the database push and admin seed once from
   your local machine (pointed at the same `DATABASE_URL`):
   ```bash
   npm run db:push
   npm run seed:admin -- "Your Name" "you@example.com" "a-strong-password"
   ```

## Notes & production hardening suggestions

- **Photo storage:** applicant photos are currently stored inline as base64
  in the database for simplicity. For production at scale, swap this for
  object storage (e.g. Vercel Blob or S3) and store the resulting URL instead
  — see the comment in `pages/api/register.js`.
- **Rate limiting / CAPTCHA:** the project spec calls for rate limiting and
  CAPTCHA on the public form. Recommended: add
  [Vercel's built-in rate limiting](https://vercel.com/docs) or a service
  like Cloudflare Turnstile in front of `/api/register`.
- **Roles:** the `Admin` model has a `role` field (`ADMIN`,
  `COORDINATING_CHIEF`, `SENIOR_CHIEF`) ready for you to build multi-tier
  approval permissions on top of.
- **Certificate design:** `lib/pdfGenerator.js` recreates the sample
  certificate's layout using plain shapes/text (no external design assets
  were provided). Certificate wording (org name, territory, chiefs, contact
  email) is configurable via environment variables in `.env.example`. Swap in
  a background/border image asset under `public/assets/` and reference it in
  `pdfGenerator.js` for an exact visual match to your branded template.
- **Future enhancements** noted in the original spec (member login portal,
  renewals, digital membership cards, QR verification, SMS, analytics,
  multi-admin support) are intentionally left out of this first version so
  the architecture stays simple — the Prisma schema and folder structure are
  set up to extend cleanly when you're ready to add them.
