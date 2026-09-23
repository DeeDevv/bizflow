/**
 * Supabase client for BizFlow.
 *
 * ── WHERE DO MY CREDENTIALS GO? ──────────────────────────────────────────
 * They go in the `.env.local` file in the `bizflow-tmp/` folder, on these
 * two lines (the lines already exist there — just paste your values after
 * the "=" and save):
 *
 *   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
 *   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
 *
 * Copy both values from your Supabase dashboard:
 * Project Settings → API (or the "Connect" button on the project home page).
 * Restart the dev server after editing `.env.local` — Next.js only reads
 * the file at startup.
 *
 * The URL is not a secret and the publishable key (`sb_publishable_...`)
 * is designed to be used in the browser — it is protected by your Row
 * Level Security policies in Supabase.
 *
 * NEVER put the service-role (secret) key in this project or in any
 * variable starting with NEXT_PUBLIC_ — it would be visible to every
 * visitor. This code never reads one.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { createBrowserClient } from "@supabase/ssr";

// Next.js exposes browser-safe variables prefixed with NEXT_PUBLIC_.
// (This is a Next.js project — VITE_* variables do not work here.)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * True once real credentials are present in `.env.local`.
 * Future phases can check this and fall back to mock data until the
 * database is ready — nothing reads from Supabase yet.
 */
export const isSupabaseConfigured =
  Boolean(supabaseUrl) && Boolean(supabasePublishableKey);

let client: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Returns the shared Supabase client, created only from the real values
 * in `.env.local` — no placeholder credentials are ever used.
 * Throws a clear error if called before credentials are added.
 *
 * The client is the cookie-based browser client from @supabase/ssr: the
 * session lives in cookies, which is what lets the server middleware and
 * server components see the logged-in user (plain localStorage sessions
 * are invisible to the server and would break route protection).
 */
export function getSupabaseClient() {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "[BizFlow] Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to bizflow-tmp/.env.local " +
        "(see the top of src/lib/supabase.ts), then restart the dev server.",
    );
  }
  if (!client) {
    client = createBrowserClient(supabaseUrl, supabasePublishableKey);
  }
  return client;
}

if (process.env.NODE_ENV === "development" && !isSupabaseConfigured) {
  console.warn(
    "[BizFlow] Supabase is not configured yet — the app keeps running on " +
      "mock data. Add your credentials to bizflow-tmp/.env.local " +
      "(instructions are at the top of src/lib/supabase.ts).",
  );
}
