// _supabase.ts — Supabase client singleton.
//
// The single point of contact with @supabase/supabase-js. All api/*
// modules go through here (never directly imported by UI).
//
// Two important pieces:
//   • USE_SUPABASE — feature flag read from VITE_USE_SUPABASE.
//     When false, the rest of the api layer falls back to mockData.
//   • supabase()  — lazy singleton. Only constructed when first asked,
//                   so dev with the flag off pays nothing.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const env = import.meta.env;

export const USE_SUPABASE: boolean =
  String(env.VITE_USE_SUPABASE ?? '').toLowerCase() === 'true';

const SUPABASE_URL = env.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY ?? '';

let _client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (_client) return _client;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'Supabase client requested but VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. ' +
        'Copy .env.example → .env.local and fill them in.',
    );
  }
  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      // Phone OTP flow doesn't bounce through a URL; no need to detect.
      detectSessionInUrl: false,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  return _client;
}

// Surface in dev console for ad-hoc inspection.
if (import.meta.env.DEV && USE_SUPABASE) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__supabase = supabase;
  console.info('[supabase] USE_SUPABASE=true — client will lazily initialize');
}
