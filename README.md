# RK Harvester Fresh Dashboard

Responsive dashboard for RK Harvester work entries, collections, machines, staff, and expenses.

## Run

```bash
npm install
npm run dev
```

Then open the local Vite URL shown in the terminal.

## Supabase Setup

1. Open your Supabase project.
2. Go to SQL Editor.
3. Run `supabase/schema.sql`.
4. Confirm `supabase/config.js` has your project URL and anon key.
5. Refresh the app and log in.

The app uses `supabase/config.js` as the only browser config file. The Supabase project URL should look like `https://your-project.supabase.co`, not the REST endpoint ending in `/rest/v1`.

Machine cards support an optional `image_url` column. Re-run `supabase/schema.sql` to add it to an existing project and seed the default harvester image.

## Login

- Owner: `owner` / `1234`
- Operator: `ramesh` / `1234`

## Roles

- `owner`: dashboard, work, expenses, machines, operator signup, backup, deletes, and export.
- `operator`: work entries and expenses only.

Operator signup is owner-only. The app always creates new signups with the `operator` role.

This is a static browser app with app-level role checks. For production-grade security, migrate login to Supabase Auth and enforce database access with RLS policies.
