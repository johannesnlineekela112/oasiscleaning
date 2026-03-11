# Namshine Detailing — Mobile Car Wash Platform

Full-stack booking, loyalty, and commission payout system.

## Stack

- **Frontend**: React 18 + TypeScript 5.8 + Vite 5 + TailwindCSS
- **Backend**: Supabase (Postgres + Auth + Storage + Edge Functions + Realtime)
- **Deploy**: Netlify (frontend) + Supabase (backend — already live)

---

## Quick Start

```bash
npm install
npm run dev          # local dev → http://localhost:8080
npm run build        # production build → dist/
npm run test         # vitest unit tests
```

---

## Deploy to Netlify

**Option A — Drag & Drop**
```bash
npm run build
# Drag the dist/ folder onto Netlify dashboard
```

**Option B — CLI**
```bash
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

**Option C — Git**  
Connect repo in Netlify dashboard. Build command: `npm run build`. Publish: `dist`.

`netlify.toml` and `public/_redirects` are pre-configured for SPA routing.

---

## Supabase Credentials

Embedded in `src/lib/supabase.ts`. No `.env` file needed.

| | Value |
|---|---|
| Project URL | `https://gzbkpwdnkhsbeygnynbh.supabase.co` |
| Anon Key | See `src/lib/supabase.ts` |

---

## Database — Already Deployed (nothing to run)

### Tables
| Table | Purpose |
|---|---|
| `users` | All users (customer / employee / admin) |
| `employees` | Employee profiles + per-employee commission rate |
| `bookings` | All bookings — status, pricing, free wash flags, completed_at |
| `booking_images` | Job photo metadata (Storage bucket: `job-photos`) |
| `user_loyalty` | Points, tiers, free wash counts per customer |
| `free_wash_redemptions` | Redemption lifecycle (reserved → completed / cancelled) |
| `employee_commission_summary` | Monthly payout summaries (pending → approved → paid) |
| `services` | Configurable service types + pricing matrix |
| `ads` | Marketing ads shown on booking page |
| `legal_documents` | Terms, privacy policy (auto-versioned) |
| `team_members` | About page team profiles with photos |

### Edge Functions (all ACTIVE on Supabase)
| Function | Purpose |
|---|---|
| `create-staff-user` | Admin creates employee/admin accounts |
| `update-booking` | Privileged booking field updates |
| `loyalty-redeem` | Free wash redemption with cap + expiry logic |
| `generate-monthly-commission` | Compute + upsert monthly commission summaries |

---

## Commission Payout System

**Rule**: Employees earn 20% of completed job value.  
**Free wash jobs**: Commission uses `original_price` (pre-discount value), never `price=0`.

### Admin workflow
1. **Admin Dashboard → Payouts tab**
2. Select Month + Year → **Generate Summary**
3. Expand each employee card → **Approve** → **Mark as Paid**
4. Export batch or single employee as **CSV** or **XLSX**

### Immutability
Once a summary is marked **Paid**, the DB trigger `guard_paid_commission_summary` permanently locks the row — no UPDATE of any column is possible, even via direct SQL.

### Employee view
**Employee Dashboard → Payouts tab** — shows personal commission history per period.

---

## User Roles

| Role | Access |
|---|---|
| `customer` | Book jobs, loyalty panel, view completed job photos |
| `employee` | View/complete assigned jobs, upload photos, view own commission history |
| `admin` | Full access: all bookings, staff, loyalty, payouts, services, content |

---

## Loyalty System

- **+10 pts** per completed booking  
- **+20 pts** milestone bonus every 5th booking  
- **+25 pts** referral bonus  
- **100 pts** = 1 free wash (redeemable on booking page)  
- Tiers: Bronze → Silver → Gold → Platinum → Diamond → VIP

---

## Project Structure

```
src/
  lib/
    supabase.ts              Supabase client
    authService.ts           Auth: login, register, profile, roles
    bookingService.ts        Bookings, staff, services, legacy commission
    loyaltyService.ts        Points, tiers, redemptions
    imageService.ts          Job photo upload / signed URLs
    commissionService.ts     Monthly payout: generate, approve, pay, export
    xlsxExport.ts            Zero-dependency XLSX + CSV engine (no npm pkg)
    adService.ts             Marketing ads
    contentService.ts        Legal docs, team members
    utils.ts                 Shared helpers

  pages/
    AuthPage.tsx             Customer login / register
    AdminLogin.tsx           Admin login
    BookingPage.tsx          Customer booking flow + Mapbox + loyalty
    AdminDashboard.tsx       Admin panel (all tabs)
    EmployeeDashboard.tsx    Employee panel + job photos + commission
    UserDashboard.tsx        Customer panel + photos + loyalty
    AdminAds.tsx             Marketing ads management

  components/
    MapPicker.tsx            Mapbox GL location picker
    AdsDisplay.tsx           Ad carousel
    AboutModal.tsx           About / legal modal
    ui/                      Toast, tooltip (Radix)

supabase/functions/
    create-staff-user/
    update-booking/
    loyalty-redeem/
    generate-monthly-commission/
```
