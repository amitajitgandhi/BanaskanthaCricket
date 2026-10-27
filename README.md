# Cricket Lover Boys Premier League — Season 12

This repo is a Vercel deployment with five pages sharing one theme, navigable from the hamburger menu on every page:

- `/rules` (`index.html`) and `/schedule` (`schedule.html`) — the existing static tournament pages.
- `/register` (`register.html`) — player registration form: player details, a scannable QR gallery you control from the admin dashboard, a payment-screenshot upload with in-browser OCR that tries to auto-read the transaction ID, and terms/refund acknowledgement.
- `/players` (`players.html`) — public roster of players whose registration status the administrator has set to **Confirmed**. Only name, playing role, t-shirt size, and previous team/experience are shown — never phone/email/address.
- `/admin` (`admin.html`) — password-protected dashboard: summary stats, a searchable registrations table (with a per-player Pending/Confirmed status dropdown, a payment-screenshot viewer, and CSV export), and QR code upload/management.

`/rules` and `/schedule` are still plain static HTML. `/register`, `/players`, and `/admin` are backed by Vercel serverless functions (`/api/*`) and a Supabase project (Postgres + Storage) for the parts that need real persistence.

## 1. Create the Supabase project

1. Create a project at [supabase.com](https://supabase.com) (the free tier is plenty for this).
2. Open the **SQL Editor**, paste in the contents of [`supabase/setup.sql`](supabase/setup.sql) from this repo, and run it. It creates both tables, both storage buckets, and both storage policies in one go — see that file for the full script and comments.
3. Go to **Project Settings → API** and note down three values you'll need in the next step:
   - **Project URL**
   - **anon public key**
   - **service_role key** (keep this one secret — never put it in client-side code)

## 2. Configure environment variables

In your Vercel project (Settings → Environment Variables), set:

| Variable | Value |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | The anon public key (safe to expose to the browser — the registration page reads it via `/api/config`) |
| `SUPABASE_SERVICE_ROLE_KEY` | The service_role key — **server-side only**, used by the API routes |
| `EVENT_DATES` | e.g. `11-13 December 2026` |
| `EVENT_VENUE` | Tournament venue |
| `REGISTRATION_FEE` | e.g. `1500` |
| `REGISTRATION_DEADLINE` | Registration deadline text |
| `ORGANIZER_NAME` | e.g. `Amit Gandhi` |
| `ORGANIZER_PHONE` | e.g. `+91 7276319578` |
| `ADMIN_USER` / `ADMIN_PASS` | Login for `/admin` — **change these before going live** |
| `ADMIN_SECRET` | A long random string used to sign admin session tokens — **change this before going live** |

For local development, copy `.env.example` to `.env` and fill these in (`vercel dev` reads `.env` automatically).

## 3. Deploy

Push this repo to GitHub (already connected to Vercel, or import it fresh) — `vercel.json` handles the build: `/rules`, `/schedule`, `/register`, `/players`, `/admin` map to their HTML files, static assets under `public/` are served as-is, and everything under `api/` becomes a serverless function. No extra build command is needed; Vercel runs `npm install` for the `@supabase/supabase-js` dependency automatically.

## How it fits together

- **Registration flow**: the browser uploads the payment screenshot straight to the private `screenshots` Supabase bucket (using the public anon key, which can only insert there — never read), runs OCR on it locally with Tesseract.js to guess the transaction ID, then posts the form fields plus the screenshot's storage path to `/api/register`, which validates everything and inserts one row into `registrations` with `status = 'Pending'`.
- **Confirmation workflow**: nothing is automatic. An administrator checks the payment (using the screenshot + UPI reference shown in the dashboard) and manually flips a player's status dropdown from **Pending** to **Confirmed** in `/admin`. Only players marked Confirmed show up on the public `/players` page.
- **QR codes**: admin uploads go through `/api/admin/qr-codes` (authenticated), which stores the image in the public `qr-codes` bucket using the service-role key and a row in `qr_codes`. `/api/qr-active` is the public endpoint the registration page calls — it only returns codes marked `active`, so the "which ones and how many to show" control lives entirely in the admin dashboard.
- **Admin auth**: `/api/admin/login` checks `ADMIN_USER`/`ADMIN_PASS` and returns a signed token (HMAC'd with `ADMIN_SECRET`, 12-hour expiry) that the dashboard stores in `sessionStorage` and sends as `Authorization: Bearer …` on every admin API call. There's no separate session store — the token itself carries its expiry, verified on each request.
- **Payment screenshots stay private**: admins view one via `/api/admin/registrations/:id/screenshot`, which mints a 60-second Supabase signed URL rather than exposing the file publicly.
- **Refunds**: fees are non-refundable — shown as small print next to the fee amount on the form.
- **Navigation**: all five pages share the same hamburger menu (pure CSS, no JS — a checkbox + sibling selectors, same pattern the existing schedule page already used for its collapsible day sections).

## Notes

- This repo also still has a `CLBPL.csproj` / `Program.cs` / `Properties/` / `appsettings*.json` from an earlier scaffold — none of it is used by the actual deployment (Vercel builds only what `vercel.json` points at), so it's harmless, but let me know if you'd like it removed for tidiness.
- `CLBPL_S11_Rules.docx` isn't linked from any page — flagging in case you also want it renamed/updated or replaced with a Season 12 version.
