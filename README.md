# RK Harvester Fresh Dashboard

Responsive dashboard for RK Harvester work entries, collections, machines, staff, and expenses.

## Open

Open `index.html` in a browser, or run a simple local server from this folder.

## Supabase Setup

1. Open your Supabase project.
2. Go to SQL Editor.
3. Run `supabase/schema.sql`.
4. Confirm `supabase/config.js` has your project URL and anon key.
5. Refresh the app and log in.

The app uses `supabase/config.js` as the only browser config file. The Supabase project URL should look like `https://your-project.supabase.co`, not the REST endpoint ending in `/rest/v1`.

## Login

- Owner: `owner` / `1234`
- Operator: `ramesh` / `1234`

## Roles

- `owner`: dashboard, work, expenses, machines, operator signup, backup, deletes, export/import/reset.
- `operator`: work entries and expenses only.

Operator signup is owner-only. The app always creates new signups with the `operator` role.

This is a static browser app with app-level role checks. For production-grade security, migrate login to Supabase Auth and enforce database access with RLS policies.
