This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Prerequisites

- A [Supabase](https://supabase.com) project (free tier works fine)
- Node.js 18+

## Database Setup

1. Create a new Supabase project at [https://supabase.com](https://supabase.com).
2. Copy your **Project URL** and **anon key** from Project Settings > API.
3. Create `.env.local` in the project root (see `ENVIRONMENT.md` for the format).
4. Open the Supabase SQL Editor and run `supabase/migrations/001_initial_schema.sql`.
5. Run the rest of the migrations in order, through `supabase/migrations/014_group_expirations.sql`.
6. Log in with the default admin account (`admin` / `admin123`).

See [`SUPABASE_SETUP.md`](./SUPABASE_SETUP.md) for full instructions.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
