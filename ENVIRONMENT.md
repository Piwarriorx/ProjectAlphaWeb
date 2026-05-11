# Required Environment Variables

Create a `.env.local` file in the project root with the following variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## Where to Find These Values

1. Open your Supabase project dashboard.
2. Go to **Project Settings > API**.
3. Copy:
   - **URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
