# 🗺️ Wanderlog

A public travel photo timeline. Post moments from your trip — photos, captions, locations — and share a single link with anyone.

## Stack

- **React + Vite** — frontend
- **Supabase** — database, auth (Google OAuth), image storage
- **Vercel** — hosting + preview deployments

## Local setup

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/wanderlog.git
cd wanderlog
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New project
2. Open **SQL Editor** → paste the contents of `supabase/schema.sql` → Run
3. Go to **Storage** → New bucket → name it `moment-images` → set to **Public**
4. Go to **Authentication → Providers** → enable **Google** (you'll need a Google OAuth client ID/secret from [console.cloud.google.com](https://console.cloud.google.com))

### 3. Set env vars

```bash
cp .env.example .env
```

Edit `.env`:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_TRIP_ID=your-trip-uuid   # from the trips table after you insert a row
```

### 4. Create your first trip

In Supabase SQL Editor:

```sql
insert into trips (user_id, name, start_date, end_date, is_public)
values (
  'your-user-uuid-after-first-sign-in',
  'Your Trip Name',
  '2025-07-13',
  '2025-07-17',
  true
)
returning id;
```

Copy the returned `id` → paste as `VITE_TRIP_ID` in your `.env`.

### 5. Run

```bash
npm run dev
```

## Deploy to Vercel

1. Push to GitHub
2. Go to [vercel.com](https://vercel.com) → Import repo
3. Add the three env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_TRIP_ID`)
4. Set **Supabase Auth → URL Configuration** → add your Vercel URL as a redirect URL

## Project structure

```
wanderlog/
├── src/
│   ├── components/
│   │   ├── MomentCard.jsx       # Individual moment card
│   │   └── AddMomentModal.jsx   # Post-moment sheet
│   ├── hooks/
│   │   ├── useAuth.js           # Google auth state
│   │   └── useMoments.js        # Fetch/add/react to moments
│   ├── lib/
│   │   └── supabase.js          # Supabase client
│   ├── pages/
│   │   └── TimelinePage.jsx     # Main timeline view
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── supabase/
│   └── schema.sql               # Full DB schema + RLS policies
├── .github/workflows/ci.yml     # Build check on every PR
├── .env.example
└── vite.config.js
```
