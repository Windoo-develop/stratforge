# StratForge

StratForge is a mobile-first tactical board for Standoff/CS-style planning. It combines a radar-based map editor with team workflows for shared line-ups, strats, roster permissions, invites, and profile management.

## Stack

- React
- TypeScript
- Vite
- Supabase Auth / Database / Storage
- Tailwind CSS
- GSAP

## Core Features

- Tactical map editor with player markers, utility icons, route arrows, zoom and local autosave
- Auth with email/password and Google sign-in
- Profile setup with username, avatar and bio
- Team creation, join flow, invites and roster permissions
- Shared line-ups and strats by map
- Mobile-friendly dashboard and editor flows

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Create a local env file from the example:

```bash
cp .env.example .env
```

3. Fill in your Supabase credentials in `.env`.

4. Start the dev server:

```bash
npm run dev
```

## Environment Variables

See [.env.example](/Users/morozovbl/Web%20development/stratbook.so2/.env.example).

Expected variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SITE_URL`

## Supabase

SQL migrations live in [supabase/migrations](/Users/morozovbl/Web%20development/stratbook.so2/supabase/migrations).

If you are applying them manually in Supabase SQL Editor, run them in chronological order.

## Release Checklist

- Confirm `.env` is not committed
- Apply the latest Supabase migrations
- Run `npm run lint`
- Run `npm run build`
- Review `public/` assets and screenshots
- Push the repository without `dist/` or other local artifacts
