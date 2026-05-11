# Supabase Setup Guide for EzCrosshairX

## 1. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign in (or sign up).
2. Click **"New Project"** and choose your organization.
3. Give your project a name (e.g., `ezcrosshairx`).
4. Choose a region close to your users.
5. Click **"Create New Project"** and wait for it to provision (this takes 1–2 minutes).

## 2. Add Environment Variables

Copy your project's **API URL** and **anon/public key** from:
> Project Settings > API > Project API keys

Create a file named `.env.local` in the root of this project and paste:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## 3. Run the Database Migration

1. In your Supabase Dashboard, open the **SQL Editor**.
2. Click **"New query"**.
3. Open `supabase/migrations/001_initial_schema.sql` from this repo and copy its entire contents.
4. Paste the SQL into the editor and click **"Run"**.

This will create:
- The `users` table
- `hash_password()` and `login_user()` RPC functions
- Row Level Security (RLS) policies
- An initial **admin** user

## 4. Log In

| Field    | Value     |
|----------|-----------|
| Username | `admin`   |
| Password | `admin123`|

> **Important:** Change the admin password after your first login by updating it directly in the Supabase Table Editor, or create a new admin and delete the default one.

## 5. Create Storage Bucket (for File Downloads)

1. In your Supabase Dashboard, go to **Storage**.
2. Click **"New bucket"**.
3. Name it `downloads`.
4. Toggle **"Public bucket"** ON.
5. Click **"Save"**.
6. Go to the **Policies** tab for the `downloads` bucket.
7. Create these policies:
   - **SELECT** — Allowed for `anon` role (so signed URLs work)
   - **INSERT** — Allowed for `anon` role (so admin uploads work via server actions)
   - **DELETE** — Allowed for `anon` role (so admin deletes work via server actions)

> Note: Upload/delete access is controlled at the application level (admin-only UI). The permissive storage policies are needed because this app uses custom localStorage auth instead of Supabase Auth.

## 6. Run Remaining Migrations

After creating the bucket, run these additional migrations in the SQL Editor:

- `supabase/migrations/002_fix_rls_for_registration.sql`
- `supabase/migrations/003_admin_actions.sql`
- `supabase/migrations/004_files_table.sql`

## 7. Register New Users

Anyone can register via the `/login` page. New accounts start with the `pending` role and must be approved by an admin on the `/dashboard` page before they can log in.

---

## Schema Overview

### `public.users`

| Column         | Type        | Description                              |
|----------------|-------------|------------------------------------------|
| `id`           | `serial`    | Primary key, auto-incrementing           |
| `username`     | `text`      | Unique login name                        |
| `password_hash`| `text`      | Bcrypt-hashed password                   |
| `role`         | `text`      | `pending`, `user`, or `admin`            |
| `created_at`   | `timestamptz`| Account creation timestamp               |

### RPC Functions

| Function        | Purpose                                      |
|-----------------|----------------------------------------------|
| `hash_password` | Hashes a plaintext password with bcrypt      |
| `login_user`    | Verifies credentials and returns user info   |
